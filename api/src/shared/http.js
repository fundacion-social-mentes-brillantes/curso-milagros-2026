"use strict";

/**
 * Piezas comunes de todas las rutas: respuestas, errores y permisos.
 *
 * IMPORTANTE — aquí viven las reglas de seguridad. Antes las aplicaba Firestore
 * solo (firestore.rules); ahora hay que comprobarlas a mano en cada ruta. Si una
 * ruta olvida llamar a `soloAdmin`, queda abierta. Por eso todo pasa por
 * `manejar()`, que exige decir explícitamente qué nivel de acceso pide.
 */

const { quienLlama } = require("./auth");

const ADMINS_PERMANENTES = ["fundacionsocial@gimnasioemocionalmb.com"];

function json(cuerpo, estado = 200) {
  return {
    status: estado,
    jsonBody: cuerpo,
    headers: { "Cache-Control": "no-store" },
  };
}

const noAutorizado = () => json({ error: "sin-sesion" }, 401);
const prohibido = () => json({ error: "sin-permiso" }, 403);
const noEncontrado = () => json({ error: "no-existe" }, 404);
const malaPeticion = (detalle) => json({ error: "peticion-invalida", detalle }, 400);

/** ¿Es la cuenta de gestión de la fundación? (manda siempre) */
function esAdminPermanente(email) {
  return ADMINS_PERMANENTES.includes(String(email || "").toLowerCase());
}

/**
 * Envoltura de toda ruta.
 *
 * `acceso`:
 *   "publico"  → cualquiera
 *   "sesion"   → hay que haber entrado con Google
 *   "admin"    → además, ser administrador
 *
 * Al manejador le llega `{ persona, esAdmin, perfil, ciclo }` ya resuelto, así
 * que dentro de la ruta no hay que volver a pensar en permisos ni en el año.
 *
 * Que el `ciclo` venga de aquí NO es comodidad: es lo que impide que una ruta
 * lo deduzca por su cuenta y acabe escribiendo el avance de alguien en el cajón
 * del año equivocado, que es un fallo silencioso y muy caro de descubrir.
 */
function manejar(acceso, manejador) {
  return async function (request, context) {
    try {
      const { cicloActivo } = require("./ciclo");

      if (acceso === "publico") {
        return await manejador(request, context, {
          persona: null,
          esAdmin: false,
          perfil: null,
          ciclo: await cicloActivo(),
        });
      }

      const persona = await quienLlama(request);
      if (!persona) return noAutorizado();

      // El rol de admin se lee del perfil guardado, NO de lo que diga el
      // navegador: si no, cualquiera se ascendería solo.
      const { leerUno, P } = require("./tablas");
      const perfil = await leerUno("users", P.users(), persona.uid);
      const esAdmin =
        esAdminPermanente(persona.email) || (perfil && perfil.role === "admin");

      if (acceso === "admin" && !esAdmin) return prohibido();

      return await manejador(request, context, {
        persona,
        esAdmin,
        perfil,
        ciclo: await cicloActivo(),
      });
    } catch (err) {
      context.error("fallo en la ruta:", err);
      return json({ error: "fallo-servidor" }, 500);
    }
  };
}

/** Lee el cuerpo JSON sin reventar si viene vacío o mal formado. */
async function cuerpoJson(request) {
  try {
    const t = await request.text();
    if (!t) return {};
    const v = JSON.parse(t);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Número de lección válido (1..365) o null. */
function leccionValida(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 1 || n > 365) return null;
  return Math.trunc(n);
}

module.exports = {
  json,
  noAutorizado,
  prohibido,
  noEncontrado,
  malaPeticion,
  manejar,
  cuerpoJson,
  leccionValida,
  esAdminPermanente,
  ADMINS_PERMANENTES,
};
