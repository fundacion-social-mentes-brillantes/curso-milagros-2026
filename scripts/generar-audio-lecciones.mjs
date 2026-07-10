// Genera el audio de las lecciones con Google Cloud Text-to-Speech (Neural2/WaveNet).
//
// USO:
//   1) Pon tu clave en la variable de entorno GOOGLE_TTS_API_KEY (ver instrucciones).
//   2) Prueba con un bloque pequeño:   node scripts/generar-audio-lecciones.mjs 1 5
//   3) Genera todo el curso:           node scripts/generar-audio-lecciones.mjs
//
// Los MP3 salen en   audio-generado/{NNN}.mp3   (carpeta local, NO se sube al repo).
// La clave NUNCA se escribe aquí ni se sube: se lee de la variable de entorno.

import fs from "node:fs";
import path from "node:path";

const API_KEY = process.env.GOOGLE_TTS_API_KEY;
if (!API_KEY) {
  console.error("\n❌ Falta la clave. Pon GOOGLE_TTS_API_KEY en el entorno y vuelve a intentar.\n");
  process.exit(1);
}

// --- Voz (puedes cambiarla) ---------------------------------------------------
// Neural2 (muy natural). Alternativas: es-US-Neural2-B / -C (voces masculinas),
// o es-ES-Neural2-* (acento de España). WaveNet: es-US-Wavenet-A, etc.
const VOICE = { languageCode: "es-US", name: "es-US-Neural2-A" };
const SPEAKING_RATE = 0.92; // un poco pausado, para meditar
const MAX_CHARS = 4500; // límite por petición de Google (5000); dejamos margen

const LESSONS_DIR = "public/lessons";
const OUT_DIR = "audio-generado";

/** Texto para ESCUCHAR: quita números de párrafo/versículo (no cambia el texto visible). */
function speechText(lesson) {
  let t = String(lesson.originalText || "");
  t = t.replace(/^\s*\d+\.\s*/gm, "");
  t = t.replace(/([\s"“(¿¡])\d{1,2}\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“])/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  const titulo = lesson.title ? `${lesson.title}. ` : "";
  return `Lección ${lesson.number}. ${titulo}${t}`;
}

/** Parte el texto en trozos < MAX_CHARS respetando el final de las frases. */
function chunk(text) {
  const parts = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const out = [];
  let cur = "";
  for (const s of parts) {
    if (cur && cur.length + s.length > MAX_CHARS) {
      out.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function synth(text) {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: VOICE,
        audioConfig: { audioEncoding: "MP3", speakingRate: SPEAKING_RATE },
      }),
    },
  );
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Google TTS ${res.status}: ${msg.slice(0, 300)}`);
  }
  const data = await res.json();
  return Buffer.from(data.audioContent, "base64");
}

async function main() {
  const from = Number(process.argv[2] || 1);
  const to = Number(process.argv[3] || 365);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let totalChars = 0;
  let hechas = 0;
  for (let n = from; n <= to; n++) {
    const p = path.join(LESSONS_DIR, `${String(n).padStart(3, "0")}.json`);
    if (!fs.existsSync(p)) continue;
    const lesson = JSON.parse(fs.readFileSync(p, "utf8"));
    const text = speechText(lesson);
    if (!lesson.originalText || lesson.originalText.trim().length === 0) {
      console.log(`L${n}: sin texto, se omite`);
      continue;
    }
    const outPath = path.join(OUT_DIR, `${String(n).padStart(3, "0")}.mp3`);
    const pieces = chunk(text);
    const buffers = [];
    for (const piece of pieces) {
      buffers.push(await synth(piece));
      totalChars += piece.length;
    }
    fs.writeFileSync(outPath, Buffer.concat(buffers));
    hechas++;
    console.log(`✓ L${n}  (${text.length} chars, ${pieces.length} parte(s)) → ${outPath}`);
  }

  const costoUSD = (totalChars / 1_000_000) * 16; // Neural2/WaveNet ≈ $16/millón
  console.log(`\nListo: ${hechas} lecciones.`);
  console.log(`Caracteres facturables: ${totalChars.toLocaleString()}`);
  console.log(`Costo estimado: ~$${costoUSD.toFixed(2)} USD (menos lo que cubra la capa gratuita).`);
}

main().catch((e) => {
  console.error("\n❌ Error:", e.message, "\n");
  process.exit(1);
});
