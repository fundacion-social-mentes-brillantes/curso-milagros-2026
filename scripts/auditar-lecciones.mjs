/**
 * AUDITORÍA del texto de las lecciones contra el libro original.
 *
 * Compara lo que la app tiene guardado en `public/lessons/NNN.json`
 * (campo `originalText`, que es intocable) con el texto extraído del PDF del
 * Libro de ejercicios.
 *
 * Qué mira, y por qué así:
 *
 *  - No compara letra por letra en crudo. El PDF trae saltos de línea, sangrías
 *    y guiones de corte que no significan nada; compararlos daría cientos de
 *    diferencias falsas. Antes de comparar, los dos textos se "aplanan":
 *    espacios normalizados, comillas unificadas, sin acentos, en minúsculas.
 *
 *  - Distingue tres cosas distintas, que no son igual de graves:
 *      · FALTA        → la lección no tiene texto en la app (grave)
 *      · DIFERENTE    → el contenido no coincide (hay que mirarlo)
 *      · TRADUCCIÓN   → dice lo mismo pero con otras palabras (otra edición)
 *
 * Uso:  node scripts/auditar-lecciones.mjs <ruta-del-texto-extraido>
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const rutaTexto = process.argv[2];
if (!rutaTexto) {
  console.error("Falta la ruta del texto extraído del PDF.");
  process.exit(1);
}

const CARPETA = "public/lessons";

// ─────────────────────────────────────────────────── normalizar para comparar
function aplanar(t) {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // fuera tildes
    .replace(/[«»"“”]/g, '"')
    .replace(/[‘’´`]/g, "'")
    .replace(/[‐-―]/g, "-")
    .replace(/\[|\]/g, "(")
    .replace(/\(|\)/g, "(")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ") // solo letras, números y espacios
    .replace(/\s+/g, " ")
    .trim();
}

/** Palabras del texto, para medir cuánto se parecen dos versiones. */
function palabras(t) {
  return aplanar(t).split(" ").filter((p) => p.length > 3);
}

/** Cuánto del original aparece en la copia (0 a 1). */
function cobertura(original, copia) {
  const a = palabras(original);
  if (a.length === 0) return 1;
  const b = new Set(palabras(copia));
  let dentro = 0;
  for (const p of a) if (b.has(p)) dentro++;
  return dentro / a.length;
}

// ──────────────────────────────────────────────── partir el PDF en lecciones
function leerDelLibro(texto) {
  const lineas = texto.split("\n");
  const marcas = [];
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/^\s*LECCI[OÓ]N\s+(\d+)\s*$/);
    if (m) marcas.push({ numero: Number(m[1]), linea: i });
  }

  const salida = new Map();
  for (let i = 0; i < marcas.length; i++) {
    const desde = marcas[i].linea + 1;
    const hasta = i + 1 < marcas.length ? marcas[i + 1].linea : lineas.length;
    let trozo = lineas.slice(desde, hasta);

    // Entre lección y lección, el libro intercala secciones suyas que NO son
    // parte de la lección anterior: las trece "¿Qué es…?", las introducciones,
    // "SEGUNDA PARTE", "LECCIONES FINALES" y el epílogo.
    //
    // Esto importa mucho para la auditoría: dejarlas dentro hacía parecer que a
    // la app le faltaba media lección (la 180 salía con un 12% cuando en
    // realidad está completa). Cortar aquí es lo que separa un problema de
    // verdad de un susto.
    const corte = trozo.findIndex((l) =>
      /^\s*(\d+\.\s*¿Qu[eé] (es|soy)|Introducci[oó]n\b|PRIMERA PARTE|SEGUNDA PARTE|LECCIONES FINALES|EP[IÍ]LOGO)/i.test(l),
    );
    if (corte > 0) trozo = trozo.slice(0, corte);

    // El título es lo primero que no está en blanco, hasta el primer párrafo
    // numerado ("1. ") o la primera línea vacía tras haber empezado.
    const tituloPartes = [];
    let j = 0;
    while (j < trozo.length && trozo[j].trim() === "") j++;
    while (j < trozo.length && trozo[j].trim() !== "" && !/^\s*\d+\.\s/.test(trozo[j])) {
      tituloPartes.push(trozo[j].trim());
      j++;
    }

    salida.set(marcas[i].numero, {
      titulo: tituloPartes.join(" ").replace(/\s+/g, " ").trim(),
      cuerpo: trozo.join("\n").trim(),
    });
  }
  return salida;
}

// ───────────────────────────────────────────────────────────────── auditoría
const libro = leerDelLibro(readFileSync(rutaTexto, "utf8"));

const archivos = readdirSync(CARPETA)
  .filter((f) => /^\d{3}\.json$/.test(f))
  .sort();

const resultados = [];
for (const f of archivos) {
  const n = Number(f.slice(0, 3));
  const app = JSON.parse(readFileSync(join(CARPETA, f), "utf8"));
  const orig = libro.get(n);

  const textoApp = String(app.originalText ?? "").trim();
  const tituloApp = String(app.title ?? "").trim();

  if (!orig) {
    resultados.push({ n, estado: "no-en-pdf", tituloApp, largoApp: textoApp.length });
    continue;
  }
  if (!textoApp) {
    resultados.push({ n, estado: "FALTA", tituloApp, tituloLibro: orig.titulo });
    continue;
  }

  const cob = cobertura(orig.cuerpo, textoApp);
  const cobTitulo = tituloApp ? cobertura(orig.titulo, tituloApp) : 0;

  let estado = "ok";
  if (cob < 0.55) estado = "DIFERENTE";
  else if (cob < 0.85) estado = "traduccion";

  resultados.push({
    n,
    estado,
    cobertura: cob,
    coberturaTitulo: cobTitulo,
    tituloApp,
    tituloLibro: orig.titulo,
    largoApp: textoApp.length,
    largoLibro: orig.cuerpo.length,
  });
}

// ──────────────────────────────────────────────────────────────── el informe
const por = (e) => resultados.filter((r) => r.estado === e);
const linea = "─".repeat(74);

console.log(linea);
console.log("  AUDITORÍA DEL TEXTO DE LAS LECCIONES");
console.log(linea);
console.log(`  lecciones en la app          : ${archivos.length}`);
console.log(`  lecciones halladas en el PDF : ${libro.size}`);
console.log("");
console.log(`  ✔ coinciden bien             : ${por("ok").length}`);
console.log(`  ~ otra traducción            : ${por("traduccion").length}`);
console.log(`  ✗ contenido DIFERENTE        : ${por("DIFERENTE").length}`);
console.log(`  ✗ SIN TEXTO en la app        : ${por("FALTA").length}`);
console.log(`  ? no están en el PDF         : ${por("no-en-pdf").length}`);
console.log(linea);

for (const grupo of ["FALTA", "DIFERENTE", "no-en-pdf"]) {
  const g = por(grupo);
  if (!g.length) continue;
  console.log("");
  console.log(`  ${grupo}  (${g.length})`);
  for (const r of g.slice(0, 40)) {
    const pct = r.cobertura !== undefined ? ` ${(r.cobertura * 100).toFixed(0)}%` : "";
    console.log(`   · lección ${String(r.n).padStart(3)}${pct}  "${(r.tituloApp || "(sin título)").slice(0, 52)}"`);
  }
  if (g.length > 40) console.log(`   … y ${g.length - 40} más`);
}

// Títulos que no se parecen al del libro (aunque el cuerpo esté bien).
const titulosRaros = resultados.filter(
  (r) => r.coberturaTitulo !== undefined && r.coberturaTitulo < 0.5 && r.tituloLibro,
);
console.log("");
console.log(`  TÍTULOS que no coinciden con el libro: ${titulosRaros.length}`);
for (const r of titulosRaros.slice(0, 15)) {
  console.log(`   · lección ${String(r.n).padStart(3)}`);
  console.log(`       app   : ${(r.tituloApp || "(vacío)").slice(0, 70)}`);
  console.log(`       libro : ${r.tituloLibro.slice(0, 70)}`);
}
if (titulosRaros.length > 15) console.log(`   … y ${titulosRaros.length - 15} más`);
console.log("");
