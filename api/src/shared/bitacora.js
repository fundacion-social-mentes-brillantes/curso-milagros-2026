"use strict";

/**
 * BITÁCORA DE MARCAS: un renglón por cada marca que llega al servidor (y por
 * cada aviso que el celular manda sobre una marca que no pudo guardar).
 *
 * Por qué existe: el 8-nov-2026 a Sebastián le faltaban lecciones de varios
 * días y NO HABÍA FORMA de saber si la marca salió de su celular, si llegó y
 * se rechazó, o si nunca la hizo. La API no guardaba ningún registro. Con esto,
 * la próxima vez se mira la tabla y se sabe.
 *
 * Partición: el día en Bogotá ("2026-11-08"). Fila: la hora en milisegundos
 * más un pedazo al azar, así se lee en orden. Sin correo ni nombre: solo el
 * uid, la lección, cómo llegó y qué se respondió.
 *
 * Nunca tumba la petición: si la bitácora falla, la marca sigue su camino.
 */

const crypto = require("crypto");
const { guardar } = require("./tablas");

const fechaBogota = (ms) => new Date(ms - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function anotar(evento, datos = {}) {
  try {
    const ahora = Date.now();
    const fila = `${String(ahora).padStart(15, "0")}-${crypto.randomBytes(3).toString("hex")}`;
    await guardar("bitacora", fechaBogota(ahora), fila, { evento, en: ahora, ...datos });
  } catch {
    /* la bitácora es para entender fallos, nunca para causarlos */
  }
}

/** Lo que vale la pena saber de cómo llamó, sin datos personales. */
function rastroDe(req, extra = {}) {
  return {
    ua: String(req.headers.get("user-agent") || "").slice(0, 180),
    ...extra,
  };
}

module.exports = { anotar, rastroDe };
