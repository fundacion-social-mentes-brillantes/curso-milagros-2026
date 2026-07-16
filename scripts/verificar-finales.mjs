// Verifica que cada audio TERMINE donde termina el texto: transcribe los
// últimos segundos del WAV con Gemini (modelo multimodal, cupo APARTE del TTS)
// y comprueba que las últimas palabras del texto aparezcan en lo transcrito.
// Detecta: finales cortados a media palabra y lecciones que no llegaron al final.
//
// USO:  node scripts/verificar-finales.mjs [desde] [hasta]

import fs from "node:fs";
import path from "node:path";

const MODEL = process.env.VERIF_MODEL || "gemini-flash-latest"; // multimodal (NO el de TTS): cupo independiente
const SRC = "audio-generado";
const LESSONS = "public/lessons";
const COLA_SEG = 14; // segundos finales a transcribir

function loadKeys() {
  let raw = "";
  for (const f of ["gemini-keys.txt", "gemini-key.txt"]) if (fs.existsSync(f)) raw += "\n" + fs.readFileSync(f, "utf8");
  return [...new Set(raw.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s && !s.includes(" ") && s.length > 20))];
}
const KEYS = loadKeys();
let rr = 0;
const agotadas = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function speechText(lesson) {
  let t = String(lesson.originalText || "");
  t = t.replace(/^\s*#{1,2}\s*/gm, "");
  t = t.replace(/^\s*\d+\.\s*/gm, "");
  t = t.replace(/([\s"“(¿¡])\d{1,2}\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“])/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  return `Lección ${lesson.number}. ${lesson.title ? lesson.title + ". " : ""}${t}`;
}
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-zñ0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function colaWav(file, seg) {
  const b = fs.readFileSync(file);
  const rate = b.readUInt32LE(24);
  let pos = 12, off = 44, len = b.length - 44;
  while (pos + 8 <= b.length) {
    const id = b.toString("ascii", pos, pos + 4);
    const sz = b.readUInt32LE(pos + 4);
    if (id === "data") { off = pos + 8; len = Math.min(sz, b.length - off); break; }
    pos += 8 + sz + (sz % 2);
  }
  let bytes = Math.min(len, Math.floor(seg * rate) * 2);
  if (bytes % 2) bytes--;
  const pcm = b.subarray(off + len - bytes, off + len);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function transcribir(wavBuf) {
  let intentos = 0;
  while (true) {
    const disp = KEYS.filter((k) => !agotadas.has(k));
    if (disp.length === 0) return null;
    const key = disp[rr % disp.length]; rr++;
    let res;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 90000);
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [
            { inlineData: { mimeType: "audio/wav", data: wavBuf.toString("base64") } },
            { text: "Transcribe EXACTAMENTE y solamente las palabras habladas en este audio en español. Sin comentarios, sin puntuación extra, solo las palabras." },
          ] }],
        }),
      });
      clearTimeout(tid);
    } catch { if (++intentos > 6) return "ERROR"; await sleep(3000); continue; }
    const body = await res.text().catch(() => "");
    if (res.status === 429) {
      if (/per[\s-]?day/i.test(body)) { agotadas.add(key); continue; }
      if (++intentos > 20) return "ERROR";
      await sleep(6500); continue;
    }
    if (!res.ok) { if (++intentos > 6) return "ERROR"; await sleep(3000); continue; }
    try {
      const data = JSON.parse(body);
      return data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join(" ") || "";
    } catch { if (++intentos > 6) return "ERROR"; await sleep(2000); continue; }
  }
}

const from = Number(process.argv[2] || 1);
const to = Number(process.argv[3] || 365);
const malas = [];
let ok = 0, err = 0, rev = 0;

for (let n = from; n <= to; n++) {
  const id = String(n).padStart(3, "0");
  const wav = path.join(SRC, `${id}.wav`);
  if (!fs.existsSync(wav)) continue;
  const lesson = JSON.parse(fs.readFileSync(path.join(LESSONS, `${id}.json`), "utf8"));
  const texto = norm(speechText(lesson));
  const palabras = texto.split(" ");
  rev++;
  const tr = await transcribir(colaWav(wav, COLA_SEG));
  if (tr === null) { console.log(`\n⏸️ Cupo del modelo agotado. Revisadas: ${rev - 1}`); break; }
  if (tr === "ERROR") { console.log(`L${n}  ?? no se pudo transcribir`); err++; continue; }
  const trN = norm(tr);
  // ¿las últimas 4 palabras del texto aparecen al final del audio?
  const finales = palabras.slice(-4).join(" ");
  const finales6 = palabras.slice(-6).join(" ");
  const llega = trN.includes(finales) || trN.includes(palabras.slice(-3).join(" "));
  if (llega) { ok++; console.log(`L${n}  ✅ termina bien`); }
  else {
    // ¿dónde está lo transcrito dentro del texto? (para saber cuánto falta)
    const trPal = trN.split(" ").filter(Boolean);
    const probe = trPal.slice(-5).join(" ");
    const pos = probe ? texto.lastIndexOf(probe) : -1;
    const pct = pos >= 0 ? Math.round(((pos + probe.length) / texto.length) * 100) : -1;
    malas.push(n);
    console.log(`L${n}  ❌ NO llega al final del texto ${pct >= 0 ? `(el audio termina en ~${pct}% del texto)` : ""}`);
    console.log(`      audio dice al final: "…${trPal.slice(-9).join(" ")}"`);
    console.log(`      texto termina con:  "…${finales6}"`);
  }
  await sleep(1200);
}
console.log(`\nRevisadas ${rev} | ✅ bien ${ok} | ❌ cortadas ${malas.length} | ?? sin verificar ${err}`);
if (malas.length) {
  fs.writeFileSync(path.join(SRC, "_finales-cortados.txt"), malas.join(" "));
  console.log(`Cortadas: ${malas.join(", ")}`);
}
