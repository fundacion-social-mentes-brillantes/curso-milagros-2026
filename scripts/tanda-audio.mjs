// TANDA COMPLETA con control de calidad automático. Un solo comando hace todo:
//   generar → auditar (voz real) → verificar el FINAL por transcripción →
//   rehacer las que fallen → convertir a MP3.
// Así ninguna lección defectuosa queda "colada" hasta el final del proyecto.
//
// USO:  node scripts/tanda-audio.mjs 95 365
//
// Nota: la generación (TTS) y la verificación (transcripción) usan cupos
// DISTINTOS de Gemini, así que verificar no le quita cupo a la narración.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const from = Number(process.argv[2] || 1);
const to = Number(process.argv[3] || 365);
const SRC = "audio-generado";
const MAX_REINTENTOS = 2;

const node = process.execPath;
const run = (args, env) =>
  spawnSync(node, args, { encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 1 << 26 });

const wavOf = (n) => path.join(SRC, `${String(n).padStart(3, "0")}.wav`);
const existentes = () => new Set(fs.readdirSync(SRC).filter((f) => f.endsWith(".wav")).map((f) => parseInt(f, 10)));

// ── 1) GENERAR ────────────────────────────────────────────────────────────────
console.log(`\n▶ 1/4 Generando lecciones ${from}–${to}…\n`);
const antes = existentes();
const gen = run(["scripts/generar-audio-gemini.mjs", String(from), String(to)]);
process.stdout.write(gen.stdout || "");
if (gen.stderr) process.stderr.write(gen.stderr);
const despues = existentes();
let nuevas = [...despues].filter((n) => !antes.has(n)).sort((a, b) => a - b);
console.log(`\n   Nuevas en esta tanda: ${nuevas.length ? nuevas.join(", ") : "(ninguna)"}`);
if (nuevas.length === 0) { console.log("\nNada que verificar. Fin.\n"); process.exit(0); }

// ── 2) AUDITAR (voz real vs texto) ────────────────────────────────────────────
console.log(`\n▶ 2/4 Auditando voz real de las nuevas…\n`);
const sospechosas = new Set();
for (const n of nuevas) {
  const a = run(["scripts/auditar-audios.mjs", String(n), String(n)]);
  const out = a.stdout || "";
  if (/FALTA CONTENIDO|VOZ DE MÁS|VACÍO|corrupto/.test(out)) {
    sospechosas.add(n);
    console.log(`   L${n} ⚠️  ${out.split("\n").filter((l) => l.includes("-")).join(" ").trim().slice(0, 110)}`);
  }
}
console.log(`   Con problema de contenido: ${sospechosas.size ? [...sospechosas].join(", ") : "ninguna ✓"}`);

// ── 3) VERIFICAR FINAL (transcripción) y REHACER ──────────────────────────────
console.log(`\n▶ 3/4 Verificando el FINAL de cada nueva (transcripción)…\n`);
const MODELOS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash"];
let modeloIdx = 0;

function finalOk(n) {
  for (; modeloIdx < MODELOS.length; modeloIdx++) {
    const v = run(["scripts/verificar-finales.mjs", String(n), String(n)], { VERIF_MODEL: MODELOS[modeloIdx] });
    const out = v.stdout || "";
    if (/Cupo del modelo agotado/.test(out)) { console.log(`   (cupo de ${MODELOS[modeloIdx]} agotado; paso al siguiente modelo)`); continue; }
    if (/✅ termina bien/.test(out)) return true;
    if (/❌ NO llega al final/.test(out)) return false;
    return null; // no se pudo verificar
  }
  return null;
}

const malas = [], sinVerificar = [];
for (const n of [...new Set([...nuevas, ...sospechosas])].sort((a, b) => a - b)) {
  let ok = null;
  for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
    ok = sospechosas.has(n) && intento === 0 ? false : finalOk(n);
    if (ok === true) { console.log(`   L${n} ✅ completa y termina bien`); break; }
    if (ok === null) { console.log(`   L${n} ?? no se pudo verificar (sin cupo de transcripción)`); sinVerificar.push(n); break; }
    if (intento === MAX_REINTENTOS) { console.log(`   L${n} ❌ sigue mal tras ${MAX_REINTENTOS} reintentos`); malas.push(n); break; }
    console.log(`   L${n} ❌ defectuosa → la rehago (intento ${intento + 1})`);
    fs.rmSync(wavOf(n), { force: true });
    const r = run(["scripts/generar-audio-gemini.mjs", String(n), String(n)]);
    if (!fs.existsSync(wavOf(n))) {
      console.log(`   L${n} ⏸️  sin cupo de narración para rehacerla; queda pendiente`);
      malas.push(n);
      break;
    }
    sospechosas.delete(n);
  }
}

// ── 4) CONVERTIR a MP3 (solo las buenas) ──────────────────────────────────────
const buenas = nuevas.filter((n) => !malas.includes(n) && fs.existsSync(wavOf(n)));
console.log(`\n▶ 4/4 Convirtiendo a MP3 (con recorte de silencios): ${buenas.length} lección(es)…\n`);
for (const n of buenas) {
  const c = run(["scripts/wav-a-mp3.mjs", String(n), String(n)]);
  const line = (c.stdout || "").split("\n").find((l) => l.includes("→"));
  if (line) console.log("   " + line.trim());
}

console.log(`\n══════ RESUMEN DE LA TANDA ══════`);
console.log(`Generadas y aprobadas: ${buenas.length}${buenas.length ? ` → ${buenas.join(", ")}` : ""}`);
if (malas.length) console.log(`⚠️ Quedaron mal / pendientes: ${malas.join(", ")}`);
if (sinVerificar.length) console.log(`?? Sin verificar el final (revisar luego): ${sinVerificar.join(", ")}`);
console.log(`Listas para subir: git add public/audio/lecciones/*.mp3\n`);
