"use strict";

/**
 * LOS GRUPOS Y SU FECHA DE ARRANQUE.
 *
 * De aquí sale la respuesta a "¿en qué lección va este grupo hoy?", y con ella
 * el techo de hasta dónde puede adelantarse alguien.
 *
 * La cuenta es pura fecha: si el grupo empezó la lección 1 el 22 de junio, hoy
 * le toca la que diga el calendario, mañana la siguiente. No se mira lo que
 * haya hecho la gente. Podría sonar más justo mirar por dónde va la mayoría de
 * verdad, pero entonces el techo subiría y bajaría según quién marcara ese día,
 * y nadie podría saber de antemano hasta dónde puede llegar. Con la fecha, el
 * número es el mismo para todos y se puede decir en voz alta.
 *
 * Dónde se guarda: en la tabla `config`, partición "grupos", una fila por
 * grupo. No hace falta tabla nueva, y `config` ya existe desde el primer día.
 *
 * El grupo se identifica por su nombre tal cual lo escribió el admin ("Grupo 1",
 * "Martes"). Quien no tiene grupo cae en SIN_GRUPO, que se trata como uno más:
 * así hay UNA sola manera de poner fechas, y no dos caminos que mantener.
 */

const { leerParticion, guardar, clave } = require("./tablas");

const TABLA = "config";
const PARTICION = "grupos";
const TOTAL_LECCIONES = 365;

/** Para quien todavía no tiene grupo asignado. */
const SIN_GRUPO = "General";

/** Cinco horas menos que el reloj universal, todo el año. Ver `relojBogota`. */
function hoyBogota() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** ¿Es una fecha "2026-06-22" de verdad, y no un 31 de febrero? */
function fechaValida(texto) {
  const t = String(texto || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? null : t;
}

/**
 * En qué lección va un grupo que empezó la lección 1 en `inicio`.
 *
 * El día del arranque es la lección 1, no la 0. Si la fecha es futura devuelve
 * 1: el grupo todavía no ha empezado, así que nadie puede adelantarse a nada.
 */
function leccionDeGrupo(inicio, hoy = hoyBogota()) {
  const desde = fechaValida(inicio);
  if (!desde) return null; // sin fecha no hay techo que calcular
  const dias = Math.floor(
    (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000,
  );
  return Math.min(Math.max(dias + 1, 1), TOTAL_LECCIONES);
}

/** El nombre de grupo de una persona, ya normalizado. */
function grupoDe(perfil) {
  return String(perfil?.grupo ?? "").trim() || SIN_GRUPO;
}

/** Todos los grupos con fecha guardada: { "Grupo 1": "2026-06-22", ... } */
async function fechasDeGrupos() {
  const filas = await leerParticion(TABLA, PARTICION);
  const fuera = {};
  for (const f of filas) {
    const nombre = String(f.nombre ?? "").trim();
    const inicio = fechaValida(f.inicio);
    if (nombre && inicio) fuera[nombre] = inicio;
  }
  return fuera;
}

/**
 * Hasta qué lección puede llegar quien pertenece a este grupo.
 * `null` = el grupo no tiene fecha puesta, así que no hay techo que aplicar.
 */
async function techoDelGrupo(nombreGrupo) {
  const fechas = await fechasDeGrupos();
  const inicio = fechas[nombreGrupo];
  return inicio ? leccionDeGrupo(inicio) : null;
}

async function guardarFechaDeGrupo(nombreGrupo, inicio) {
  const nombre = String(nombreGrupo || "").trim().slice(0, 30);
  const fecha = fechaValida(inicio);
  if (!nombre || !fecha) return null;
  // La fila lleva el nombre dentro además de en la clave: la clave se normaliza
  // (`clave()` quita lo que Table Storage no admite) y se perdería el original.
  await guardar(TABLA, PARTICION, clave(nombre), { nombre, inicio: fecha });
  return { nombre, inicio: fecha };
}

module.exports = {
  SIN_GRUPO,
  TOTAL_LECCIONES,
  hoyBogota,
  fechaValida,
  leccionDeGrupo,
  grupoDe,
  fechasDeGrupos,
  techoDelGrupo,
  guardarFechaDeGrupo,
};
