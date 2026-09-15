"use strict";

/**
 * EL CICLO — el año del curso que se está corriendo ("2026", "2027"…).
 *
 * Por qué esto vive en UN SOLO sitio y todas las rutas lo piden aquí:
 *
 * El ciclo forma parte de la partición donde se guarda cada avance
 * (`2026|uidAna`). Si una ruta lo resolviera por su cuenta y se equivocara, no
 * daría ningún error: simplemente escribiría en otro cajón, y la persona vería
 * su avance desaparecer. Es el tipo de fallo que no se nota hasta enero.
 *
 * Por eso: nadie usa `CICLO_POR_DEFECTO` directamente para guardar. Todos
 * llaman a `cicloActivo()`.
 */

const { P, CICLO_POR_DEFECTO, leerUno, guardar } = require("./tablas");

const TABLA = "config";
const FILA = "curso";

/**
 * Se guarda en memoria un rato. Azure reutiliza la misma instancia entre
 * peticiones, así que esto evita una consulta por cada llamada; y un minuto de
 * retraso al cambiar de año no le importa a nadie (pasa una vez al año).
 */
let recordado = null;
let recordadoHasta = 0;
const DURACION_MEMORIA = 60_000;

/** Solo letras, números y guiones: un "/" o un "|" partirían la partición. */
function limpiarCiclo(texto) {
  const limpio = String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9-]/g, "")
    .slice(0, 20);
  return limpio || String(new Date().getFullYear());
}

/** El ciclo que se está corriendo. Si el almacén falla, el de siempre. */
async function cicloActivo() {
  const ahora = Date.now();
  if (recordado && ahora < recordadoHasta) return recordado;

  try {
    const fila = await leerUno(TABLA, P.config(), FILA);
    const valor = String(fila?.ciclo ?? "").trim();
    recordado = valor || CICLO_POR_DEFECTO;
  } catch {
    // Sin conexión con la tabla seguimos sirviendo el ciclo de siempre: es
    // preferible eso a dejar a todo el mundo sin poder marcar su lección.
    recordado = CICLO_POR_DEFECTO;
  }
  recordadoHasta = ahora + DURACION_MEMORIA;
  return recordado;
}

/** (Admin) Cambia el ciclo activo. Arranca un año nuevo sin borrar nada. */
async function fijarCiclo(texto) {
  const limpio = limpiarCiclo(texto);
  await guardar(TABLA, P.config(), FILA, { ciclo: limpio, cambiadoEn: Date.now() });
  recordado = limpio;
  recordadoHasta = Date.now() + DURACION_MEMORIA;
  return limpio;
}

module.exports = { cicloActivo, fijarCiclo, limpiarCiclo };
