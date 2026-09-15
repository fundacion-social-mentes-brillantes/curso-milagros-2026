"use strict";

/**
 * Rutas del AVANCE, el CUADERNO y el RANKING.
 *
 *   GET  /api/avance               todo mi avance de este ciclo
 *   GET  /api/avance/{n}           cómo voy en una lección
 *   POST /api/avance/{n}           marcar (o desmarcar) una lección como hecha
 *   PUT  /api/avance/{n}/nota      mi nota privada de esa lección
 *   GET  /api/notas                todas mis notas, de la 1 en adelante
 *   GET  /api/ranking/{n}          mi puesto en esa lección
 *   GET  /api/ranking-dia/{fecha}  (admin) quiénes marcaron ese día
 *
 * Tres reglas que antes sostenía Firestore y que ahora hay que sostener aquí:
 *
 * 1. Nadie toca el avance de otra persona. La fila se busca SIEMPRE con
 *    `persona.uid`, que sale del token ya verificado, nunca de lo que mande el
 *    navegador en el cuerpo de la petición.
 * 2. La lección actual solo sube. Si alguien desmarca la 40, no lo devolvemos
 *    ahí: lo que ya caminó, caminado está.
 * 3. El puesto del día es un extra bonito, no el trabajo de verdad. Por eso va
 *    dentro de un try/catch: si el ranking se cae, la lección igual queda marcada.
 */

const { app } = require("@azure/functions");
const {
  json,
  noEncontrado,
  malaPeticion,
  manejar,
  cuerpoJson,
  leccionValida,
  esAdminPermanente,
} = require("../shared/http");
const {
  P,
  nLeccion,
  leerUno,
  leerParticion,
  leerTodo,
  contarParticion,
  guardar,
  odata,
} = require("../shared/tablas");

const TOTAL_LECCIONES = 365;
const MAXIMO_NOTA = 1000;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function acotarLeccion(n) {
  const v = Math.trunc(Number(n) || 1);
  return Math.min(Math.max(v, 1), TOTAL_LECCIONES);
}

/**
 * El reloj de Colombia, para que el "día" y la "hora" sean los mismos para todos
 * sin importar desde dónde se conecte cada quien ni dónde esté el servidor.
 *
 * Colombia no mueve la hora en ningún mes del año: siempre va cinco horas por
 * detrás del reloj universal. Por eso basta con restar cinco horas, y así no
 * dependemos de que la máquina de Azure tenga instalada la tabla de husos
 * horarios (si le faltara, las horas saldrían mal y nadie se enteraría).
 */
function relojBogota(ms) {
  const d = new Date(ms - 5 * 60 * 60 * 1000);
  return {
    fecha: d.toISOString().slice(0, 10), // "2026-09-15"
    minuto: d.getUTCHours() * 60 + d.getUTCMinutes(), // 0..1439
  };
}

/** Da forma a una fila de avance: los campos que falten toman su valor de siempre. */
function aAvance(f) {
  return {
    // Si la fila es vieja y no guardó el número, la propia clave de fila lo dice.
    lessonNumber: Number(f.lessonNumber ?? f._fila ?? 0) || 0,
    completed: f.completed === true,
    completedAt: f.completedAt == null ? null : Number(f.completedAt),
    nota: String(f.nota ?? ""),
    notaEn: Number(f.notaEn ?? 0) || 0,
  };
}

/** Lee de una vez todo mi avance del ciclo: es una sola consulta a mi partición. */
async function misFilas(uid) {
  const filas = await leerParticion("progress", P.progress(ciclo, uid));
  return filas.map(aAvance).sort((a, b) => a.lessonNumber - b.lessonNumber);
}

// --------------------------------------------------------------- GET /avance
app.http("avanceLista", {
  route: "avance",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (_req, _ctx, { persona, ciclo }) => {
    return json({ avance: await misFilas(persona.uid) });
  }),
});

// ----------------------------------------------------------- GET /avance/{n}
app.http("avanceUno", {
  route: "avance/{n}",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (req, _ctx, { persona, ciclo }) => {
    const n = leccionValida(req.params.n);
    if (!n) return malaPeticion("la lección va de 1 a 365");

    const fila = await leerUno(
      "progress",
      P.progress(ciclo, persona.uid),
      nLeccion(n),
    );
    if (!fila) return noEncontrado();
    return json(aAvance(fila));
  }),
});

// ---------------------------------------------------------- POST /avance/{n}
app.http("avanceMarcar", {
  route: "avance/{n}",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (req, _ctx, { persona, perfil, ciclo }) => {
    const n = leccionValida(req.params.n);
    if (!n) return malaPeticion("la lección va de 1 a 365");

    // Se exige un sí o un no explícito: si llegara cualquier otra cosa, adivinar
    // podría marcarle a alguien una lección que no hizo.
    const body = await cuerpoJson(req);
    if (typeof body.completed !== "boolean") {
      return malaPeticion("falta completed (true o false)");
    }
    const completed = body.completed;
    const ahora = Date.now();
    const particion = P.progress(ciclo, persona.uid);

    // 1. La fila de la lección. Se mezcla, así que una nota escrita antes sigue ahí.
    await guardar("progress", particion, nLeccion(n), {
      userId: persona.uid,
      ciclo,
      lessonNumber: n,
      completed,
      completedAt: completed ? ahora : null,
    });

    // 2. El contador de hechas se recuenta, no se suma uno: si alguien marca dos
    //    veces la misma lección, el número sigue siendo el verdadero.
    const filas = await leerParticion("progress", particion);
    const completadas = filas.filter((f) => f.completed === true).length;

    // 3. La lección actual SOLO sube (ver regla 2 de arriba).
    const actual = acotarLeccion(perfil?.currentLesson ?? 1);
    const cambios = {
      completedLessonsCount: completadas,
      currentLesson: completed ? Math.max(actual, acotarLeccion(n + 1)) : actual,
      lastActivityAt: ahora,
    };
    // 4. La fecha de "última lección hecha" solo se toca al completar; al
    //    desmarcar no se borra, porque sirve para saber quién sigue caminando.
    if (completed) cambios.lastCompletedAt = ahora;
    await guardar("users", P.users(), persona.uid, cambios);

    // 5. El puesto en esta lección. Todo lo que sigue es un extra: si falla, la
    //    lección ya quedó marcada arriba y la persona no pierde nada.
    let position = null;

    // 6. La cuenta de gestión de la fundación no compite: no es participante.
    //    Se mira tanto el correo del token como el del perfil guardado.
    const esLaFundacion =
      esAdminPermanente(persona.email) || esAdminPermanente(perfil?.email);

    if (completed && !esLaFundacion) {
      try {
        const particionDia = P.dailyDone(ciclo, n);
        const yaTenia = await leerUno("dailyDone", particionDia, persona.uid);

        if (yaTenia) {
          // Ya había hecho esta lección antes: conserva su puesto y no vuelve a
          // sumar al acumulado, o repetir el clic le subiría el promedio solo.
          position = Number(yaTenia.position ?? 0) || null;
        } else {
          const { fecha, minuto } = relojBogota(ahora);
          // El puesto es "cuántos llegaron antes, más uno". Contar la partición
          // es una consulta directa: son solo las filas de ESTA lección.
          position = (await contarParticion("dailyDone", particionDia)) + 1;

          // Sin el nombre a propósito: era un dato personal que cualquiera con
          // sesión podía leer. El nombre visible vive en el directorio.
          await guardar("dailyDone", particionDia, persona.uid, {
            uid: persona.uid,
            ciclo,
            date: fecha,
            completedAt: ahora,
            position,
            lessonNumber: n,
          });

          // El acumulado del ranking se guarda en el propio perfil para que el
          // panel de admin no tenga que leer la tabla entera cada vez que se abre.
          // Aquí no hay "sumar uno" automático como en Firestore, así que se
          // suma sobre lo que ya traía el perfil leído al empezar la petición:
          // es la misma persona marcando su propia lección, de una en una.
          await guardar("users", P.users(), persona.uid, {
            rankDias: (Number(perfil?.rankDias ?? 0) || 0) + 1,
            rankSumaPuesto: (Number(perfil?.rankSumaPuesto ?? 0) || 0) + position,
            rankSumaMinuto: (Number(perfil?.rankSumaMinuto ?? 0) || 0) + minuto,
          });
        }
      } catch {
        // Sin puesto esta vez; la lección quedó hecha, que es lo que importa.
        position = null;
      }
    }

    return json({ position });
  }),
});

// ----------------------------------------------------- PUT /avance/{n}/nota
app.http("avanceNota", {
  route: "avance/{n}/nota",
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (req, _ctx, { persona, ciclo }) => {
    const n = leccionValida(req.params.n);
    if (!n) return malaPeticion("la lección va de 1 a 365");

    const body = await cuerpoJson(req);
    // Se pide un texto de verdad: si aceptáramos cualquier cosa, una petición a
    // medias podría dejar la nota en blanco y borrar lo que la persona escribió.
    if (typeof body.nota !== "string") return malaPeticion("falta nota (texto)");
    const nota = body.nota.slice(0, MAXIMO_NOTA);

    // La nota vive en la MISMA fila del avance: no hace falta otra tabla, y así
    // al abrir la lección se lee todo de un viaje. Se mezcla, de modo que
    // escribir una nota no marca ni desmarca nada.
    await guardar("progress", P.progress(ciclo, persona.uid), nLeccion(n), {
      userId: persona.uid,
      ciclo,
      lessonNumber: n,
      nota,
      notaEn: Date.now(),
    });

    return json({ ok: true, nota });
  }),
});

// ---------------------------------------------------------------- GET /notas
app.http("notasLista", {
  route: "notas",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (_req, _ctx, { persona, ciclo }) => {
    const filas = await misFilas(persona.uid);
    const notas = filas
      .filter((f) => f.nota.trim().length > 0)
      .map((f) => ({ lessonNumber: f.lessonNumber, nota: f.nota, notaEn: f.notaEn }));
    return json({ notas });
  }),
});

// ---------------------------------------------------------- GET /ranking/{n}
app.http("rankingLeccion", {
  route: "ranking/{n}",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (req, _ctx, { persona, ciclo }) => {
    const n = leccionValida(req.params.n);
    if (!n) return malaPeticion("la lección va de 1 a 365");

    // Cada quien pregunta por SU puesto; por eso la fila es su propio uid.
    const fila = await leerUno("dailyDone", P.dailyDone(ciclo, n), persona.uid);
    const puesto = Number(fila?.position ?? 0) || 0;
    return json({ position: puesto > 0 ? puesto : null });
  }),
});

// ------------------------------------------------- GET /ranking-dia/{fecha}
app.http("rankingDia", {
  route: "ranking-dia/{fecha}",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("admin", async (req, _ctx, { ciclo }) => {
    const fecha = String(req.params.fecha || "");
    if (!FORMATO_FECHA.test(fecha)) return malaPeticion("la fecha va como 2026-09-15");

    // Aquí sí hay que recorrer la tabla entera: un mismo día la gente marca
    // lecciones distintas, y cada lección vive en su propia partición. Es la
    // consulta más cara de todas, por eso es solo del panel de admin. Se filtra
    // también por ciclo para no mezclar el año en curso con los anteriores.
    const filas = await leerTodo(
      "dailyDone",
      odata`date eq ${fecha} and ciclo eq ${ciclo}`,
    );

    const lista = filas
      .map((f) => ({
        uid: String(f.uid ?? f._fila ?? ""),
        date: String(f.date ?? ""),
        completedAt: Number(f.completedAt ?? 0) || 0,
        position: Number(f.position ?? 0) || 0,
        lessonNumber: Number(f.lessonNumber ?? 0) || 0,
      }))
      // Primero quien marcó más temprano: así se lee como la fila del madrugador.
      .sort((a, b) => a.completedAt - b.completedAt);

    return json({ fecha, ranking: lista });
  }),
});
