"use strict";

/**
 * GRUPOS: su fecha de arranque y hasta dónde van hoy.
 *
 *   GET /api/grupos    qué grupos tienen fecha y en qué lección van (con sesión)
 *   PUT /api/grupos    poner o cambiar la fecha de arranque de uno (solo admin)
 *
 * Leer lo puede cualquiera con sesión, y no es un descuido: la persona necesita
 * ver su propio techo ("tu grupo va en la 113") para entender por qué no puede
 * escribir un número más alto. Aquí no hay datos de nadie, solo nombres de
 * grupo y fechas.
 */

const { app } = require("@azure/functions");
const { json, malaPeticion, manejar } = require("../shared/http");
const {
  fechasDeGrupos,
  leccionDeGrupo,
  guardarFechaDeGrupo,
  hoyBogota,
} = require("../shared/grupos");

// ---------------------------------------------------------------- GET /grupos
app.http("gruposLista", {
  route: "grupos",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("sesion", async () => {
    const fechas = await fechasDeGrupos();
    const hoy = hoyBogota();
    const grupos = Object.entries(fechas)
      .map(([nombre, inicio]) => ({
        nombre,
        inicio,
        leccionHoy: leccionDeGrupo(inicio, hoy),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return json({ grupos, hoy });
  }),
});

// ---------------------------------------------------------------- PUT /grupos
app.http("gruposGuardar", {
  route: "grupos",
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: manejar("admin", async (req) => {
    const { cuerpoJson } = require("../shared/http");
    const body = await cuerpoJson(req);

    const guardado = await guardarFechaDeGrupo(body.nombre, body.inicio);
    if (!guardado) {
      return malaPeticion("hace falta el nombre del grupo y una fecha como 2026-06-22");
    }

    return json({
      ...guardado,
      leccionHoy: leccionDeGrupo(guardado.inicio),
    });
  }),
});
