"use strict";

/**
 * EMPEZAR UN AÑO NUEVO del curso, y el historial de los años cerrados.
 *
 *   POST /api/nuevo-anio   arranca el ciclo siguiente   (admin)
 *   GET  /api/cohortes     los años ya cerrados         (admin)
 *
 * Por qué esto vive en el servidor y no en el navegador, como antes:
 * toca a TODAS las personas de golpe. Si se hiciera desde una pestaña y alguien
 * la cerrara a la mitad, media comunidad quedaría con el avance reiniciado y la
 * otra media no — en calendarios distintos y solas en el foro, que va por
 * lección. Aquí, o se hace entero o no se hace.
 *
 * Lo que NO se borra: el avance y el ranking del año viejo se quedan donde
 * están. Solo cambia cuál es el ciclo activo, y como el ciclo forma parte del
 * cajón donde se guarda cada dato, el año nuevo nace literalmente vacío. La
 * historia queda intacta y empezar el año cuesta una escritura.
 *
 * Lo que NO toca: cuentas, planes, el contenido de las lecciones ni el foro.
 */

const { app } = require("@azure/functions");
const { json, malaPeticion, manejar, cuerpoJson, esAdminPermanente } = require("../shared/http");
const { P, leerTodo, guardar, guardarLote } = require("../shared/tablas");
const { fijarCiclo, limpiarCiclo } = require("../shared/ciclo");

/**
 * Cuánta gente cabe por fila del historial.
 *
 * Una celda de Azure Table Storage admite 64 KB de texto. Cada participante
 * ocupa unos 150 bytes, así que 200 entran de sobra con margen. Si el grupo es
 * mayor, el año se guarda partido en varias filas y se vuelve a unir al leerlo.
 */
const POR_FILA = 200;

// ------------------------------------------------------- POST /nuevo-anio
app.http("nuevoAnio", {
  route: "nuevo-anio",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: manejar("admin", async (req, _ctx, { ciclo }) => {
    const body = await cuerpoJson(req);
    const nuevo = limpiarCiclo(String(body.label ?? ""));
    const archivadoEn = Date.now();

    // Si el año nuevo se llamara igual que el que corre, el reinicio no haría
    // NADA (los datos seguirían en el mismo cajón). Mejor avisar que fingir.
    if (nuevo === ciclo) {
      const sugerido = Number(ciclo) ? Number(ciclo) + 1 : "2027";
      return json(
        {
          error: "mismo-ciclo",
          detalle: `El proceso actual ya se llama "${ciclo}". Escribe el nombre del año que COMIENZA (por ejemplo "${sugerido}").`,
        },
        400,
      );
    }

    // 1) Foto del año que termina: solo inscritas, sin la cuenta de la fundación.
    const personas = await leerTodo("users");
    const participantes = personas
      .filter((u) => u.enrolled !== false && !esAdminPermanente(String(u.email ?? "")))
      .map((u) => ({
        name: String(u.fullName || u.displayName || "Caminante"),
        email: String(u.email || ""),
        country: String(u.country || ""),
        completed: Number(u.completedLessonsCount || 0),
        currentLesson: Number(u.currentLesson || 1),
      }));

    const total = participantes.length;
    const finishedCount = participantes.filter((p) => p.completed >= 365).length;
    const avgCompletion = total
      ? Math.round(participantes.reduce((a, p) => a + (p.completed / 365) * 100, 0) / total)
      : 0;
    const avgLesson = total
      ? Math.round(participantes.reduce((a, p) => a + p.currentLesson, 0) / total)
      : 0;

    const partes = [];
    for (let i = 0; i < participantes.length; i += POR_FILA) {
      partes.push(participantes.slice(i, i + POR_FILA));
    }
    if (partes.length === 0) partes.push([]);

    const filasHistorial = partes.map((gente, i) => ({
      // El historial lleva el nombre del año que TERMINA.
      fila: `${ciclo}_${archivadoEn}_${i + 1}`,
      datos: {
        label: ciclo,
        nuevoCiclo: nuevo,
        archivedAt: archivadoEn,
        total,
        finishedCount,
        avgCompletion,
        avgLesson,
        parte: i + 1,
        totalPartes: partes.length,
        participants: gente,
      },
    }));
    await guardarLote("cohorts", P.cohorts(), filasHistorial);

    // 2) Cambiar el ciclo activo. A partir de aquí, el avance nuevo va a otro
    //    cajón y el viejo queda como historia, sin borrar un solo dato.
    await fijarCiclo(nuevo);

    // 3) Poner a cero los contadores de cada persona. Incluye el acumulado del
    //    ranking: si no, "los madrugadores" arrastraría el año pasado.
    let reiniciadas = 0;
    for (const u of personas) {
      await guardar("users", P.users(), u._fila, {
        currentLesson: 1,
        completedLessonsCount: 0,
        lastCompletedAt: 0,
        rankDias: 0,
        rankSumaPuesto: 0,
        rankSumaMinuto: 0,
      });
      reiniciadas++;
    }

    return json({
      usersReset: reiniciadas,
      progressDeleted: 0, // a propósito: ya no se borra nada
      archivedLabel: ciclo,
      nuevoCiclo: nuevo,
    });
  }),
});

// --------------------------------------------------------- GET /cohortes
app.http("cohortes", {
  route: "cohortes",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("admin", async () => {
    const filas = await leerTodo("cohorts");
    const porAnio = new Map();

    for (const d of filas) {
      const archivedAt = Number(d.archivedAt ?? 0);
      const label = String(d.label ?? "");
      const clave = `${label}__${archivedAt}`;
      const gente = Array.isArray(d.participants) ? d.participants : [];

      const ya = porAnio.get(clave);
      if (ya) {
        // Un año grande quedó partido en varias filas: se vuelven a unir.
        ya.participants = [...ya.participants, ...gente];
        continue;
      }
      porAnio.set(clave, {
        id: d._fila,
        label,
        archivedAt,
        total: Number(d.total ?? 0),
        finishedCount: Number(d.finishedCount ?? 0),
        avgCompletion: Number(d.avgCompletion ?? 0),
        avgLesson: Number(d.avgLesson ?? 0),
        participants: gente,
      });
    }

    const lista = [...porAnio.values()].sort((a, b) => b.archivedAt - a.archivedAt);
    return json({ cohortes: lista });
  }),
});
