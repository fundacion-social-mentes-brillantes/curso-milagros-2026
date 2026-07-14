// Genera el audio de las lecciones con Google Gemini 2.5 TTS (voz expresiva).
// Rota VARIAS claves en round-robin (una por cuenta) para repartir el uso y
// respetar el límite por minuto; cuando una llega a su límite del DÍA la aparta.
//
// USO:
//   node scripts/generar-audio-gemini.mjs            (todo el curso, salta lo hecho)
//   node scripts/generar-audio-gemini.mjs 6 120      (un rango)
//
// Salen en audio-generado/{NNN}.wav (local, NO al repo). Claves de los archivos.

import fs from "node:fs";
import path from "node:path";

const MODEL = "gemini-2.5-flash-preview-tts";
const VOICE = process.env.GEMINI_VOICE || "Sulafat"; // mujer cálida (la elegida)
const STYLE =
  "Narra esta lección de Un Curso de Milagros con voz de MUJER cálida, íntima y " +
  "profundamente humana, como una guía espiritual que lee con el corazón. Con emoción " +
  "REAL y viva, jamás plana: susurra con ternura los momentos íntimos, deja que la voz " +
  "se ilumine y se eleve con esperanza, y que suene conmovida —casi a punto de quebrarse— " +
  "en lo más hondo. Ritmo pausado y meditativo, con pausas naturales y respiros entre las " +
  "ideas, dando tiempo a que cada frase se asiente. Entonación suave, expresiva y bella. " +
  "Español latino, claro y sereno.";

const DELAY_MS = 4000; // entre lecciones (con 5 claves ≈ respeta 3/min por clave)
const LESSONS_DIR = "public/lessons";
const OUT_DIR = "audio-generado";

function loadKeys() {
  let raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  for (const f of ["gemini-keys.txt", "gemini-key.txt"]) {
    if (fs.existsSync(f)) raw += "\n" + fs.readFileSync(f, "utf8");
  }
  return [...new Set(
    raw.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s && !s.includes(" ") && s.length > 20),
  )];
}
const KEYS = loadKeys();
if (KEYS.length === 0) { console.error("\n❌ No hay claves en gemini-keys.txt.\n"); process.exit(1); }

const agotadas = new Set(); // claves sin cupo del DÍA
let rr = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Red inestable de Google (500/timeouts): que un rechazo suelto de la librería
// de red NO tumbe todo el proceso. Se registra y se sigue (el reintento del
// synthChunk se encarga de recuperar la petición).
process.on("unhandledRejection", (e) => {
  console.log(`    · (aviso) rechazo de red ignorado: ${String(e?.message || e).slice(0, 80)}`);
});

function speechText(lesson) {
  let t = String(lesson.originalText || "");
  t = t.replace(/^\s*\d+\.\s*/gm, "");
  t = t.replace(/([\s"“(¿¡])\d{1,2}\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“])/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  return `Lección ${lesson.number}. ${lesson.title ? lesson.title + ". " : ""}${t}`;
}

function pcmToWav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// Parte el texto en trozos por ORACIONES, sin pasar de maxChars. Así una lección
// larga se sintetiza por partes (cada parte es corta y NUNCA se trunca). Las
// lecciones cortas (≤ maxChars) quedan en un solo trozo, como antes.
function splitIntoChunks(text, maxChars = 1600) {
  const oraciones = text.match(/[^.!?…]+[.!?…]+|\S[^.!?…]*$/g) || [text];
  const chunks = [];
  let cur = "";
  for (const o of oraciones) {
    const s = o.trim();
    if (!s) continue;
    if (cur && cur.length + 1 + s.length > maxChars) { chunks.push(cur); cur = s; }
    else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// Sintetiza UN trozo → devuelve {pcm, rate}. null si se agotó el cupo del día.
async function synthChunk(text) {
  // contadores separados por causa (uno no agota al otro) y con "voz" en cada reintento
  let min429 = 0, srv = 0, noaudio = 0, net = 0;
  while (true) {
    const disp = KEYS.filter((k) => !agotadas.has(k));
    if (disp.length === 0) return null; // todas llegaron a su límite del día
    const key = disp[rr % disp.length]; rr++;
    let res;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 120000); // que nunca se cuelgue >2 min
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${STYLE}\n\nTexto:\n${text}` }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
            },
          }),
        },
      );
      clearTimeout(tid);
    } catch (e) {
      if (++net > 8) throw new Error("Red inestable.");
      console.log(`    · red/timeout, reintento ${net}`); await sleep(3000); continue;
    }
    // leer el cuerpo con protección: si el socket se corta al leer, se reintenta
    let body;
    try { body = await res.text(); }
    catch (e) {
      if (++net > 8) throw new Error("Red inestable (al leer respuesta).");
      console.log(`    · corte al leer respuesta, reintento ${net}`); await sleep(3000); continue;
    }
    if (res.status === 429) {
      if (/per[\s-]?day/i.test(body)) { // SOLO si Google dice "PerDay" → cupo del día
        agotadas.add(key);
        console.log(`    · una clave sin cupo del día; quedan ${KEYS.filter((k) => !agotadas.has(k)).length}`);
        continue;
      }
      if (++min429 > 30) throw new Error("Límite por minuto persistente; intenta más tarde.");
      console.log(`    · 429 por minuto, espero 6s y pruebo otra clave (${min429})`);
      await sleep(6000);
      continue;
    }
    if (res.status >= 500) { // error interno transitorio de Google: espera y reintenta
      if (++srv > 10) throw new Error(`Gemini ${res.status} persistente`);
      console.log(`    · error ${res.status} de Google, reintento ${srv}`);
      await sleep(4000);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${body.slice(0, 150)}`);
    let data;
    try { data = JSON.parse(body); }
    catch { if (++noaudio > 5) throw new Error("Respuesta no-JSON."); console.log("    · respuesta ilegible, reintento"); await sleep(1500); continue; }
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) { // el modelo generó texto en vez de audio: reintenta unas pocas veces
      if (++noaudio > 5) throw new Error("Sin audio (el modelo devolvió texto).");
      console.log(`    · sin audio, reintento ${noaudio}`);
      await sleep(2500);
      continue;
    }
    const pcm = Buffer.from(part.inlineData.data, "base64");
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || "")?.[1] ?? 24000);
    return { pcm, rate };
  }
}

// Sintetiza una lección COMPLETA (parte en trozos si es larga y los une en un WAV).
// null si se agotó el cupo del día a mitad de camino (la lección se hará entera luego).
async function synthLesson(fullText) {
  const chunks = splitIntoChunks(fullText);
  const pcms = [];
  let rate = 24000;
  for (let i = 0; i < chunks.length; i++) {
    const r = await synthChunk(chunks[i]);
    if (!r) return null; // sin cupo
    rate = r.rate;
    if (i > 0) { // ~0.30s de silencio entre trozos para un respiro natural
      let sil = Math.round(rate * 2 * 0.30); if (sil % 2) sil++;
      pcms.push(Buffer.alloc(sil));
    }
    pcms.push(r.pcm);
    if (chunks.length > 1) {
      console.log(`      trozo ${i + 1}/${chunks.length} ok`);
      if (i < chunks.length - 1) await sleep(1500); // respiro entre peticiones (RPM)
    }
  }
  return pcmToWav(Buffer.concat(pcms), rate);
}

async function main() {
  const from = Number(process.argv[2] || 1);
  const to = Number(process.argv[3] || 365);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Claves: ${KEYS.length}. Voz: ${VOICE}. Lecciones ${from}–${to}…\n`);
  let hechas = 0;
  const fallidas = [];
  for (let n = from; n <= to; n++) {
    const p = path.join(LESSONS_DIR, `${String(n).padStart(3, "0")}.json`);
    if (!fs.existsSync(p)) continue;
    const lesson = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!lesson.originalText || lesson.originalText.trim().length === 0) continue;
    const outPath = path.join(OUT_DIR, `${String(n).padStart(3, "0")}.wav`);
    if (fs.existsSync(outPath)) { console.log(`• L${n} ya existe, se salta`); continue; }
    let wav;
    try { wav = await synthLesson(speechText(lesson)); }
    catch (e) { console.log(`✗ L${n} falló (${e.message}); se salta`); fallidas.push(n); await sleep(DELAY_MS); continue; }
    if (!wav) {
      console.log(`\n⏸️  Todas las claves llegaron a su límite gratuito de HOY. Hechas: ${hechas}.`);
      console.log(`   Para seguir:  node scripts/generar-audio-gemini.mjs ${n} ${to}\n`);
      break;
    }
    fs.writeFileSync(outPath, wav);
    hechas++;
    console.log(`✓ L${n} (${(wav.length / 1048576).toFixed(1)} MB)`);
    await sleep(DELAY_MS);
  }
  console.log(`\n🎉 Listo: ${hechas} lección(es).` + (fallidas.length ? `  Fallidas (reintentar luego): ${fallidas.join(", ")}` : ""));
}

main().catch((e) => { console.error("\n❌", e.message, "\n"); process.exit(1); });
