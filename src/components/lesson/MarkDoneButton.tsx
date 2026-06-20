"use client";

import { useState } from "react";
import { setLessonDone } from "@/lib/progress";
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
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setLessonDone(uid, lessonNumber, next);
      setDone(next);
      setAt(next ? Date.now() : null);
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
          <button
            onClick={() => void toggle(true)}
            disabled={busy}
            className="btn-primary w-full max-w-xs text-base"
          >
            {busy ? <Spinner /> : "Marcar lección como hecha"}
          </button>
        </>
      )}
      {error && <p className="text-sm text-warning">{error}</p>}
    </div>
  );
}
