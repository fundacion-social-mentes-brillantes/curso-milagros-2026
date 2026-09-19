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
import { leerLibro } from "./lib-libro.mjs";
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

/**
 * CUÁNTO SE PARECEN DE VERDAD, palabra por palabra y EN ORDEN.
 *
 * Esta es la que vale, y la que faltaba. Antes solo se medía `cobertura`, que
 * cuenta cuántas palabras del libro aparecen en algún sitio del otro texto, sin
 * mirar el orden. Dos traducciones distintas del mismo párrafo comparten casi
 * todo el vocabulario, así que aquello daba 90% largo y se leía como "es el
 * mismo texto" cuando no lo era. Con esa vara se dio por buena una auditoría
 * entera: 348 lecciones "coincidían" y en realidad solo 50 eran el mismo texto.
 *
 * La cobertura se conserva porque sí sirve para una cosa: detectar que a una
 * lección le falta un trozo. Pero quien manda es esta.
 */
function parecido(a, b) {
  const x = palabras(a);
  const y = palabras(b);
  if (x.length === 0 || y.length === 0) return 0;
  // Subsecuencia común más larga, normalizada. Respeta el orden.
  const previa = new Array(y.length + 1).fill(0);
  let mejor = 0;
  for (let i = 1; i <= x.length; i++) {
    let anterior = 0;
    for (let j = 1; j <= y.length; j++) {
      const guardar = previa[j];
      previa[j] = x[i - 1] === y[j - 1] ? anterior + 1 : Math.max(previa[j], previa[j - 1]);
      anterior = guardar;
    }
  }
  mejor = previa[y.length];
  return (2 * mejor) / (x.length + y.length);
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

// ───────────────────────────────────────────────────────────────── auditoría
const libro = leerLibro(rutaTexto);

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
  const par = parecido(orig.cuerpo, `${tituloApp} ${textoApp}`);
  const cobTitulo = tituloApp ? cobertura(orig.titulo, tituloApp) : 0;

  // El veredicto lo da el parecido real, no la cobertura.
  let estado = "ok";
  if (cob < 0.55) estado = "DIFERENTE";
  else if (par < 0.90) estado = "traduccion";

  resultados.push({
    n,
    estado,
    cobertura: cob,
    parecido: par,
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
const medio = resultados.filter((r) => r.parecido !== undefined);
const promedio = medio.length
  ? medio.reduce((a, r) => a + r.parecido, 0) / medio.length
  : 0;
console.log(`  parecido REAL promedio       : ${(promedio * 100).toFixed(1)}%`);
console.log(`  ✔ es el mismo texto (≥90%)   : ${por("ok").length}`);
console.log(`  ~ otra traducción (<90%)     : ${por("traduccion").length}`);
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
