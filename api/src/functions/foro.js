"use strict";

/**
 * Rutas del FORO.
 *
 *   GET   /api/foro/{n}        mensajes de esa lección (los que se pueden ver)
 *   POST  /api/foro/{n}        escribir un mensaje o responder a otro
 *   PATCH /api/foro/{n}/{id}   moderar: ocultar, revisar, restaurar, borrar
 *   GET   /api/foro-reciente   lo último de todas las lecciones (solo admin)
 *
 * Regla que antes sostenía Firestore y ahora hay que sostener aquí: el autor de
 * un mensaje (quién es, cómo se llama y su foto) sale SIEMPRE del token ya
 * verificado. Si se copiara del cuerpo de la petición, cualquiera podría
 * publicar firmando con el nombre y la cara de otra persona, y en un foro donde
 * la gente cuenta cosas íntimas eso sería lo más grave que podría pasar.
 *
 * Y al leer, la regla inversa: lo borrado y lo oculto no sale para nadie que no
 * sea admin. El admin sí lo ve todo, porque su panel existe justo para revisar
 * lo que se escondió.
 */

const { app } = require("@azure/functions");
const { randomUUID } = require("crypto");
const {
  json,
  noEncontrado,
  malaPeticion,
  prohibido,
  manejar,
  cuerpoJson,
  leccionValida,
} = require("../shared/http");
const { P, leerUno, leerParticion, leerTodo, guardar } = require("../shared/tablas");

/** Lo que cabe en un mensaje. Si llega más largo se recorta, no se rechaza. */
const LIMITE_MENSAJE = 2000;

/** Cuántos mensajes recientes ve el admin de una sentada. */
const RECIENTES = 50;

const ESTADOS = ["visible", "hidden", "deleted", "reviewed"];

/** Estados que solo ve el admin: para los demás el mensaje no existe. */
const ESCONDIDOS = ["deleted", "hidden"];

/** Da forma al mensaje tal y como lo espera el navegador. */
function aMensaje(id, d) {
  return {
    id,
    lessonNumber: Number(d.lessonNumber ?? 0),
    userId: String(d.userId ?? ""),
    userName: String(d.userName ?? "Caminante"),
    userPhoto: d.userPhoto ?? null,
    message: String(d.message ?? ""),
    createdAt: Number(d.createdAt ?? 0),
    parentId: d.parentId ?? null,
    // Los mensajes antiguos no traían el campo: se dan por visibles.
    status: ESTADOS.includes(d.status) ? d.status : "visible",
  };
}

function sePuedeVer(mensaje, esAdmin) {
  return esAdmin || !ESCONDIDOS.includes(mensaje.status);
}

/**
 * El nombre y la foto con los que se firma.
 *
 * Se prefiere el perfil guardado (es el nombre que la persona escribió al
 * registrarse y el que ve todo el mundo en el ranking) y solo si no hay nada se
 * cae al que venga en el token de Google.
 */
function firmaDe(persona, perfil) {
  const nombre =
    String(perfil?.displayName || perfil?.fullName || persona.nombre || "Caminante")
      .trim()
      .slice(0, 120) || "Caminante";
  const foto = perfil?.photoURL || persona.foto || null;
  return { nombre, foto };
}

// -------------------------------------------------------------- GET /foro/{n}
app.http("foroLeer", {
  route: "foro/{n}",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (req, _ctx, { esAdmin }) => {
    const n = leccionValida(req.params.n);
    if (!n) return malaPeticion("lección fuera de rango");

    // Todos los mensajes de una lección viven en la misma partición, así que
    // esto es una sola consulta directa por muchos mensajes que haya.
    const filas = await leerParticion("forumPosts", P.forum(n));

    const mensajes = filas
      .map((f) => aMensaje(f._fila, f))
      .filter((m) => sePuedeVer(m, esAdmin))
      .sort((a, b) => a.createdAt - b.createdAt); // conversación: lo viejo arriba

    return json({ mensajes });
  }),
});

// ------------------------------------------------------------- POST /foro/{n}
app.http("foroEscribir", {
  route: "foro/{n}",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (req, _ctx, { persona, perfil }) => {
    const n = leccionValida(req.params.n);
    if (!n) return malaPeticion("lección fuera de rango");

    const body = await cuerpoJson(req);

    // Se recorta en vez de rechazar: quien escribió de más no pierde lo escrito.
    const message = String(body.message ?? "").trim().slice(0, LIMITE_MENSAJE);
    if (!message) return malaPeticion("mensaje vacío");

    // Responder a otro mensaje es opcional; el id viaja tal cual, pero acotado
    // para que nadie meta un texto enorme por esta puerta.
    const padre = String(body.parentId ?? "").trim().slice(0, 100);

    const { nombre, foto } = firmaDe(persona, perfil);

    // El id lo pone el servidor. Si lo eligiera el navegador podría escribir
    // encima de un mensaje ajeno con solo repetir su identificador.
    const id = randomUUID();

    const datos = {
      lessonNumber: n,
      userId: persona.uid,
      userName: nombre,
      userPhoto: foto,
      message,
      createdAt: Date.now(),
      parentId: padre || null,
      status: "visible",
    };

    await guardar("forumPosts", P.forum(n), id, datos);
    return json(aMensaje(id, datos), 201);
  }),
});

// ------------------------------------------------------ PATCH /foro/{n}/{id}
app.http("foroModerar", {
  route: "foro/{n}/{id}",
  methods: ["PATCH"],
  authLevel: "anonymous",
  /*
   * Entra cualquiera con sesión, pero no para hacer cualquier cosa:
   *
   *   - el autor puede dejar SU mensaje en "deleted", y nada más. Es suyo y
   *     tiene derecho a retirarlo (es el botón "Borrar" que ve en el foro);
   *   - el admin puede poner cualquier estado en cualquier mensaje, que es lo
   *     que le permite moderar;
   *   - cualquier otra combinación se rechaza. Sin esta comprobación, alguien
   *     podría esconder o "revisar" los mensajes de los demás.
   */
  handler: manejar("sesion", async (req, _ctx, { persona, esAdmin }) => {
    const n = leccionValida(req.params.n);
    if (!n) return malaPeticion("lección fuera de rango");

    const id = String(req.params.id || "");
    if (!id) return malaPeticion("falta el identificador");

    const body = await cuerpoJson(req);
    const status = String(body.status ?? "");
    if (!ESTADOS.includes(status)) return malaPeticion("estado desconocido");

    const existente = await leerUno("forumPosts", P.forum(n), id);
    if (!existente) return noEncontrado();

    const esMio = String(existente.userId || "") === persona.uid;
    if (!esAdmin && !(esMio && status === "deleted")) return prohibido();

    // Solo se toca el estado: el texto y el autor quedan como estaban, para que
    // moderar no pueda convertirse en reescribir lo que alguien dijo.
    await guardar("forumPosts", P.forum(n), id, { status });
    return json(aMensaje(id, { ...existente, status }));
  }),
});

// ------------------------------------------------------- GET /foro-reciente
app.http("foroReciente", {
  route: "foro-reciente",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("admin", async () => {
    /*
     * OJO: esto recorre la tabla ENTERA, que es lo más caro que se puede hacer
     * aquí. Se acepta porque es la única forma de ver "lo último de todas las
     * lecciones" sin guardar un índice aparte, y porque solo entra el admin, de
     * vez en cuando, desde su panel de moderación. Ninguna ruta de participante
     * debe hacer esto nunca.
     */
    const filas = await leerTodo("forumPosts");

    const mensajes = filas
      .map((f) => aMensaje(f._fila, f))
      .sort((a, b) => b.createdAt - a.createdAt) // lo más nuevo primero
      .slice(0, RECIENTES);

    return json({ mensajes });
  }),
});
