// Revisa la INTEGRIDAD de los WAV generados: detecta audios cortados (truncados)
// y audios anómalamente largos (voz repetida/enredada). Compara la duración real
// del WAV contra la esperada según el largo del texto de la lección.
//
// USO:  node scripts/revisar-audio.mjs
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "audio-generado";
const LESSONS_DIR = "public/lessons";
const CHARS_POR_SEG = 13;   // lectura emotiva y pausada ≈ 11-14 car/seg
const CORTO = 0.55;         // < 55% de lo esperado → truncado
const LARGO = 2.3;          // > 230% de lo esperado → probable repetición/enredo

function wavInfo(buf) {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") return null;
  const rate = buf.readUInt32LE(24);
  const channels = buf.readUInt16LE(22) || 1;
  const bits = buf.readUInt16LE(34) || 16;
  // busca el chunk "data" (normalmente en 36)
  let off = 36;
  let dataSize = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "data") { dataSize = size; break; }
    off += 8 + size;
  }
  if (!dataSize) dataSize = buf.length - 44;
  const dur = dataSize / (rate * channels * (bits / 8));
  return { rate, dur };
}

function speechChars(lesson) {
  let t = String(lesson.originalText || "");
  t = t.replace(/\s+/g, " ").trim();
  return t.length + 20;
}

const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".wav")).sort();
const malos = [];
let ok = 0;
console.log(`Revisando ${files.length} audios…\n`);
for (const f of files) {
  const n = parseInt(f, 10);
  const buf = fs.readFileSync(path.join(OUT_DIR, f));
  const info = wavInfo(buf);
  const lp = path.join(LESSONS_DIR, `${String(n).padStart(3, "0")}.json`);
  const lesson = fs.existsSync(lp) ? JSON.parse(fs.readFileSync(lp, "utf8")) : {};
  const espSeg = speechChars(lesson) / CHARS_POR_SEG;
  if (!info || !info.rate) { console.log(`L${n}  ❌ WAV corrupto`); malos.push(n); continue; }
  const ratio = info.dur / espSeg;
  const dur = Math.round(info.dur);
  const esp = Math.round(espSeg);
  let flag = "ok";
  if (info.dur < 8) { flag = "❌ VACÍO/ROTO"; malos.push(n); }
  else if (ratio < CORTO) { flag = "⚠️ CORTADO"; malos.push(n); }
  else if (ratio > LARGO) { flag = "⚠️ MUY LARGO (repetido?)"; malos.push(n); }
  else ok++;
  const mb = (buf.length / 1048576).toFixed(1);
  if (flag !== "ok")
    console.log(`L${n}  dur ${dur}s / esper ${esp}s  (x${ratio.toFixed(2)}, ${mb}MB)  ${flag}`);
}
console.log(`\n✅ Sanas: ${ok}   ⚠️ A rehacer: ${malos.length}` + (malos.length ? `  →  ${malos.join(", ")}` : ""));
if (malos.length) fs.writeFileSync(path.join(OUT_DIR, "_dañadas.txt"), malos.join(" "));
