// Convierte los WAV de audio-generado/ a MP3 (livianos) en la carpeta que se indique.
//
// USO:
//   node scripts/wav-a-mp3.mjs                → convierte todos los .wav de audio-generado/
//                                                a public/audio/lecciones/{NNN}.mp3
//   node scripts/wav-a-mp3.mjs 1 5            → solo las lecciones 1 a 5
//
// Toma el NÚMERO de lección del nombre del archivo (001, 002, ... aunque tenga
// texto extra como 001-MUJER-Sulafat.wav) y escribe {NNN}.mp3.

import fs from "node:fs";
import path from "node:path";
import lamejs from "@breezystack/lamejs";

const SRC = "audio-generado";
const OUT = "public/audio/lecciones";
const KBPS = 64; // suficiente para voz, archivos pequeños
const MAX_SILENCIO = 0.8; // recorta cualquier pausa a máximo este nº de segundos

// Recorta los silencios largos (dead air) a MAX_SILENCIO segundos. El TTS a
// veces deja huecos enormes (hasta decenas de segundos); esto los limita a una
// pausa natural, mejora el ritmo y acorta el audio. No toca la voz.
function capSilences(pcm, rate, maxSil = MAX_SILENCIO) {
  const AMP = 500; // por debajo de esto se considera silencio
  const WIN = Math.max(1, Math.floor(0.02 * rate)); // ventanas de 20 ms
  const maxKeep = Math.floor(maxSil * rate);
  const out = new Int16Array(pcm.length);
  let o = 0;
  let keptSil = 0;
  for (let i = 0; i < pcm.length; i += WIN) {
    const end = Math.min(i + WIN, pcm.length);
    let peak = 0;
    for (let j = i; j < end; j++) { const a = pcm[j] < 0 ? -pcm[j] : pcm[j]; if (a > peak) peak = a; }
    if (peak < AMP) {
      const room = Math.max(0, maxKeep - keptSil);
      const take = Math.min(end - i, room);
      for (let j = i; j < i + take; j++) out[o++] = pcm[j];
      keptSil += end - i;
    } else {
      keptSil = 0;
      for (let j = i; j < end; j++) out[o++] = pcm[j];
    }
  }
  return out.subarray(0, o);
}

function wavToMp3(wavBuf) {
  const sampleRate = wavBuf.readUInt32LE(24);
  const channels = wavBuf.readUInt16LE(22);
  // localizar el chunk "data"
  let pos = 12;
  let dataOffset = 44;
  let dataLen = wavBuf.length - 44;
  while (pos + 8 <= wavBuf.length) {
    const id = wavBuf.toString("ascii", pos, pos + 4);
    const size = wavBuf.readUInt32LE(pos + 4);
    if (id === "data") {
      dataOffset = pos + 8;
      dataLen = size;
      break;
    }
    pos += 8 + size + (size % 2);
  }
  const raw = new Int16Array(
    wavBuf.buffer,
    wavBuf.byteOffset + dataOffset,
    Math.floor(dataLen / 2),
  );
  const pcm = capSilences(raw, sampleRate); // recorta pausas larguísimas
  const enc = new lamejs.Mp3Encoder(channels === 2 ? 2 : 1, sampleRate, KBPS);
  const out = [];
  const block = 1152;
  for (let i = 0; i < pcm.length; i += block) {
    const chunk = pcm.subarray(i, i + block);
    const buf = enc.encodeBuffer(chunk);
    if (buf.length > 0) out.push(Buffer.from(buf));
  }
  const end = enc.flush();
  if (end.length > 0) out.push(Buffer.from(end));
  return Buffer.concat(out);
}

const from = process.argv[2] ? Number(process.argv[2]) : 0;
const to = process.argv[3] ? Number(process.argv[3]) : 999;

fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith(".wav"));
let hechas = 0;
for (const f of files) {
  const m = /(\d{3})/.exec(f);
  if (!m) continue;
  const n = Number(m[1]);
  if (from && (n < from || n > to)) continue;
  const wav = fs.readFileSync(path.join(SRC, f));
  const mp3 = wavToMp3(wav);
  const outPath = path.join(OUT, `${m[1]}.mp3`);
  fs.writeFileSync(outPath, mp3);
  hechas++;
  console.log(`✓ ${f} → ${outPath}  (${(mp3.length / 1024 / 1024).toFixed(2)} MB)`);
}
console.log(`\nListo: ${hechas} MP3 en ${OUT}`);
