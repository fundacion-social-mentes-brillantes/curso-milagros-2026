"use strict";

/**
 * Rutas de LECCIONES.
 *
 *   GET /api/lecciones/{n}    público  →  la edición del admin, o 404 si no hay
 *   PUT /api/lecciones/{n}    admin    →  guarda la edición
 *
 * Por qué el GET puede contestar 404 sin que eso sea un fallo: las 365 lecciones
 * viajan DENTRO de la app (public/lessons/*.json). En la base solo se guarda lo
 * que el admin cambió alguna vez. Si aquí no hay nada, el navegador usa su copia
 * y la persona ve su lección igual. Por eso además la ruta es pública: el texto
 * del Curso no es secreto y así la página abre aunque la sesión tarde en cargar.
 *
 * ────────────────────────── REGLA SAGRADA ──────────────────────────
 * `originalText` es el texto del Curso: no se retoca, no se resume, no se
 * "mejora". Todo lo que se escribe alrededor vive aparte, en `commentary`.
 *
 * Para que ni un error del navegador ni un formulario a medio cargar puedan
 * borrarlo, esta ruta SOLO acepta un texto original nuevo cuando viene con
 * contenido de verdad. Si el cuerpo no lo trae —o lo trae vacío— se conserva
 * intacto el que ya estaba guardado. Ver `textoOriginalFinal()`.
 * ───────────────────────────────────────────────────────────────────
 */

const { app } = require("@azure/functions");
const {
  json,
  noEncontrado,
  malaPeticion,
  manejar,
  cuerpoJson,
  leccionValida,
} = require("../shared/http");
const { P, nLeccion, leerUno, guardar } = require("../shared/tablas");

/**
 * Tope de caracteres por campo de texto.
 *
 * Por qué existe: Table Storage no admite un campo de texto de más de 64 KB, y
 * como guarda en UTF-16 (dos bytes por letra) eso son unos 32.000 caracteres.
 * Si se pasara, Azure rechazaría el guardado con un error feo; es más honesto
 * avisar aquí. La lección más larga del Curso ronda los 9.500 caracteres y el
 * comentario más extenso los 11.500, así que 30.000 deja muchísimo margen.
 */
const MAX_TEXTO = 30000;

/** El comentario completo, con todas sus secciones vacías. */
function comentarioVacio() {
  return {
    teachingExplanation: "",
    purpose: "",
    practicalInstructions: [],
    psychological: "",
    spiritual: "",
    courseRelation: "",
    practiceTips: [],
    conclusion: "",
    dailyExamples: [],
    guideExample: { title: "", situation: "", shift: "" },
    finalReflection: "",
    glossary: [],
  };
}

/**
 * Mezcla el comentario que llega con el que ya estaba.
 *
 * Por qué mezclar y no reemplazar: el comentario se guarda como UN solo bloque
 * de texto JSON. Si el panel enviara solo dos secciones y aquí lo guardáramos
 * tal cual, las otras diez desaparecerían. Así, lo que el cuerpo no menciona
 * se queda como estaba, y lo que menciona (aunque sea para dejarlo en blanco)
 * sí se cambia.
 */
function comentarioFusionado(entrante, guardado) {
  const previo = {
    ...comentarioVacio(),
    ...(guardado && typeof guardado === "object" ? guardado : {}),
  };
  const nuevo = entrante && typeof entrante === "object" ? entrante : {};

  const texto = (campo) =>
    typeof nuevo[campo] === "string"
      ? nuevo[campo].trim().slice(0, MAX_TEXTO)
      : String(previo[campo] ?? "");

  // Las listas se limpian de líneas en blanco: el panel las manda como texto
  // partido por saltos de línea y siempre se cuela alguna vacía.
  const lista = (campo) =>
    Array.isArray(nuevo[campo])
      ? nuevo[campo].map((x) => String(x ?? "").trim()).filter(Boolean)
      : Array.isArray(previo[campo])
        ? previo[campo]
        : [];

  const ejemploPrevio = previo.guideExample || {};
  const ejemploNuevo =
    nuevo.guideExample && typeof nuevo.guideExample === "object" ? nuevo.guideExample : {};
  const parteEjemplo = (campo) =>
    typeof ejemploNuevo[campo] === "string"
      ? ejemploNuevo[campo].trim().slice(0, MAX_TEXTO)
      : String(ejemploPrevio[campo] ?? "");

  const glosario = Array.isArray(nuevo.glossary)
    ? nuevo.glossary
        .map((g) => ({
          term: String(g?.term ?? "").trim().slice(0, 200),
          definition: String(g?.definition ?? "").trim().slice(0, 2000),
        }))
        .filter((g) => g.term && g.definition)
    : Array.isArray(previo.glossary)
      ? previo.glossary
      : [];

  return {
    teachingExplanation: texto("teachingExplanation"),
    purpose: texto("purpose"),
    practicalInstructions: lista("practicalInstructions"),
    psychological: texto("psychological"),
    spiritual: texto("spiritual"),
    courseRelation: texto("courseRelation"),
    practiceTips: lista("practiceTips"),
    conclusion: texto("conclusion"),
    dailyExamples: lista("dailyExamples"),
    guideExample: {
      title: parteEjemplo("title"),
      situation: parteEjemplo("situation"),
      shift: parteEjemplo("shift"),
    },
    finalReflection: texto("finalReflection"),
    glossary: glosario,
  };
}

/**
 * EL PUNTO DELICADO: qué texto original queda guardado.
 *
 * Solo se acepta el que viene en el cuerpo si es un texto con contenido. Si no
 * viene, o viene vacío, o viene con otro tipo de dato, se devuelve el que ya
 * estaba. Así, el texto del Curso nunca se pierde por un formulario que cargó
 * a medias o por una petición incompleta.
 */
function textoOriginalFinal(cuerpo, guardada) {
  const anterior = String(guardada?.originalText ?? "");
  if (typeof cuerpo.originalText !== "string") return anterior;
  const entrante = cuerpo.originalText;
  if (!entrante.trim()) return anterior;
  return entrante;
}

/**
 * Solo se reproduce desde YouTube. Si llegara un tipo antiguo (drive, enlace
 * directo) se ignora, igual que hace el navegador.
 */
function videoNormalizado(entrante, guardado) {
  const v =
    entrante && typeof entrante === "object"
      ? entrante
      : guardado && typeof guardado === "object"
        ? guardado
        : {};
  const url = String(v.url ?? "").trim().slice(0, 500);
  if (v.type !== "youtube" || !url) return { type: "none", url: "", status: "soon" };
  return { type: "youtube", url, status: v.status === "available" ? "available" : "soon" };
}

/**
 * Da forma completa a la lección que se devuelve, para que el navegador reciba
 * siempre los mismos campos (los mismos que `toLesson` en src/lib/lessons.ts).
 */
function aLeccion(n, d) {
  const datos = d || {};
  const texto = String(datos.originalText ?? "");
  return {
    id: nLeccion(n),
    number: Number(datos.number ?? n),
    title: String(datos.title ?? ""),
    originalText: texto,
    // Se deduce del texto en vez de creerle a la bandera guardada: si hay
    // texto, está cargado; si no, no. Una bandera desfasada no puede mentir.
    originalTextLoaded: texto.trim().length > 0,
    sourceUrl: String(datos.sourceUrl ?? ""),
    commentary: {
      ...comentarioVacio(),
      ...(datos.commentary && typeof datos.commentary === "object" ? datos.commentary : {}),
    },
    commentaryReady: Boolean(datos.commentaryReady),
    video: videoNormalizado(datos.video, null),
    commonImageUrl: datos.commonImageUrl ?? null,
    createdAt: Number(datos.createdAt ?? 0),
    updatedAt: Number(datos.updatedAt ?? 0),
  };
}

// -------------------------------------------------- GET /api/lecciones/{n}
app.http("leccionLeer", {
  route: "lecciones/{n}",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("publico", async (req) => {
    const n = leccionValida(req.params.n);
    if (n === null) return malaPeticion("numero-de-leccion-invalido");

    const fila = await leerUno("lessons", P.lessons(), nLeccion(n));
    // 404 aquí significa "el admin no ha editado esta lección": el navegador
    // usa entonces su copia estática. No es un error que haya que reportar.
    if (!fila) return noEncontrado();

    return json(aLeccion(n, fila));
  }),
});

// -------------------------------------------------- PUT /api/lecciones/{n}
app.http("leccionGuardar", {
  route: "lecciones/{n}",
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: manejar("admin", async (req) => {
    const n = leccionValida(req.params.n);
    if (n === null) return malaPeticion("numero-de-leccion-invalido");

    const cuerpo = await cuerpoJson(req);
    const fila = nLeccion(n);
    const guardada = await leerUno("lessons", P.lessons(), fila);
    const ahora = Date.now();

    // El texto sagrado: o el nuevo (si trae contenido) o el de siempre.
    const original = textoOriginalFinal(cuerpo, guardada);
    if (original.length > MAX_TEXTO) return malaPeticion("texto-original-demasiado-largo");

    const cambios = {
      number: n,
      originalText: original,
      originalTextLoaded: original.trim().length > 0,
      updatedAt: ahora,
    };
    // La fecha de creación se pone una sola vez, la primera.
    if (!guardada) cambios.createdAt = ahora;

    // Cada campo solo se toca si el cuerpo lo menciona. Lo demás se conserva:
    // el guardado es por mezcla, así que lo que no se envía no se borra.
    if (typeof cuerpo.title === "string") {
      cambios.title = cuerpo.title.trim().slice(0, 300);
    }
    if (typeof cuerpo.sourceUrl === "string") {
      cambios.sourceUrl = cuerpo.sourceUrl.trim().slice(0, 500);
    }
    if ("commonImageUrl" in cuerpo) {
      cambios.commonImageUrl = cuerpo.commonImageUrl
        ? String(cuerpo.commonImageUrl).trim().slice(0, 500)
        : null;
    }
    if (typeof cuerpo.commentaryReady === "boolean") {
      cambios.commentaryReady = cuerpo.commentaryReady;
    }
    if ("video" in cuerpo) {
      cambios.video = videoNormalizado(cuerpo.video, guardada?.video);
    }
    if (cuerpo.commentary && typeof cuerpo.commentary === "object") {
      const comentario = comentarioFusionado(cuerpo.commentary, guardada?.commentary);
      // El comentario entero se guarda como un solo texto JSON: hay que
      // comprobar el tamaño del bloque completo, no el de cada sección.
      if (JSON.stringify(comentario).length > MAX_TEXTO) {
        return malaPeticion("comentario-demasiado-largo");
      }
      cambios.commentary = comentario;
    }

    await guardar("lessons", P.lessons(), fila, cambios);

    // Se relee para devolver exactamente lo que quedó guardado (y no lo que
    // creíamos que iba a quedar).
    const actualizada = await leerUno("lessons", P.lessons(), fila);
    return json(aLeccion(n, actualizada || cambios));
  }),
});
