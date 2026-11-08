"use strict";

/**
 * Identidad: seguimos usando el LOGIN CON GOOGLE de Firebase.
 *
 * Lo único que hace este archivo es comprobar que el "pase" (el token) que
 * manda el navegador lo emitió de verdad Google para NUESTRO proyecto, y que no
 * está vencido. Se verifica con las llaves PÚBLICAS de Google, así que aquí no
 * hace falta ninguna clave secreta de Firebase.
 *
 * Por qué importa: sin esto, cualquiera podría pedirle a la API los datos de
 * otra persona simplemente escribiendo su identificador.
 */

const crypto = require("crypto");

const PROYECTO = process.env.FIREBASE_PROJECT_ID || "curso-milagros-2026";
const EMISOR = `https://securetoken.google.com/${PROYECTO}`;
const URL_LLAVES =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

/** Las llaves públicas de Google cambian cada pocas horas; se guardan mientras valgan. */
let llaves = null;
let llavesHasta = 0;

/**
 * No poder leer las llaves NO es lo mismo que un pase falso. Antes los dos
 * terminaban en «sin sesión» (401): un tropiezo de red con Google se veía como
 * si la persona no hubiera entrado. Ahora, si hay llaves de antes se siguen
 * usando un rato, y si no hay ninguna se responde «no pude verificar» (503),
 * que el celular trata como un fallo pasajero y reintenta.
 */
class SinVerificar extends Error {}

async function obtenerLlaves() {
  const ahora = Date.now();
  if (llaves && ahora < llavesHasta) return llaves;

  let res;
  try {
    res = await fetch(URL_LLAVES, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`llaves de Google: ${res.status}`);
  } catch (err) {
    if (llaves) return llaves; // las de antes valen mientras Google responde
    throw new SinVerificar(String(err && err.message ? err.message : err));
  }
  const datos = await res.json();

  // Google dice en la cabecera cuánto duran; si no, una hora.
  const cc = res.headers.get("cache-control") || "";
  const m = cc.match(/max-age=(\d+)/);
  const segundos = m ? Number(m[1]) : 3600;

  llaves = datos;
  llavesHasta = ahora + Math.max(60, segundos - 60) * 1000;
  return llaves;
}

function base64UrlADato(texto) {
  return Buffer.from(String(texto).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Comprueba el token y devuelve quién es. Si algo no cuadra, devuelve null:
 * nunca lanza, para que la API responda 401 limpio y no un error de servidor.
 */
async function verificarToken(token) {
  try {
    if (typeof token !== "string") return null;
    const partes = token.split(".");
    if (partes.length !== 3) return null;

    const cabecera = JSON.parse(base64UrlADato(partes[0]).toString("utf8"));
    const cuerpo = JSON.parse(base64UrlADato(partes[1]).toString("utf8"));

    // 1) Firmado como debe ser, y con una llave que Google reconoce.
    if (cabecera.alg !== "RS256" || !cabecera.kid) return null;
    const mapa = await obtenerLlaves();
    const certificado = mapa[cabecera.kid];
    if (!certificado) return null;

    const verificador = crypto.createVerify("RSA-SHA256");
    verificador.update(`${partes[0]}.${partes[1]}`);
    if (!verificador.verify(certificado, base64UrlADato(partes[2]))) return null;

    // 2) Emitido para NUESTRO proyecto, por Google, y todavía vigente.
    const ahora = Math.floor(Date.now() / 1000);
    if (cuerpo.aud !== PROYECTO) return null;
    if (cuerpo.iss !== EMISOR) return null;
    if (typeof cuerpo.exp !== "number" || cuerpo.exp <= ahora) return null;
    if (typeof cuerpo.iat !== "number" || cuerpo.iat > ahora + 300) return null;
    if (!cuerpo.sub || typeof cuerpo.sub !== "string") return null;

    return {
      uid: cuerpo.sub,
      email: String(cuerpo.email || "").toLowerCase(),
      emailVerificado: Boolean(cuerpo.email_verified),
      nombre: String(cuerpo.name || ""),
      foto: String(cuerpo.picture || ""),
    };
  } catch (err) {
    if (err instanceof SinVerificar) throw err;
    return null;
  }
}

/**
 * Saca el pase de la peticion.
 *
 * OJO, esto es importante: Azure Static Web Apps SUSTITUYE la cabecera
 * `Authorization` por su propio testigo interno antes de entregarnos la
 * peticion. Si el navegador manda ahi el pase de Google, nunca llega y la API
 * rechaza a todo el mundo con un 401 que parece correcto desde fuera.
 *
 * Por eso el pase viaja en una cabecera PROPIA (`x-pase`). Se sigue mirando
 * `Authorization` de respaldo, por si algun dia se llama a la API desde fuera
 * de Static Web Apps.
 */
async function quienLlama(request) {
  const propia = (request.headers.get("x-pase") || "").trim();
  if (propia) {
    const persona = await verificarToken(propia);
    if (persona) return persona;
  }

  const cabecera = request.headers.get("authorization") || "";
  if (!cabecera.startsWith("Bearer ")) return null;
  return verificarToken(cabecera.slice(7).trim());
}

module.exports = { verificarToken, quienLlama, PROYECTO, SinVerificar };
