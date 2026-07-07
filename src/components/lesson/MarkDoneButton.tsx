"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { setLessonDone } from "@/lib/progress";
import { getLessonRank } from "@/lib/ranking";
import { Spinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/utils";

export function MarkDoneButton({
  uid,
  lessonNumber,
  completed,
  completedAt,
  currentLesson,
}: {
  uid: string;
  lessonNumber: number;
  completed: boolean;
  completedAt: number | null;
  /** Lección en la que va la persona (no puede marcar más adelante que esta). */
  currentLesson: number;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(completed);
  const [at, setAt] = useState<number | null>(completedAt);
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Si ya estaba hecha, recupera su puesto EN ESTA lección.
  useEffect(() => {
    if (completed) {
      getLessonRank(uid, lessonNumber)
        .then(setPosition)
        .catch(() => {});
    }
  }, [completed, uid, lessonNumber]);

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

  // Mejora 3: no se puede marcar una lección MÁS ADELANTE de donde va la persona.
  const ahead = !done && lessonNumber > currentLesson;
  if (ahead) {
    return (
      <div className="card flex flex-col items-center gap-3 p-6 text-center">
        <span className="text-3xl" aria-hidden>
          🌱
        </span>
        <p className="font-display text-lg font-semibold">Aún no es tu lección de hoy</p>
        <p className="max-w-sm text-sm text-muted">
          Vas en la <strong className="text-fg">lección {currentLesson}</strong>. El proceso se
          hace <strong>una lección a la vez, en orden</strong>. Cuando termines las anteriores
          podrás marcar esta.
        </p>
        <Link href={`/lecciones/${currentLesson}`} className="btn-primary mt-1">
          Ir a mi lección {currentLesson}
        </Link>
      </div>
    );
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
              🌅 ¡Fuiste el #{position} en hacer la lección {lessonNumber}!
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
