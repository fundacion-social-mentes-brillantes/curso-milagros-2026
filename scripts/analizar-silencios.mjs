// Analiza los SILENCIOS de un WAV: encuentra las pausas largas (dead air).
// Útil para detectar "pausas muy largas" en la narración.
//
// USO:  node scripts/analizar-silencios.mjs audio-generado/051.wav [umbralSeg]
import fs from "node:fs";

const file = process.argv[2];
const MIN_PAUSA = Number(process.argv[3] || 1.0); // reporta pausas >= esto (seg)
const AMP = 500; // por debajo de esto (de 32768) se considera silencio
const WIN = 0.02; // ventana de 20 ms

const buf = fs.readFileSync(file);
const rate = buf.readUInt32LE(24);
// localizar chunk data
let pos = 12, dataOff = 44, dataLen = buf.length - 44;
while (pos + 8 <= buf.length) {
  const id = buf.toString("ascii", pos, pos + 4);
  const size = buf.readUInt32LE(pos + 4);
  if (id === "data") { dataOff = pos + 8; dataLen = size; break; }
  pos += 8 + size + (size % 2);
}
const n = Math.floor(dataLen / 2);
const pcm = new Int16Array(buf.buffer, buf.byteOffset + dataOff, n);
const dur = n / rate;

const winN = Math.floor(WIN * rate);
const silent = []; // true/false por ventana
for (let i = 0; i < n; i += winN) {
  let peak = 0;
  for (let j = i; j < Math.min(i + winN, n); j++) { const a = Math.abs(pcm[j]); if (a > peak) peak = a; }
  silent.push(peak < AMP);
}
// runs de silencio
const pausas = [];
let run = 0;
for (let i = 0; i < silent.length; i++) {
  if (silent[i]) run++;
  else { if (run > 0) pausas.push(run * WIN); run = 0; }
}
if (run > 0) pausas.push(run * WIN);

const largas = pausas.filter((p) => p >= MIN_PAUSA).sort((a, b) => b - a);
const totalSil = pausas.reduce((a, b) => a + b, 0);
console.log(`Archivo: ${file}`);
console.log(`Duración total: ${dur.toFixed(1)}s (${(dur / 60).toFixed(1)} min)  | rate ${rate}Hz`);
console.log(`Silencio total: ${totalSil.toFixed(1)}s (${((totalSil / dur) * 100).toFixed(0)}% del audio)`);
console.log(`Pausas >=1s: ${pausas.filter((p) => p >= 1).length} | >=2s: ${pausas.filter((p) => p >= 2).length} | >=3s: ${pausas.filter((p) => p >= 3).length}`);
console.log(`Pausa más larga: ${(pausas.length ? Math.max(...pausas) : 0).toFixed(1)}s`);
console.log(`Top pausas largas (>=${MIN_PAUSA}s): ${largas.slice(0, 12).map((p) => p.toFixed(1) + "s").join(", ")}`);
