"use strict";

/**
 * Rutas de PERSONAS.
 *
 *   GET   /api/yo                 mi perfil (lo crea la primera vez)
 *   PATCH /api/yo                 completar/editar MIS datos
 *   POST  /api/yo/actividad       "sigo por aquí" (última actividad)
 *   GET   /api/usuarios           lista de todas (solo admin)
 *   PATCH /api/usuarios/{uid}     cambiar rol/plan/inscripción (solo admin)
 *
 * Regla que antes ponía Firestore y ahora hay que sostener aquí: nadie puede
 * cambiarse a sí mismo el rol, el plan, ni si está inscrito. Eso es solo del
 * admin. Por eso `PATCH /api/yo` ignora esos campos aunque lleguen.
 */

const { app } = require("@azure/functions");
const {
  json,
  noEncontrado,
  malaPeticion,
  manejar,
  cuerpoJson,
} = require("../shared/http");
const {
  P,
  nLeccion,
  leerUno,
  leerParticion,
  leerTodo,
  guardar,
  guardarLote,
} = require("../shared/tablas");

const TOTAL_LECCIONES = 365;

function acotarLeccion(n) {
  const v = Math.trunc(Number(n) || 1);
  return Math.min(Math.max(v, 1), TOTAL_LECCIONES);
}

/** Da forma completa al perfil: los campos que falten toman su valor de siempre. */
function aPerfil(uid, d) {
  return {
    uid,
    displayName: String(d.displayName ?? "Caminante"),
    email: String(d.email ?? ""),
    photoURL: d.photoURL ?? null,
    role: d.role === "admin" ? "admin" : "user",
    fullName: String(d.fullName ?? ""),
    country: String(d.country ?? ""),
    phone: String(d.phone ?? ""),
    profileComplete: Boolean(d.profileComplete),
    // Los perfiles antiguos no traían el campo: cuentan como inscritos.
    enrolled: d.enrolled !== false,
    voiceReader: Boolean(d.voiceReader),
    plan: d.plan === "ordinario" ? "ordinario" : "pro",
    grupo: String(d.grupo ?? ""),
    rankDias: Number(d.rankDias ?? 0),
    rankSumaPuesto: Number(d.rankSumaPuesto ?? 0),
    rankSumaMinuto: Number(d.rankSumaMinuto ?? 0),
    createdAt: Number(d.createdAt ?? 0),
    lastLoginAt: Number(d.lastLoginAt ?? 0),
    lastActivityAt: Number(d.lastActivityAt ?? 0),
    currentLesson: acotarLeccion(d.currentLesson ?? 1),
    completedLessonsCount: Number(d.completedLessonsCount ?? 0),
    lastCompletedAt: Number(d.lastCompletedAt ?? 0),
    /*
     * Cuántas lleva hoy, para que la pantalla pueda avisar del tope ANTES de
     * que toque el botón. Solo vale si es de hoy: si la copia guardada es de
     * ayer, hoy lleva cero. Sin esta comprobación, alguien que hizo tres ayer
     * se encontraría hoy con el aviso de "ya no te quedan".
     *
     * Quien manda de verdad es el servidor al marcar (ver MAXIMO_POR_DIA en
     * avance.js), que lo recalcula de las fechas reales. Esto es solo el aviso.
     */
    hechasHoy: String(d.hechasHoyFecha ?? "") === fechaBogota()
      ? Number(d.hechasHoy ?? 0)
      : 0,
  };
}

/**
 * El día de hoy en Colombia, en formato "2026-09-16".
 *
 * Colombia no mueve la hora en ningún mes, así que basta con restar cinco horas
 * y no dependemos de que la máquina de Azure tenga la tabla de husos horarios.
 * (La misma cuenta vive en `avance.js`, que es quien escribe la fecha.)
 */
function fechaBogota() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Mantiene el nombre visible en el directorio que ven los compañeros. */
async function guardarNombreEnDirectorio(uid, nombre) {
  const limpio = String(nombre || "").trim().slice(0, 60);
  if (!limpio) return;
  try {
    await guardar("directorio", P.directorio(), uid, { nombre: limpio });
  } catch {
    /* el directorio es un extra: si falla, no rompe el registro */
  }
}

// ------------------------------------------------------------------ GET /yo
app.http("yoLeer", {
  route: "yo",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (_req, _ctx, { persona, ciclo }) => {
    const ahora = Date.now();
    const existente = await leerUno("users", P.users(), persona.uid);

    if (!existente) {
      // Primera vez que entra: nace como participante normal, nunca como admin.
      const nuevo = {
        displayName: persona.nombre || "Caminante",
        email: persona.email,
        photoURL: persona.foto || null,
        role: "user",
        fullName: persona.nombre || "",
        country: "",
        phone: "",
        profileComplete: false,
        enrolled: true,
        voiceReader: false,
        plan: "ordinario",
        createdAt: ahora,
        lastLoginAt: ahora,
        lastActivityAt: ahora,
        currentLesson: 1,
        completedLessonsCount: 0,
        lastCompletedAt: 0,
      };
      await guardar("users", P.users(), persona.uid, nuevo);
      return json(aPerfil(persona.uid, nuevo));
    }

    // Ya existía: solo se refrescan los datos que vienen de Google.
    const refresco = {
      displayName: persona.nombre || existente.displayName || "Caminante",
      photoURL: persona.foto || existente.photoURL || null,
      email: persona.email || existente.email || "",
      lastLoginAt: ahora,
      lastActivityAt: ahora,
    };
    await guardar("users", P.users(), persona.uid, refresco);
    await guardarNombreEnDirectorio(
      persona.uid,
      existente.fullName || existente.displayName || persona.nombre,
    );
    return json(aPerfil(persona.uid, { ...existente, ...refresco }));
  }),
});

// ---------------------------------------------------------------- PATCH /yo
app.http("yoEditar", {
  route: "yo",
  methods: ["PATCH"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (req, _ctx, { persona, perfil, ciclo }) => {
    const body = await cuerpoJson(req);
    const ahora = Date.now();

    const fullName = String(body.fullName ?? perfil?.fullName ?? "").trim().slice(0, 80);
    const country = String(body.country ?? perfil?.country ?? "").trim().slice(0, 60);
    const phone = String(body.phone ?? perfil?.phone ?? "").trim().slice(0, 30);

    const cambios = {
      fullName,
      displayName: fullName || "Caminante",
      country,
      phone,
      lastActivityAt: ahora,
    };

    // Solo al COMPLETAR el registro por primera vez se acepta "voy en la lección N",
    // y se dan por hechas las anteriores. Después ya no, para que nadie se
    // reescriba el avance entero desde el navegador.
    const yaCompleto = Boolean(perfil?.profileComplete);
    if (!yaCompleto) {
      const inicio = acotarLeccion(body.startLesson ?? 1);
      cambios.profileComplete = true;
      cambios.currentLesson = inicio;
      cambios.completedLessonsCount = inicio - 1;

      if (inicio > 1) {
        const filas = [];
        for (let n = 1; n < inicio; n++) {
          filas.push({
            fila: nLeccion(n),
            datos: {
              userId: persona.uid,
              ciclo,
              lessonNumber: n,
              completed: true,
              // SIN fecha, y no por descuido: no sabemos qué día hizo cada una
              // de estas, porque las hizo antes de llegar aquí. Ponerles la de
              // hoy sería inventarlo, y además las contaría todas como hechas
              // HOY: el tope diario saltaría al instante y no podría marcar la
              // suya el mismo día que se registra.
              completedAt: null,
            },
          });
        }
        await guardarLote(
          "progress",
          P.progress(ciclo, persona.uid),
          filas,
        );
      }
    }

    await guardar("users", P.users(), persona.uid, cambios);
    await guardarNombreEnDirectorio(persona.uid, fullName);

    const actualizado = await leerUno("users", P.users(), persona.uid);
    return json(aPerfil(persona.uid, actualizado || {}));
  }),
});

// ------------------------------------------------ PUT /yo/leccion-actual
app.http("yoLeccionActual", {
  route: "yo/leccion-actual",
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (req, _ctx, { persona, perfil, ciclo }) => {
    const body = await cuerpoJson(req);
    const destino = acotarLeccion(body.leccion);
    const ahora = Date.now();
    const actual = acotarLeccion(perfil?.currentLesson ?? 1);

    if (destino === actual) return json(aPerfil(persona.uid, perfil || {}));

    const particion = P.progress(ciclo, persona.uid);
    const filas = await leerParticion("progress", particion);
    const yaHechas = new Set(
      filas
        .filter((f) => f.completed === true)
        .map((f) => Number(f.lessonNumber ?? f._fila ?? 0)),
    );

    /*
     * ADELANTAR: "voy en la 60" significa que las 59 anteriores ya están. Se
     * marcan las que falten, SIN tocar las que ya tenían fecha: reescribirlas
     * les cambiaría el día en que de verdad las hizo.
     *
     * Y no se crea puesto en el ranking para ninguna. El ranking premia haber
     * madrugado a hacer la lección; regalarlo a quien solo ajustó un número
     * dejaría la tabla sin significado para todos los demás.
     */
    if (destino > actual) {
      const nuevas = [];
      for (let n = 1; n < destino; n++) {
        if (yaHechas.has(n)) continue;
        nuevas.push({
          fila: nLeccion(n),
          datos: {
            userId: persona.uid,
            ciclo,
            lessonNumber: n,
            completed: true,
            // Sin fecha, por lo mismo que en el registro: no sabemos cuándo las
            // hizo, y fecharlas hoy le gastaría el cupo del día.
            completedAt: null,
          },
        });
        yaHechas.add(n);
      }
      if (nuevas.length) await guardarLote("progress", particion, nuevas);
    }

    /*
     * RETROCEDER: solo se mueve el número. Las lecciones que ya marcó se quedan
     * marcadas, con su fecha y su puesto.
     *
     * Podría parecer más limpio desmarcarlas, pero eso sería borrarle a alguien
     * un trabajo que sí hizo por haber tecleado mal un número. Que sobre
     * información es recuperable; que falte, no.
     */
    await guardar("users", P.users(), persona.uid, {
      currentLesson: destino,
      completedLessonsCount: yaHechas.size,
      lastActivityAt: ahora,
    });

    const actualizado = await leerUno("users", P.users(), persona.uid);
    return json(aPerfil(persona.uid, actualizado || {}));
  }),
});

// ------------------------------------------------------- POST /yo/actividad
app.http("yoActividad", {
  route: "yo/actividad",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (_req, _ctx, { persona, ciclo }) => {
    await guardar("users", P.users(), persona.uid, { lastActivityAt: Date.now() });
    return json({ ok: true });
  }),
});

// ------------------------------------------------------------ GET /usuarios
app.http("usuariosLista", {
  route: "usuarios",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("admin", async (_req, _ctx, { ciclo }) => {
    const filas = await leerTodo("users");
    const lista = filas.map((f) => aPerfil(f._fila, f));
    lista.sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
    return json({ usuarios: lista });
  }),
});

// ----------------------------------------------------- PATCH /usuarios/{uid}
app.http("usuariosEditar", {
  route: "usuarios/{uid}",
  methods: ["PATCH"],
  authLevel: "anonymous",
  handler: manejar("admin", async (req, _ctx, { persona, ciclo }) => {
    const uid = req.params.uid;
    if (!uid) return malaPeticion("falta el identificador");

    const objetivo = await leerUno("users", P.users(), uid);
    if (!objetivo) return noEncontrado();

    const body = await cuerpoJson(req);
    const cambios = {};

    if (typeof body.enrolled === "boolean") cambios.enrolled = body.enrolled;
    if (typeof body.voiceReader === "boolean") cambios.voiceReader = body.voiceReader;
    if (body.plan === "pro" || body.plan === "ordinario") cambios.plan = body.plan;

    // El grupo es texto libre a propósito: cada quien nombra sus grupos como
    // le sirva ("Grupo 1", "Martes", "Sede norte"). Se recorta para que no se
    // cuele un texto enorme en la tabla del panel.
    if (typeof body.grupo === "string") {
      cambios.grupo = body.grupo.trim().slice(0, 30);
    }

    // Cambiar roles es lo más delicado: solo la cuenta de la fundación, y nunca
    // sobre sí misma (para no quedarse sin ningún administrador por error).
    if (body.role === "admin" || body.role === "user") {
      const { esAdminPermanente } = require("../shared/http");
      if (!esAdminPermanente(persona.email)) {
        return json({ error: "solo-la-cuenta-principal-cambia-roles" }, 403);
      }
      if (esAdminPermanente(String(objetivo.email || ""))) {
        return json({ error: "la-cuenta-principal-no-se-puede-degradar" }, 403);
      }
      cambios.role = body.role;
    }

    if (Object.keys(cambios).length === 0) return malaPeticion("nada que cambiar");

    await guardar("users", P.users(), uid, cambios);
    const actualizado = await leerUno("users", P.users(), uid);
    return json(aPerfil(uid, actualizado || {}));
  }),
});
