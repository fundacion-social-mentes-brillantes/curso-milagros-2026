// Genera el audio de las lecciones con Google Gemini 2.5 TTS (voz expresiva).
//
// USO:
//   1) Guarda tu clave de Google AI Studio (empieza con AIza...) en   gemini-key.txt
//   2) Prueba una lección:   GEMINI_API_KEY=$(cat gemini-key.txt) node scripts/generar-audio-gemini.mjs 1 1
//   3) Todo el curso:        GEMINI_API_KEY=$(cat gemini-key.txt) node scripts/generar-audio-gemini.mjs
//
// Salen en   audio-generado/{NNN}.wav   (carpeta local, NO se sube al repo).
// La clave se lee de GEMINI_API_KEY; nunca se escribe ni se sube.

import fs from "node:fs";
import path from "node:path";

const API_KEY = (process.env.GEMINI_API_KEY || "").trim();
if (!API_KEY) {
  console.error("\n❌ Falta la clave. Guarda tu clave de Google AI Studio en gemini-key.txt.\n");
  process.exit(1);
}

// --- Modelo, voz y estilo (puedes cambiarlos) --------------------------------
// Modelos: gemini-2.5-flash-preview-tts (más barato) | gemini-2.5-pro-preview-tts (máxima calidad).
const MODEL = "gemini-2.5-flash-preview-tts";
// Voces femeninas cálidas: Kore, Aoede, Leda, Callirrhoe, Vindemiatrix, Sulafat, Zephyr.
const VOICE = "Sulafat";
// Instrucción de estilo (aquí vive la EMOCIÓN):
const STYLE =
  "Lee el siguiente texto como una guía espiritual de voz femenina, cálida y muy " +
  "humana. Hazlo con expresión y emoción reales, nunca plano: susurra con ternura " +
  "en los momentos íntimos, deja que la voz se ilumine y suba suavemente en los de " +
  "esperanza y alegría, y suene serena o conmovida cuando el texto lo pida. Haz " +
  "pausas naturales y respiros entre las ideas, sin prisa. Español latino, claro y bello.";

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

/** Envuelve el PCM crudo (L16) que devuelve Gemini en un archivo WAV reproducible. */
function pcmToWav(pcm, sampleRate) {
  const channels = 1;
  const bits = 16;
  const byteRate = (sampleRate * channels * bits) / 8;
  const blockAlign = (channels * bits) / 8;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bits, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function synth(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${STYLE}\n\nTexto:\n${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
        },
      },
    }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Gemini ${res.status}: ${msg.slice(0, 400)}`);
  }
  const data = await res.json();
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error("La respuesta no trajo audio.");
  const pcm = Buffer.from(part.inlineData.data, "base64");
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || "")?.[1] ?? 24000);
  return pcmToWav(pcm, rate);
}

async function main() {
  const from = Number(process.argv[2] || 1);
  const to = Number(process.argv[3] || 365);
  fs.mkdirSync(OUT_DIR, { recursive: true });

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
    const outPath = path.join(OUT_DIR, `${String(n).padStart(3, "0")}.wav`);
    const wav = await synth(text);
    fs.writeFileSync(outPath, wav);
    hechas++;
    console.log(`✓ L${n}  (${text.length} chars) → ${outPath}  [voz: ${VOICE}, ${MODEL}]`);
  }
  console.log(`\nListo: ${hechas} lección(es).`);
}

main().catch((e) => {
  console.error("\n❌ Error:", e.message, "\n");
  process.exit(1);
});
