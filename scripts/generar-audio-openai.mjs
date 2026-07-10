// Genera el audio de las lecciones con OpenAI (modelo gpt-4o-mini-tts).
//
// USO:
//   1) Guarda tu clave de OpenAI (empieza con sk-...) en   tts-key.txt
//   2) Prueba dos lecciones:   OPENAI_API_KEY=$(cat tts-key.txt) node scripts/generar-audio-openai.mjs 1 2
//   3) Todo el curso:          OPENAI_API_KEY=$(cat tts-key.txt) node scripts/generar-audio-openai.mjs
//
// Los MP3 salen en   audio-generado/{NNN}.mp3   (carpeta local, NO se sube al repo).
// La clave NUNCA se escribe aquí ni se sube: se lee de la variable de entorno.

import fs from "node:fs";
import path from "node:path";

const API_KEY = (process.env.OPENAI_API_KEY || "").trim();
if (!API_KEY) {
  console.error("\n❌ Falta la clave. Guarda tu clave de OpenAI en tts-key.txt y vuelve a intentar.\n");
  process.exit(1);
}

// --- Voz y estilo (puedes cambiarlos) ----------------------------------------
const MODEL = "gpt-4o-mini-tts";
const VOICE = "marin"; // alternativas de calidad: cedar, coral, sage, nova, shimmer
const INSTRUCTIONS =
  "Narra en español latino con una voz cálida, serena y pausada, como una guía " +
  "espiritual que acompaña con amor y paz. Ritmo tranquilo, entonación suave y " +
  "clara, con pausas naturales entre frases. Nada apurado, nada dramático.";
const MAX_CHARS = 3500; // margen holgado bajo el límite de tokens por petición

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
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      input: text,
      instructions: INSTRUCTIONS,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`OpenAI ${res.status}: ${msg.slice(0, 400)}`);
  }
  return Buffer.from(await res.arrayBuffer());
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
    if (!lesson.originalText || lesson.originalText.trim().length === 0) {
      console.log(`L${n}: sin texto, se omite`);
      continue;
    }
    const text = speechText(lesson);
    const outPath = path.join(OUT_DIR, `${String(n).padStart(3, "0")}.mp3`);
    const pieces = chunk(text);
    const buffers = [];
    for (const piece of pieces) {
      buffers.push(await synth(piece));
      totalChars += piece.length;
    }
    fs.writeFileSync(outPath, Buffer.concat(buffers));
    hechas++;
    console.log(`✓ L${n}  (${text.length} chars, ${pieces.length} parte(s)) → ${outPath}  [voz: ${VOICE}]`);
  }

  console.log(`\nListo: ${hechas} lección(es).`);
  console.log(`Caracteres narrados: ${totalChars.toLocaleString()}`);
}

main().catch((e) => {
  console.error("\n❌ Error:", e.message, "\n");
  process.exit(1);
});
