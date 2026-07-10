// Genera el audio de las lecciones con Google Gemini 2.5 TTS (voz expresiva).
// Soporta VARIAS claves (una por cuenta): las rota cuando una llega a su límite
// gratuito del día.
//
// USO:
//   1) Pon tus claves (una por línea) en   gemini-keys.txt   (o una sola en gemini-key.txt)
//   2) Prueba/rango:  node scripts/generar-audio-gemini.mjs 1 50
//   3) Todo el curso: node scripts/generar-audio-gemini.mjs
//
// Salen en   audio-generado/{NNN}.wav   (carpeta local, NO se sube al repo).
// Las claves se leen de los archivos locales; nunca se muestran ni se suben.

import fs from "node:fs";
import path from "node:path";

// --- Modelo, voz y estilo (puedes cambiarlos) --------------------------------
const MODEL = "gemini-2.5-flash-preview-tts";
// Voz configurable por variable de entorno (GEMINI_VOICE / GEMINI_GENERO).
// Mujeres cálidas: Sulafat, Kore, Aoede, Leda, Callirrhoe. Hombres: Charon, Orus, Enceladus, Iapetus.
const VOICE = process.env.GEMINI_VOICE || "Sulafat";
const GENERO = process.env.GEMINI_GENERO || "femenina";
const STYLE =
  `Lee el siguiente texto como una guía espiritual de voz ${GENERO}, cálida y muy ` +
  "humana. Hazlo con expresión y emoción reales, nunca plano: susurra con ternura " +
  "en los momentos íntimos, deja que la voz se ilumine y suba suavemente en los de " +
  "esperanza y alegría, y suene serena o conmovida cuando el texto lo pida. Haz " +
  "pausas naturales y respiros entre las ideas, sin prisa. Español latino, claro y bello.";

const DELAY_MS = 2500; // pausa entre lecciones (respeta el límite por minuto)
const LESSONS_DIR = "public/lessons";
const OUT_DIR = "audio-generado";

/** Carga todas las claves disponibles (de los archivos o del entorno), sin duplicar. */
function loadKeys() {
  let raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  for (const f of ["gemini-keys.txt", "gemini-key.txt"]) {
    if (fs.existsSync(f)) raw += "\n" + fs.readFileSync(f, "utf8");
  }
  const keys = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s && !s.includes(" ") && s.length > 20);
  return [...new Set(keys)];
}

const KEYS = loadKeys();
if (KEYS.length === 0) {
  console.error("\n❌ No encontré ninguna clave. Ponlas (una por línea) en gemini-keys.txt.\n");
  process.exit(1);
}
let ki = 0; // clave actual

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Texto para ESCUCHAR: quita números de párrafo/versículo (no cambia el texto visible). */
function speechText(lesson) {
  let t = String(lesson.originalText || "");
  t = t.replace(/^\s*\d+\.\s*/gm, "");
  t = t.replace(/([\s"“(¿¡])\d{1,2}\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“])/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  const titulo = lesson.title ? `${lesson.title}. ` : "";
  return `Lección ${lesson.number}. ${titulo}${t}`;
}

/** Envuelve el PCM (L16) que devuelve Gemini en un WAV reproducible. */
function pcmToWav(pcm, sampleRate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Llama a Gemini; si una clave llega a su límite (429), rota a la siguiente. */
async function synth(text) {
  while (ki < KEYS.length) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEYS[ki]}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${STYLE}\n\nTexto:\n${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
          },
        }),
      },
    );
    if (res.status === 429) {
      console.log(`   (clave ${ki + 1} llegó a su límite; roto a la siguiente…)`);
      ki++;
      await sleep(1000);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new Error("La respuesta no trajo audio.");
    const pcm = Buffer.from(part.inlineData.data, "base64");
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || "")?.[1] ?? 24000);
    return pcmToWav(pcm, rate);
  }
  return null; // todas las claves llegaron a su límite del día
}

async function main() {
  const from = Number(process.argv[2] || 1);
  const to = Number(process.argv[3] || 365);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Claves disponibles: ${KEYS.length}. Generando lecciones ${from}–${to}…\n`);

  let hechas = 0;
  for (let n = from; n <= to; n++) {
    const p = path.join(LESSONS_DIR, `${String(n).padStart(3, "0")}.json`);
    if (!fs.existsSync(p)) continue;
    const lesson = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!lesson.originalText || lesson.originalText.trim().length === 0) continue;
    const outPath = path.join(OUT_DIR, `${String(n).padStart(3, "0")}.wav`);
    if (fs.existsSync(outPath)) {
      console.log(`• L${n} ya existe, se salta`);
      continue;
    }
    const wav = await synth(speechText(lesson));
    if (!wav) {
      console.log(`\n⏸️  Todas las claves llegaron a su límite gratuito de HOY.`);
      console.log(`   Hechas: ${hechas}. Para seguir mañana (o con más claves):`);
      console.log(`   node scripts/generar-audio-gemini.mjs ${n} ${to}\n`);
      return;
    }
    fs.writeFileSync(outPath, wav);
    hechas++;
    console.log(`✓ L${n} → ${outPath}`);
    await sleep(DELAY_MS);
  }
  console.log(`\n🎉 Listo: ${hechas} lección(es) generada(s).`);
}

main().catch((e) => {
  console.error("\n❌ Error:", e.message, "\n");
  process.exit(1);
});
