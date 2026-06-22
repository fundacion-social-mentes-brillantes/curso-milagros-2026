"use client";

import { useState } from "react";

/**
 * Botón "¿Cómo se practica?" que despliega los pasos del ejercicio.
 * Mantiene la lección minimalista: el texto solo aparece si la persona lo pide.
 */
export function PracticeToggle({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);
  if (!steps || steps.length === 0) return null;

  return (
    <section className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition hover:bg-surface-2/50"
      >
        <span className="flex items-center gap-2 font-display text-lg font-semibold">
          <span aria-hidden>🧭</span> ¿Cómo se practica?
        </span>
        <span className={`text-primary transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="animate-fade-in border-t border-border px-6 py-5">
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/20 text-xs font-bold text-gold">
                  {i + 1}
                </span>
                <span className="whitespace-pre-line leading-relaxed text-fg/90">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
