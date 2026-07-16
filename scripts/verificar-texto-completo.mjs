// Compara la ESTRUCTURA de cada lección contra el PDF del libro de ejercicios:
// ¿el texto tiene tantos PÁRRAFOS numerados como el PDF? ¿termina con un número
// de oración colgando? Detecta finales perdidos por el scrapeo (p. ej. L100
// perdió la última oración del párrafo 9 y TODO el párrafo 10).
//
// USO:  node scripts/verificar-texto-completo.mjs [rutaTxtPdf]

import fs from "node:fs";
import path from "node:path";

const PDF_TXT = process.argv[2] ||
  "C:/Users/USER/AppData/Local/Temp/claude/C--Claude/f538be9d-24c0-49c5-bf37-8bf7051eab0d/scratchpad/libro-ejercicios.txt";
const LESSONS = "public/lessons";

const lines = fs.readFileSync(PDF_TXT, "utf8").split(/\r?\n/);
const isLecc = (s) => /LECCI\S*\s+\d/.test(s);
const leccTag = (s) => { const m = s.match(/LECCI\S*\s+(\d+(?:-\d+)?)/); return m ? m[1] : null; };

// índice de lecciones del PDF: tag -> [desde, hasta)
const idx = [];
for (let i = 0; i < lines.length; i++) if (isLecc(lines[i])) idx.push({ tag: leccTag(lines[i]), start: i });
for (let i = 0; i < idx.length; i++) idx[i].end = i + 1 < idx.length ? idx[i + 1].start : lines.length;

function pdfMaxPara(tag) {
  const e = idx.find((x) => x.tag === tag);
  if (!e) return null;
  let max = 0;
  for (let i = e.start + 1; i < e.end; i++) {
    const m = lines[i].match(/^\s*(\d{1,2})\.\s/);
    if (m) { const v = Number(m[1]); if (v > max) max = v; }
  }
  return max;
}

function textMaxPara(text) {
  // usa solo la parte de la LECCIÓN (tras "# LECCIÓN N" si existe: repasos con intro)
  const cut = text.search(/^# LECCI/m);
  const body = cut >= 0 ? text.slice(cut) : text;
  let max = 0;
  for (const b of body.split(/\n{2,}/)) {
    const m = b.trim().match(/^(\d{1,2})\.\s/);
    if (m) { const v = Number(m[1]); if (v > max) max = v; }
  }
  return max;
}

let revisadas = 0, sospechosas = [];
for (let n = 1; n <= 365; n++) {
  const p = path.join(LESSONS, `${String(n).padStart(3, "0")}.json`);
  if (!fs.existsSync(p)) continue;
  const l = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!l.originalTextLoaded || !(l.originalText || "").trim()) continue;
  revisadas++;
  const issues = [];
  const tag = n >= 361 ? "361-365" : String(n);
  const pdfMax = pdfMaxPara(tag);
  const txtMax = textMaxPara(l.originalText);
  if (pdfMax && txtMax && txtMax < pdfMax) issues.push(`párrafos: texto llega a ${txtMax}, PDF llega a ${pdfMax} (FALTA FINAL)`);
  const cola = l.originalText.trim().slice(-12);
  if (/\s\d{1,2}$/.test(l.originalText.trim())) issues.push(`termina con número colgando: "…${cola}"`);
  if (issues.length) sospechosas.push({ n, issues });
}
console.log(`Revisadas ${revisadas} lecciones con texto.\n`);
if (!sospechosas.length) console.log("✅ Ninguna con final perdido.");
for (const s of sospechosas) { console.log(`L${s.n}:`); for (const i of s.issues) console.log(`   - ${i}`); }
