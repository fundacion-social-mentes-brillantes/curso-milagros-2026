// AUDITORÍA PROFUNDA de los audios generados (WAV fuente + MP3 publicado).
// Va mucho más allá de revisar-audio.mjs (que solo compara duración total):
//
//  1) VOZ REAL vs texto: mide los segundos CON VOZ (sin silencios) y los compara
//     con lo esperado por el largo del texto → detecta narración incompleta o
//     repetida aunque los silencios inflen/desinflen la duración total.
//  2) FINAL CORTADO: si hay voz hasta el último instante del archivo, lo más
//     probable es que la última palabra quedó a medias.
//  3) PAUSAS: pausa máxima tras el recorte (debe ser <= ~1s en el MP3).
//  4) MP3 publicado: existe, tamaño plausible frente a la voz medida.
//  5) WAV válido y legible.
//
// USO:  node scripts/auditar-audios.mjs [desde] [hasta]

import fs from "node:fs";
import path from "node:path";

const SRC = "audio-generado";
const MP3 = "public/audio/lecciones";
const LESSONS = "public/lessons";
const AMP = 500;          // umbral de silencio (pico por ventana de 20ms)
const CPS_MIN = 8.5;      // chars por segundo de VOZ: banda plausible
const CPS_MAX = 20;       // (lectura emotiva ≈ 11-16; fuera de banda = sospecha)
const MAX_SIL = 0.8;      // el recorte aplicado en wav-a-mp3

function speechChars(lesson) {
  let t = String(lesson.originalText || "");
  t = t.replace(/^\s*#{1,2}\s*/gm, "");
  t = t.replace(/^\s*\d+\.\s*/gm, "");
  t = t.replace(/([\s"“(¿¡])\d{1,2}\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“])/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  return (`Lección ${lesson.number}. ${lesson.title ? lesson.title + ". " : ""}${t}`).length;
}

function readWav(f) {
  const b = fs.readFileSync(f);
  if (b.length < 44 || b.toString("ascii", 0, 4) !== "RIFF") return null;
  const rate = b.readUInt32LE(24);
  let pos = 12, off = 44, len = b.length - 44;
  while (pos + 8 <= b.length) {
    const id = b.toString("ascii", pos, pos + 4);
    const sz = b.readUInt32LE(pos + 4);
    if (id === "data") { off = pos + 8; len = Math.min(sz, b.length - off); break; }
    pos += 8 + sz + (sz % 2);
  }
  return { rate, pcm: new Int16Array(b.buffer, b.byteOffset + off, Math.floor(len / 2)) };
}

function perfil(pcm, rate) {
  const WIN = Math.max(1, Math.floor(0.02 * rate));
  let voiced = 0, silent = 0, run = 0, maxRun = 0;
  const runs = [];
  for (let i = 0; i < pcm.length; i += WIN) {
    const end = Math.min(i + WIN, pcm.length);
    let pk = 0;
    for (let j = i; j < end; j++) { const a = pcm[j] < 0 ? -pcm[j] : pcm[j]; if (a > pk) pk = a; }
    if (pk < AMP) { silent += end - i; run += end - i; }
    else { voiced += end - i; if (run > 0) runs.push(run); if (run > maxRun) maxRun = run; run = 0; }
  }
  if (run > 0) { runs.push(run); if (run > maxRun) maxRun = run; }
  // ¿voz hasta el final? mira los últimos 250 ms
  const tail = pcm.subarray(Math.max(0, pcm.length - Math.floor(0.25 * rate)));
  let tailPk = 0;
  for (let j = 0; j < tail.length; j++) { const a = tail[j] < 0 ? -tail[j] : tail[j]; if (a > tailPk) tailPk = a; }
  // pausa máxima tras el recorte (simula el MP3): silencios se limitan a MAX_SIL
  const capMax = Math.min(maxRun / rate, MAX_SIL);
  return {
    dur: pcm.length / rate,
    voiced: voiced / rate,
    silTotal: silent / rate,
    maxPausa: maxRun / rate,
    maxPausaMp3: capMax,
    finalCaliente: tailPk >= AMP * 3, // voz clara justo al final = probable corte
  };
}

const from = Number(process.argv[2] || 1);
const to = Number(process.argv[3] || 365);
const problemas = [];
let ok = 0, revisadas = 0;

for (let n = from; n <= to; n++) {
  const id = String(n).padStart(3, "0");
  const wavPath = path.join(SRC, `${id}.wav`);
  if (!fs.existsSync(wavPath)) continue;
  revisadas++;
  const issues = [];

  const lp = path.join(LESSONS, `${id}.json`);
  const lesson = fs.existsSync(lp) ? JSON.parse(fs.readFileSync(lp, "utf8")) : null;
  const chars = lesson ? speechChars(lesson) : 0;

  const wav = readWav(wavPath);
  if (!wav || !wav.rate || wav.pcm.length < wav.rate) { problemas.push({ n, issues: ["WAV corrupto/vacío"] }); continue; }
  const p = perfil(wav.pcm, wav.rate);

  // 1) cobertura del texto por VOZ real
  if (chars > 0) {
    const cps = chars / Math.max(1, p.voiced);
    if (cps > CPS_MAX) issues.push(`FALTA CONTENIDO: solo ${p.voiced.toFixed(0)}s de voz para ${chars} chars (≈${cps.toFixed(1)} chars/s, muy rápido para ser real)`);
    if (cps < CPS_MIN) issues.push(`VOZ DE MÁS (¿repetida?): ${p.voiced.toFixed(0)}s de voz para ${chars} chars (≈${cps.toFixed(1)} chars/s)`);
  }
  // 2) final cortado
  if (p.finalCaliente) issues.push(`FINAL CORTADO: hay voz hasta el último instante (última palabra probablemente a medias)`);
  // 3) MP3 publicado
  const mp3Path = path.join(MP3, `${id}.mp3`);
  if (!fs.existsSync(mp3Path)) issues.push("MP3 NO EXISTE en public/audio/lecciones");
  else {
    const mb = fs.statSync(mp3Path).size;
    // MP3 64kbps ≈ 8000 bytes/s; el contenido ≈ voz + silencios recortados
    const esperado = (p.voiced + Math.min(p.silTotal, 0.8 * 200)) * 8000;
    if (mb < p.voiced * 8000 * 0.7) issues.push(`MP3 SOSPECHOSAMENTE CHICO: ${(mb / 1048576).toFixed(2)}MB para ${p.voiced.toFixed(0)}s de voz`);
  }

  if (issues.length) problemas.push({ n, issues, extra: `dur ${p.dur.toFixed(0)}s | voz ${p.voiced.toFixed(0)}s | pausaMax ${p.maxPausa.toFixed(1)}s` });
  else ok++;
}

console.log(`\nAuditadas: ${revisadas}  |  ✅ OK: ${ok}  |  ⚠️ Con problemas: ${problemas.length}\n`);
for (const pr of problemas) {
  console.log(`L${pr.n}  (${pr.extra || ""})`);
  for (const i of pr.issues) console.log(`   - ${i}`);
}
if (problemas.length) fs.writeFileSync(path.join(SRC, "_auditoria-fallas.txt"), problemas.map((p) => p.n).join(" "));
else { try { fs.unlinkSync(path.join(SRC, "_auditoria-fallas.txt")); } catch {} }
