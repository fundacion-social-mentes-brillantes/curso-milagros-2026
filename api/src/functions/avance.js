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
  crear,
  odata,
} = require("../shared/tablas");

const TOTAL_LECCIONES = 365;

/**
 * CUÁNTAS LECCIONES SE PUEDEN HACER EN UN DÍA.
 *
 * El Curso pide una al día y repetir esa idea durante toda la jornada; hacer
 * diez seguidas es leerlas, no practicarlas. Pero tampoco se puede ser rígido:
 * quien se atrasa unos días necesita poder alcanzar al grupo sin sentir que ya
 * lo perdió todo. Tres es el término medio: deja ponerse al día sin convertir
 * el proceso en una carrera.
 *
 * Esto se comprueba AQUÍ, en el servidor, no en la pantalla. Un tope que solo
 * vive en el navegador no es un tope: cualquiera lo salta recargando.
 *
 * El mismo número está en `src/config/site.ts` para que la pantalla pueda
 * avisar antes de que la persona toque el botón. Si se cambia uno, cambiar el
 * otro.
 */
const MAXIMO_POR_DIA = 3;
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

/**
 * CUÁNDO SE MARCÓ DE VERDAD LA LECCIÓN.
 *
 * El celular anota la marca con su hora y, si no hay señal o el servidor está
 * dormido, la vuelve a mandar después (ver src/lib/marcas-pendientes.ts). Esa
 * hora es la que cuenta: quien hizo la lección el martes a las 8 a. m. y no
 * tenía conexión, la hizo el martes, aunque llegue el miércoles.
 *
 * Solo se acepta una hora razonable: hasta 3 días atrás (lo que puede durar un
 * celular sin señal) y nunca en el futuro (5 minutos de gracia por relojes
 * desajustados, y aun así se toma la de ahora). Cualquier otra cosa, o si no
 * llega, vale la hora del servidor, como siempre.
 */
const MARCA_MAS_VIEJA = 3 * 24 * 60 * 60 * 1000;
function momentoDeLaMarca(valor, ahora) {
  const v = Number(valor);
  if (!Number.isFinite(v)) return ahora;
  if (v < ahora - MARCA_MAS_VIEJA || v > ahora + 5 * 60 * 1000) return ahora;
  return Math.min(Math.trunc(v), ahora);
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

/**
 * Lee de una vez todo mi avance del ciclo: una sola consulta a mi partición.
 *
 * El ciclo llega SIEMPRE como parámetro. Esta función vive fuera de las rutas,
 * así que no puede verlo por su cuenta: si se le olvida, no da un error claro,
 * revienta con un 500 que no dice nada.
 */
async function misFilas(ciclo, uid) {
  const filas = await leerParticion("progress", P.progress(ciclo, uid));
  return filas.map(aAvance).sort((a, b) => a.lessonNumber - b.lessonNumber);
}

// --------------------------------------------------------------- GET /avance
app.http("avanceLista", {
  route: "avance",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (_req, _ctx, { persona, ciclo }) => {
    return json({ avance: await misFilas(ciclo, persona.uid) });
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
    const hoy = relojBogota(ahora).fecha;
    // El día en que se hizo la lección (casi siempre hoy; ver momentoDeLaMarca).
    const marcadaEn = momentoDeLaMarca(body.marcadaEn, ahora);
    const diaDeLaMarca = relojBogota(marcadaEn).fecha;
    const hechasEl = (filas, dia) =>
      filas.filter(
        (f) => f.completed === true && f.completedAt && relojBogota(Number(f.completedAt)).fecha === dia,
      ).length;

    // 1. Se lee el avance ANTES de tocar nada: hace falta para saber cuántas
    //    lleva ese día, y hay que saberlo antes de escribir o el tope llegaría tarde.
    const filasAntes = await leerParticion("progress", particion);
    const hechasEseDia = hechasEl(filasAntes, diaDeLaMarca);
    const filaVieja = filasAntes.find((f) => Number(f.lessonNumber ?? f._fila ?? 0) === n);
    const yaEstabaHecha = filaVieja?.completed === true;

    // 2. El tope del día. Solo cuenta al marcar una lección que NO estaba ya
    //    hecha: volver a marcar la misma no gasta un cupo, y desmarcar lo
    //    devuelve (la cuenta sale de las fechas, así que se corrige sola).
    if (completed && !yaEstabaHecha && hechasEseDia >= MAXIMO_POR_DIA) {
      return json(
        { error: "limite-diario", hechasHoy: hechasEseDia, maximo: MAXIMO_POR_DIA },
        429,
      );
    }

    // 3. La fila de la lección. Se mezcla, así que una nota escrita antes sigue ahí.
    //    Si ya estaba hecha (por ejemplo, un reintento cuya respuesta se perdió),
    //    conserva su hora: volver a mandarla no la cambia de día.
    const completedAt = !completed
      ? null
      : yaEstabaHecha && Number(filaVieja.completedAt)
        ? Number(filaVieja.completedAt)
        : marcadaEn;
    await guardar("progress", particion, nLeccion(n), {
      userId: persona.uid,
      ciclo,
      lessonNumber: n,
      completed,
      completedAt,
    });

    // 4. El contador de hechas se recuenta, no se suma uno: si alguien marca dos
    //    veces la misma lección, el número sigue siendo el verdadero.
    const filas = await leerParticion("progress", particion);
    const completadas = filas.filter((f) => f.completed === true).length;
    const hechasHoy = hechasEl(filas, hoy);

    // 5. La lección actual SOLO sube (ver regla 2 de arriba).
    const actual = acotarLeccion(perfil?.currentLesson ?? 1);
    const cambios = {
      completedLessonsCount: completadas,
      currentLesson: completed ? Math.max(actual, acotarLeccion(n + 1)) : actual,
      lastActivityAt: ahora,
      // Copia de la cuenta del día en el perfil. El tope de arriba NO depende de
      // esto —se calcula de las fechas reales, que nunca mienten—; esto existe
      // solo para que la pantalla pueda avisar "te queda 1 hoy" sin tener que
      // leer el avance entero cada vez que se abre una lección.
      hechasHoy,
      hechasHoyFecha: hoy,
    };
    // 6. La fecha de "última lección hecha" solo se toca al completar; al
    //    desmarcar no se borra, porque sirve para saber quién sigue caminando.
    //    Una marca que llega tarde no la hace retroceder.
    if (completed) {
      cambios.lastCompletedAt = Math.max(Number(perfil?.lastCompletedAt ?? 0) || 0, completedAt);
    }
    await guardar("users", P.users(), persona.uid, cambios);

    // 7. El puesto en esta lección. Todo lo que sigue es un extra: si falla, la
    //    lección ya quedó marcada arriba y la persona no pierde nada.
    let position = null;

    // 8. La cuenta de gestión de la fundación no compite: no es participante.
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
          // Fecha y minuto de cuando se HIZO, no de cuando llegó al servidor.
          const { fecha, minuto } = relojBogota(completedAt);
          // El puesto es "cuántos llegaron antes, más uno". Contar la partición
          // es una consulta directa: son solo las filas de ESTA lección.
          position = (await contarParticion("dailyDone", particionDia)) + 1;

          // Sin el nombre a propósito: era un dato personal que cualquiera con
          // sesión podía leer. El nombre visible vive en el directorio.
          // Se CREA (no se sobrescribe): si un reintento se cruzó con el envío
          // original y este ya la escribió, gana el primero y no se suma dos
          // veces al acumulado de abajo.
          const nuevo = await crear("dailyDone", particionDia, persona.uid, {
            uid: persona.uid,
            ciclo,
            date: fecha,
            completedAt,
            position,
            lessonNumber: n,
          });
          if (!nuevo) {
            const ya = await leerUno("dailyDone", particionDia, persona.uid);
            return json({ position: Number(ya?.position ?? 0) || null, hechasHoy, maximo: MAXIMO_POR_DIA });
          }

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

    return json({ position, hechasHoy, maximo: MAXIMO_POR_DIA });
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
    const filas = await misFilas(ciclo, persona.uid);
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
