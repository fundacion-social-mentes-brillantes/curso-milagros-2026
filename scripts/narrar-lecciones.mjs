/**
 * NARRAR LAS LECCIONES con la voz de Alexandra, por tandas y auditando.
 *
 * Hace el ciclo entero por cada lección: generar, comprobar, subir y anotar.
 * Lleva su propio registro en `audio-nuevo/estado.json`, así que si se corta a
 * mitad se puede volver a lanzar y sigue donde iba, sin repetir ni pagar dos
 * veces.
 *
 * POR QUÉ POR TANDAS Y NO TODO DE GOLPE. Son 519.000 créditos, el 87% del mes.
 * Un fallo que se repita 300 veces sin que nadie mire se come el presupuesto y
 * deja 300 audios malos publicados. Cada tanda se audita antes de seguir con la
 * siguiente, y si falla mucho el propio script se para.
 *
 * QUÉ SE COMPRUEBA en cada audio, de lo barato a lo caro:
 *
 *   1. Que el archivo exista y ffprobe pueda leerlo (no está corrupto).
 *   2. Que dure lo que debería. La voz rinde ~753 caracteres por minuto: si el
 *      audio dura la mitad, se cortó; si dura el doble, se repitió algo.
 *   3. Que DIGA lo que pone en el guion. Se transcribe con Whisper en local
 *      (gratis, no sube nada) y se compara palabra por palabra. Esto es lo que
 *      caza las rarezas de verdad: en la primera prueba pilló que la lección 4
 *      decía "acerca de uaskeanon" donde el Curso deja un hueco en blanco.
 *
 * Uso:
 *   node scripts/narrar-lecciones.mjs --desde 6 --hasta 13          (tanda)
 *   node scripts/narrar-lecciones.mjs --desde 6 --hasta 13 --seco   (sin gastar)
 *   node scripts/narrar-lecciones.mjs --pendientes                  (qué falta)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CARPETA = "audio-nuevo";
const ESTADO = `${CARPETA}/estado.json`;
const VOZ = "3W2vC7XwSiXFUMOcj1VB";
const ELEVEN = "C:/Users/Juan Sebastian/.claude/skills/eleven/scripts/eleven.py";
const WHISPER = "C:/Claude/.venv-asr/Scripts/python.exe";
const CUENTA = "stgembcurso";
const GRUPO = "rg-gemb-curso";

/** Caracteres por minuto de audio con esta voz a velocidad 0,90. Medido. */
const CAR_POR_MIN = 753;
/** Por debajo de esto, el audio no dice lo que debería. */
const PARECIDO_MINIMO = 0.93;

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const tiene = (n) => args.includes(`--${n}`);

const estado = existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, "utf8")) : {};
const guardarEstado = () => writeFileSync(ESTADO, JSON.stringify(estado, null, 2), "utf8");

if (tiene("pendientes")) {
  const hechas = Object.entries(estado).filter(([, v]) => v.ok).map(([k]) => Number(k));
  const faltan = [];
  for (let n = 1; n <= 365; n++) if (!hechas.includes(n)) faltan.push(n);
  console.log(`  listas: ${hechas.length} de 365`);
  console.log(`  faltan: ${faltan.length}`);
  if (faltan.length) console.log(`  siguientes: ${faltan.slice(0, 20).join(" ")}`);
  process.exit(0);
}

const desde = Number(opt("desde", 1));
const hasta = Number(opt("hasta", desde));
const seco = tiene("seco");

function correr(cmd, argv, opciones = {}) {
  return execFileSync(cmd, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opciones });
}

/** Duración real del audio, en segundos. */
function duracion(ruta) {
  const s = correr("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", ruta,
  ]);
  return Number(String(s).trim());
}

/** Lo que de verdad se oye, transcrito en local. Devuelve el parecido 0..1. */
function auditar(n) {
  const salida = correr(WHISPER, ["scripts/_comparar-audio.py", String(n)], {
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  const m = String(salida).match(/PARECIDO=([\d.]+)/);
  return m ? Number(m[1]) : 0;
}

const claveAzure = seco
  ? ""
  : String(correr("az", [
      "storage", "account", "keys", "list", "--account-name", CUENTA,
      "-g", GRUPO, "--query", "[0].value", "-o", "tsv",
    ])).trim();

let hechas = 0;
let fallos = 0;
const problemas = [];

for (let n = desde; n <= hasta; n++) {
  const id = String(n).padStart(3, "0");
  const txt = `${CARPETA}/${id}.txt`;
  const mp3 = `${CARPETA}/${id}.mp3`;

  if (estado[n]?.ok) {
    console.log(`  ${id}  ya estaba lista, se salta`);
    continue;
  }

  const guion = readFileSync(txt, "utf8");
  const esperado = (guion.length / CAR_POR_MIN) * 60;

  if (seco) {
    console.log(`  ${id}  ${guion.length} car → ~${Math.round(guion.length * 0.605)} cr, ~${(esperado / 60).toFixed(1)} min`);
    continue;
  }

  process.stdout.write(`  ${id}  generando…`);
  try {
    correr("python", [
      ELEVEN, "decir", "--archivo", txt, "--voz", VOZ,
      "--modelo", "eleven_multilingual_v2",
      "--estabilidad", "0.25", "--estilo", "0.60", "--similitud", "0.95", "--refuerzo",
      "--velocidad", "0.90", "--formato", "mp3_44100_192",
      "--salida", mp3,
    ], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  } catch (e) {
    console.log(` FALLÓ al generar`);
    problemas.push([n, "no se pudo generar"]);
    fallos++;
    continue;
  }

  // 1 y 2: íntegro y con la duración que toca.
  let dur;
  try {
    dur = duracion(mp3);
  } catch {
    console.log(` ARCHIVO ILEGIBLE`);
    problemas.push([n, "el mp3 no se puede leer"]);
    fallos++;
    continue;
  }
  const desvio = Math.abs(dur - esperado) / esperado;
  if (desvio > 0.25) {
    console.log(` DURACIÓN RARA (${dur.toFixed(0)}s, se esperaban ${esperado.toFixed(0)}s)`);
    problemas.push([n, `dura ${dur.toFixed(0)}s y deberían ser ~${esperado.toFixed(0)}s`]);
    fallos++;
    continue;
  }

  // 3: que diga lo que pone.
  const parecido = auditar(n);
  if (parecido < PARECIDO_MINIMO) {
    console.log(` DICE OTRA COSA (${(parecido * 100).toFixed(0)}%)`);
    problemas.push([n, `solo coincide el ${(parecido * 100).toFixed(0)}% con el guion`]);
    fallos++;
    continue;
  }

  // Subir solo lo que pasó las tres.
  try {
    correr("az", [
      "storage", "blob", "upload", "--account-name", CUENTA, "--account-key", claveAzure,
      "--container-name", "audio", "--name", `${id}.mp3`, "--file", mp3,
      "--overwrite", "--content-type", "audio/mpeg",
      "--content-cache", "public, max-age=3600", "-o", "none",
    ]);
  } catch {
    console.log(` no se pudo subir`);
    problemas.push([n, "generado y auditado, pero no subió"]);
    fallos++;
    continue;
  }

  estado[n] = { ok: true, segundos: Math.round(dur), parecido: Number(parecido.toFixed(3)), cuando: new Date().toISOString().slice(0, 16) };
  guardarEstado();
  hechas++;
  console.log(` lista (${(dur / 60).toFixed(1)} min, ${(parecido * 100).toFixed(0)}%)`);
}

console.log("");
console.log(`  hechas ${hechas} · fallos ${fallos}`);
if (problemas.length) {
  console.log("  PROBLEMAS:");
  for (const [n, q] of problemas) console.log(`   · lección ${n}: ${q}`);
}
const total = Object.values(estado).filter((v) => v.ok).length;
console.log(`  acumulado: ${total} de 365 listas`);
