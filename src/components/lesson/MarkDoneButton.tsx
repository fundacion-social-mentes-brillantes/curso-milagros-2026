"use client";

import { useEffect, useState } from "react";
import { setLessonDone } from "@/lib/progress";
import { getTodayPosition } from "@/lib/ranking";
import { Spinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/utils";

export function MarkDoneButton({
  uid,
  lessonNumber,
  completed,
  completedAt,
}: {
  uid: string;
  lessonNumber: number;
  completed: boolean;
  completedAt: number | null;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(completed);
  const [at, setAt] = useState<number | null>(completedAt);
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Si ya estaba hecha, recupera el puesto de hoy (si la hizo hoy).
  useEffect(() => {
    if (completed) {
      getTodayPosition(uid)
        .then(setPosition)
        .catch(() => {});
    }
  }, [completed, uid]);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await setLessonDone(uid, lessonNumber, next);
      setDone(next);
      setAt(next ? Date.now() : null);
      setPosition(next ? res.position : null);
    } catch {
      setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col items-center gap-3 p-6 text-center">
      {done ? (
        <>
          <span className="text-3xl" aria-hidden>
            🌟
          </span>
          <p className="font-display text-lg font-semibold text-success">
            ¡Lección realizada!
          </p>
          {position && (
            <p className="font-display text-base font-bold text-gold">
              🌅 ¡Hoy fuiste el #{position} en hacer tu lección!
            </p>
          )}
          {at && <p className="text-xs text-muted">Marcada el {formatDateTime(at)}</p>}
          <button
            onClick={() => void toggle(false)}
            disabled={busy}
            className="btn-ghost mt-1"
          >
            {busy ? <Spinner /> : "Desmarcar"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            Cuando termines tu práctica de hoy, márcala para guardar tu avance.
          </p>
          <div className="relative w-full max-w-sm">
            <span
              aria-hidden
              className="absolute -inset-1.5 animate-breathe rounded-full bg-gradient-to-r from-gold via-aqua to-gold opacity-60 blur-lg"
            />
            <button
              onClick={() => void toggle(true)}
              disabled={busy}
              className="relative inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-gold via-gold-soft to-gold px-6 py-4 text-base font-extrabold text-[rgb(12_64_58)] shadow-glow ring-1 ring-gold/60 transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:text-lg"
            >
              {busy ? (
                <Spinner />
              ) : (
                <>
                  <span aria-hidden className="text-xl">
                    ✓
                  </span>
                  Marcar lección como hecha
                </>
              )}
            </button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-warning">{error}</p>}
    </div>
  );
}
