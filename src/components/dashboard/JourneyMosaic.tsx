"use client";

import { useEffect, useMemo, useState } from "react";

const COLS = 24;
const ROWS = 14;
const N = COLS * ROWS;

/** PRNG con semilla fija → el orden de revelado es estable (servidor = cliente). */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mosaico del despertar: una escena de amanecer (esmeralda y oro) cubierta por
 * piezas que se van destapando a medida que la persona completa sus lecciones.
 * Al terminar las 365, el mosaico queda completo. Refleja el avance REAL.
 */
export function JourneyMosaic({ completed, total }: { completed: number; total: number }) {
  // ranks[i] = turno de revelado de la celda i (orden aleatorio pero fijo).
  const ranks = useMemo(() => {
    const arr = Array.from({ length: N }, (_, i) => i);
    const rnd = mulberry32(20260628);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }, []);

  const safe = Math.max(0, Math.min(completed, total));
  const target = Math.round((safe / total) * N);
  const percent = Math.round((safe / total) * 100);
  const done = safe >= total;

  // Empieza cubierto y se revela tras montar (animación de bienvenida).
  const [reveal, setReveal] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setReveal(target), 140);
    return () => clearTimeout(id);
  }, [target]);

  return (
    <div className="card overflow-hidden p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="section-eyebrow">Tu mosaico del despertar</p>
          <h3 className="mt-1 font-display text-lg font-semibold">Cada lección revela una pieza</h3>
        </div>
        <p className="text-sm font-semibold text-muted">
          {done ? "✨ ¡Mosaico completo!" : `${percent}% · ${safe} de ${total}`}
        </p>
      </div>

      <div
        className="relative mt-4 w-full overflow-hidden rounded-xl border border-border"
        style={{ aspectRatio: "16 / 9", background: "#0a2c27" }}
      >
        <svg
          viewBox="0 0 640 360"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <rect x="0" y="0" width="640" height="66" fill="#0b2926" />
          <rect x="0" y="66" width="640" height="46" fill="#103f37" />
          <rect x="0" y="112" width="640" height="38" fill="#18624e" />
          <rect x="0" y="150" width="640" height="26" fill="#2f876b" />
          <rect x="0" y="176" width="640" height="20" fill="#6fa074" />
          <rect x="0" y="196" width="640" height="14" fill="#cbb46a" />
          <rect x="0" y="210" width="640" height="6" fill="#ecd690" />
          <circle cx="320" cy="208" r="80" fill="#e9cf86" opacity="0.45" />
          <circle cx="320" cy="208" r="44" fill="#f5e3a0" />
          <path d="M0,224 Q160,198 330,218 Q480,234 640,216 L640,250 L0,250 Z" fill="#1a5446" />
          <path d="M0,250 Q180,228 340,246 Q500,262 640,244 L640,300 L0,300 Z" fill="#103f37" />
          <path d="M0,296 Q200,280 360,294 Q520,306 640,292 L640,360 L0,360 Z" fill="#0a2c27" />
          <path d="M308,214 L332,214 L372,360 L268,360 Z" fill="#d9b85c" opacity="0.8" />
          <path d="M314,216 L326,216 L348,360 L292,360 Z" fill="#f0d27e" opacity="0.7" />
          <g fill="#06201c">
            <circle cx="320" cy="320" r="7" />
            <path d="M320,326 C312,326 309,338 311,353 L329,353 C331,338 328,326 320,326 Z" />
          </g>
        </svg>

        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${COLS},1fr)`,
            gridTemplateRows: `repeat(${ROWS},1fr)`,
          }}
        >
          {ranks.map((rank, i) => {
            const shown = rank < reveal;
            const l = 14 + ((i * 73) % 9);
            return (
              <div
                key={i}
                style={{
                  background: `hsl(168 55% ${l}%)`,
                  border: "0.5px solid rgba(201,162,74,0.20)",
                  opacity: shown ? 0 : 1,
                  transform: shown ? "scale(0.4)" : "none",
                  transition: "opacity .5s ease, transform .5s ease",
                  transitionDelay: shown ? `${Math.round((rank / N) * 700)}ms` : "0ms",
                }}
              />
            );
          })}
        </div>

        {done && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-gold"
              style={{ background: "rgba(8,40,36,0.82)" }}
            >
              ⭐ Completaste tu Curso de Milagros
            </span>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        {safe === 0
          ? "Tu mosaico te espera. Al hacer tu primera lección se revelará la primera pieza."
          : done
            ? "Lo lograste: las 365 lecciones revelaron tu amanecer completo. 🌅"
            : "Cada lección que completes destapa una pieza nueva, hasta revelar el amanecer."}
      </p>
    </div>
  );
}
