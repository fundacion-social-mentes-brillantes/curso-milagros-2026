"use client";

import { useEffect, useState } from "react";
import { listCohorts } from "@/lib/admin-reset";
import { exportCohortPdf } from "@/lib/pdf-export";
import type { CohortArchive } from "@/types";

function fmtDate(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Historial de años cerrados, con su resumen y la lista de personas (solo admin). */
export function CohortHistory() {
  const [cohorts, setCohorts] = useState<CohortArchive[] | null>(null);
  const [selected, setSelected] = useState<CohortArchive | null>(null);

  useEffect(() => {
    listCohorts()
      .then(setCohorts)
      .catch(() => setCohorts([]));
  }, []);

  // Si todavía no hay años cerrados, no mostramos la sección.
  if (!cohorts || cohorts.length === 0) return null;

  return (
    <div className="mt-6 card p-4 sm:p-6">
      <h3 className="font-display text-lg font-semibold">Historial por año</h3>
      <p className="text-sm text-muted">
        Resumen de cada año cerrado. Toca uno para ver las personas y descargarlo.
      </p>
      <div className="mt-4 space-y-2">
        {cohorts.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="flex w-full flex-col items-start gap-1.5 rounded-xl border border-border bg-surface px-4 py-3 text-left transition hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <div>
              <p className="font-display text-base font-bold">{c.label}</p>
              <p className="text-xs text-muted">Cerrado el {fmtDate(c.archivedAt)}</p>
            </div>
            <div className="text-left text-xs text-muted sm:text-right">
              <p>
                <span className="font-semibold text-fg">{c.total}</span> personas ·{" "}
                <span className="font-semibold text-success">{c.finishedCount}</span> terminaron
              </p>
              <p>
                {c.avgCompletion}% promedio · lección prom. {c.avgLesson}
              </p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[60] grid animate-fade-in place-items-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <div
            className="card flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-bold">Año {selected.label}</h3>
                <p className="mt-0.5 text-sm text-muted">
                  {selected.total} personas · {selected.finishedCount} terminaron ·{" "}
                  {selected.avgCompletion}% promedio
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selected.participants.length > 0 && (
                  <button
                    onClick={() => void exportCohortPdf(selected)}
                    className="rounded-full border border-border px-3.5 py-2.5 text-xs font-semibold text-fg transition hover:bg-surface-2"
                    title="Descargar este año en PDF"
                  >
                    ⬇ PDF
                  </button>
                )}
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Cerrar"
                  className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="scrollbar-soft flex-1 overflow-y-auto p-3">
              {selected.participants.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted">Sin datos de personas.</p>
              ) : (
                <ul className="space-y-1">
                  {selected.participants.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-xl p-2.5 transition hover:bg-surface-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="truncate text-xs text-muted">
                          {p.country || "—"}
                          {p.email ? ` · ${p.email}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          p.completed >= 365
                            ? "bg-success/15 text-success"
                            : "bg-surface-2 text-muted"
                        }`}
                      >
                        {p.completed >= 365 ? "Terminó ✓" : `${p.completed} lecciones`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
