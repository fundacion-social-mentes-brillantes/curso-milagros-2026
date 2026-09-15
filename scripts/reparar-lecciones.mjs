/**
 * REPARA las lecciones cuyo texto original está mal, usando el libro.
 *
 * La auditoría (`auditar-lecciones.mjs`) encontró cuatro casos reales:
 *
 *   · 135, 136 y 153 → el campo `originalText` NO tiene el texto del Curso,
 *     sino un comentario explicativo que se guardó en el sitio equivocado.
 *     Esas lecciones YA tienen su comentario completo aparte, así que ese
 *     texto está de más ahí; aun así no se borra, se guarda aparte por si se
 *     quiere aprovechar.
 *
 *   · 213 → estaba completamente vacía: sin título, sin texto.
 *
 *   · 359 → el texto está bien, pero se quedó sin título. El título es justo
 *     la frase que se repite durante el día y la que sale en el recordatorio,
 *     así que sin él esa lección queda coja.
 *
 * REGLA DE ORO del proyecto: `originalText` es el texto del Curso y no se
 * toca. Precisamente por eso hay que arreglarlo donde NO es el texto del
 * Curso: hoy esas tres lecciones incumplen la regla sin que se note.
 *
 * Por defecto SIMULA. Para escribir de verdad: --escribir
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const rutaTexto = process.argv[2];
const escribir = process.argv.includes("--escribir");

if (!rutaTexto || rutaTexto.startsWith("--")) {
  console.error("Uso: node scripts/reparar-lecciones.mjs <texto-del-libro.txt> [--escribir]");
  process.exit(1);
}

const CARPETA = "public/lessons";
const COPIAS = "copias-antes-de-reparar";

/** Las lecciones a reparar y qué hay que tocar en cada una. */
const A_REPARAR = [
  { n: 135, texto: true, titulo: true, motivo: "el texto original era un comentario" },
  { n: 136, texto: true, titulo: true, motivo: "el texto original era un comentario" },
  { n: 153, texto: true, titulo: true, motivo: "el texto original era un comentario" },
  { n: 213, texto: true, titulo: true, motivo: "estaba completamente vacía" },
  { n: 359, texto: false, titulo: true, motivo: "le faltaba el título" },
];

// ──────────────────────────────────────────── sacar una lección del libro
const CORTE_SECCION =
  /^\s*(\d+\.\s*¿Qu[eé] (es|soy)|Introducci[oó]n\b|PRIMERA PARTE|SEGUNDA PARTE|LECCIONES FINALES|EP[IÍ]LOGO)/i;

function leerDelLibro(texto) {
  const lineas = texto.split("\n");
  const marcas = [];
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/^\s*LECCI[OÓ]N\s+(\d+)\s*$/);
    if (m) marcas.push({ numero: Number(m[1]), linea: i });
  }

  const salida = new Map();
  for (let i = 0; i < marcas.length; i++) {
    let trozo = lineas.slice(
      marcas[i].linea + 1,
      i + 1 < marcas.length ? marcas[i + 1].linea : lineas.length,
    );
    const corte = trozo.findIndex((l) => CORTE_SECCION.test(l));
    if (corte > 0) trozo = trozo.slice(0, corte);

    // Título: lo primero con contenido, hasta el primer párrafo numerado.
    const tituloPartes = [];
    let j = 0;
    while (j < trozo.length && trozo[j].trim() === "") j++;
    while (j < trozo.length && trozo[j].trim() !== "" && !/^\s*\d+\.\s/.test(trozo[j])) {
      tituloPartes.push(trozo[j].trim());
      j++;
    }

    salida.set(marcas[i].numero, {
      titulo: tituloPartes.join(" ").replace(/\s+/g, " ").trim(),
      cuerpo: limpiarCuerpo(trozo.slice(j)),
    });
  }
  return salida;
}

/**
 * Deja el texto del PDF legible: el PDF parte las frases a mitad de línea y
 * las centra con sangrías enormes. Aquí se vuelven a unir los párrafos y se
 * quita el sangrado, conservando la separación entre párrafos.
 */
function limpiarCuerpo(lineas) {
  const parrafos = [];
  let actual = [];

  for (const cruda of lineas) {
    const l = cruda.trim();
    if (l === "") {
      if (actual.length) parrafos.push(actual.join(" "));
      actual = [];
      continue;
    }
    // Un párrafo nuevo del Curso empieza por "N. "
    if (/^\d+\.\s/.test(l) && actual.length) {
      parrafos.push(actual.join(" "));
      actual = [l];
      continue;
    }
    actual.push(l);
  }
  if (actual.length) parrafos.push(actual.join(" "));

  return parrafos
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

// ────────────────────────────────────────────────────────────── reparación
const libro = leerDelLibro(readFileSync(rutaTexto, "utf8"));
const desplazados = [];
let cambiadas = 0;

console.log("─".repeat(74));
console.log(escribir ? "  REPARANDO (se escribe de verdad)" : "  SIMULACRO — no se escribe nada");
console.log("─".repeat(74));

for (const tarea of A_REPARAR) {
  const archivo = join(CARPETA, `${String(tarea.n).padStart(3, "0")}.json`);
  const app = JSON.parse(readFileSync(archivo, "utf8"));
  const orig = libro.get(tarea.n);

  if (!orig) {
    console.log(`  ✗ lección ${tarea.n}: no la encontré en el libro, la dejo como está`);
    continue;
  }

  console.log(`\n  LECCIÓN ${tarea.n} — ${tarea.motivo}`);

  if (tarea.titulo) {
    console.log(`    título  antes : ${JSON.stringify(String(app.title || "").slice(0, 60))}`);
    console.log(`    título  ahora : ${JSON.stringify(orig.titulo.slice(0, 60))}`);
  }
  if (tarea.texto) {
    const viejo = String(app.originalText || "");
    console.log(`    texto   antes : ${viejo.length} caracteres — ${JSON.stringify(viejo.slice(0, 55))}`);
    console.log(`    texto   ahora : ${orig.cuerpo.length} caracteres — ${JSON.stringify(orig.cuerpo.slice(0, 55))}`);
    if (viejo.trim()) {
      desplazados.push({ leccion: tarea.n, textoQueEstabaMalPuesto: viejo });
    }
  }

  if (!escribir) continue;

  if (!existsSync(COPIAS)) mkdirSync(COPIAS, { recursive: true });
  writeFileSync(join(COPIAS, `${String(tarea.n).padStart(3, "0")}.json`), JSON.stringify(app, null, 2), "utf8");

  if (tarea.titulo) app.title = orig.titulo;
  if (tarea.texto) {
    app.originalText = orig.cuerpo;
    app.originalTextLoaded = true;
  }
  app.updatedAt = 0; // se deja en 0: no es una edición del admin, es una corrección
  writeFileSync(archivo, JSON.stringify(app, null, 2), "utf8");
  cambiadas++;
}

console.log("\n" + "─".repeat(74));
if (escribir) {
  console.log(`  lecciones corregidas: ${cambiadas}`);
  console.log(`  copia de cómo estaban antes: ${COPIAS}/`);
  if (desplazados.length) {
    const ruta = join(COPIAS, "texto-que-estaba-mal-puesto.json");
    writeFileSync(ruta, JSON.stringify(desplazados, null, 2), "utf8");
    console.log(`  el comentario que estaba en el sitio equivocado NO se perdió: ${ruta}`);
  }
} else {
  console.log("  Nada se tocó. Para aplicarlo: añade --escribir");
}
console.log("");
