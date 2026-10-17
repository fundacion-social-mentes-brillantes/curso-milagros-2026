"use strict";

/**
 * LA APP DE ANDROID: el widget «Lección de hoy» y el recordatorio diario.
 *
 *   POST   /api/app/codigo       pide un código para vincular el celular   (sesión)
 *   POST   /api/app/canjear      la app cambia ese código por su llave      (público)
 *   GET    /api/app/hoy          la lección del día de quien vinculó        (llave de la app)
 *   DELETE /api/app/dispositivo  desvincular este celular                   (llave de la app)
 *
 * Por qué así: el widget y la alarma son partes NATIVAS de la app, corren aunque
 * nadie la abra, y no tienen la sesión de Google (esa vive en Chrome, dentro de
 * la web). Para saber en qué lección va cada persona necesitan su propia llave.
 * La persona la crea una sola vez desde Ajustes: la web pide un código de un
 * solo uso (15 minutos) y se lo pasa a la app, que lo canjea por la llave.
 *
 * La llave solo sirve para LEER la lección del día de esa persona y para
 * borrarse a sí misma: no da acceso a nada más. Se guarda solo su huella
 * (SHA-256), nunca la llave, así que ni leyendo la tabla se puede suplantar a
 * nadie. Viaja en la cabecera PROPIA `x-app-llave`: Azure Static Web Apps pisa
 * la cabecera `Authorization` con su testigo interno.
 */

const crypto = require("node:crypto");
const { app } = require("@azure/functions");
const { leerUno, guardar, borrar, P } = require("../shared/tablas");
const { manejar, json, cuerpoJson, malaPeticion } = require("../shared/http");
const { leccionDelDia, fechaBogota, cargarIdeas, ideaDe } = require("./recordatorio");

const TABLA = "appandroid";
const CODIGOS = "c";
const DISPOSITIVOS = "d";
const VIGENCIA_CODIGO = 15 * 60 * 1000;

const azar = (bytes) => crypto.randomBytes(bytes).toString("base64url");
const huella = (llave) => crypto.createHash("sha256").update(String(llave)).digest("hex");
const sinLlave = () => json({ error: "sin-vincular" }, 401);

/** ¿Quién es el dueño de esta llave? (null si no existe o la desvincularon) */
async function duenoDeLlave(request) {
  const llave = (request.headers.get("x-app-llave") || "").trim();
  if (llave.length < 20) return null;
  const fila = await leerUno(TABLA, DISPOSITIVOS, huella(llave));
  return fila ? { uid: String(fila.uid), fila: huella(llave) } : null;
}

// ------------------------------------------------------- POST /app/codigo
app.http("appCodigo", {
  route: "app/codigo",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (_req, _ctx, { persona }) => {
    const codigo = azar(18);
    await guardar(TABLA, CODIGOS, codigo, {
      uid: persona.uid,
      expira: Date.now() + VIGENCIA_CODIGO,
    });
    return json({ codigo, expira: Date.now() + VIGENCIA_CODIGO });
  }),
});

// ------------------------------------------------------ POST /app/canjear
app.http("appCanjear", {
  route: "app/canjear",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: manejar("publico", async (req) => {
    const body = await cuerpoJson(req);
    const codigo = String(body.codigo ?? "").trim();
    if (!codigo || codigo.length > 64) return malaPeticion("falta el código");

    const guardado = await leerUno(TABLA, CODIGOS, codigo);
    // Un solo uso: se borra en cuanto se lee, sirva o no.
    if (guardado) await borrar(TABLA, CODIGOS, codigo);
    if (!guardado || Number(guardado.expira ?? 0) < Date.now()) {
      return json({ error: "codigo-vencido" }, 410);
    }

    const perfil = await leerUno("users", P.users(), String(guardado.uid));
    if (!perfil) return json({ error: "sin-cuenta" }, 404);

    const llave = azar(32);
    await guardar(TABLA, DISPOSITIVOS, huella(llave), {
      uid: String(guardado.uid),
      celular: String(body.celular ?? "").slice(0, 80),
      creado: Date.now(),
      ultimoUso: Date.now(),
    });
    const nombre = String(perfil.fullName || perfil.displayName || "").trim().split(/\s+/)[0] || "";
    return json({ llave, nombre });
  }),
});

// ------------------------------------------------------------ GET /app/hoy
app.http("appHoy", {
  route: "app/hoy",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("publico", async (req, _ctx, { ciclo }) => {
    const dueno = await duenoDeLlave(req);
    if (!dueno) return sinLlave();
    const usuario = await leerUno("users", P.users(), dueno.uid);
    if (!usuario) return sinLlave();

    const hoy = fechaBogota(Date.now());
    const actual = Math.min(Math.max(Number(usuario.currentLesson ?? 1), 1), 365);
    const numero = await leccionDelDia(usuario, ciclo, hoy);
    const marcoHoy =
      Number(usuario.lastCompletedAt ?? 0) > 0 && fechaBogota(Number(usuario.lastCompletedAt)) === hoy;
    // La de hoy ya está hecha si el número del día quedó atrás de la actual
    // (o, con la 365, si hoy marcó algo).
    const hechaHoy = numero < actual || (numero === 365 && actual === 365 && marcoHoy);

    let ideas = null;
    try {
      ideas = await cargarIdeas();
    } catch {
      /* sin ideas la app muestra solo el número */
    }
    const idea = (n) => (ideas ? ideaDe(ideas, n).idea : "");

    // Cuenta de uso sin bloquear la respuesta si falla.
    guardar(TABLA, DISPOSITIVOS, dueno.fila, { ultimoUso: Date.now() }).catch(() => {});

    return json({
      fecha: hoy,
      hoy: { numero, idea: idea(numero), hecha: hechaHoy },
      // Lo que le tocará después de la medianoche si no marca nada más: el
      // widget lo usa para cambiar solo aunque a esa hora no haya internet.
      manana: { numero: actual, idea: idea(actual) },
    });
  }),
});

// ------------------------------------------------- DELETE /app/dispositivo
app.http("appDesvincular", {
  route: "app/dispositivo",
  methods: ["DELETE"],
  authLevel: "anonymous",
  handler: manejar("publico", async (req) => {
    const dueno = await duenoDeLlave(req);
    if (dueno) await borrar(TABLA, DISPOSITIVOS, dueno.fila);
    return json({ ok: true });
  }),
});
