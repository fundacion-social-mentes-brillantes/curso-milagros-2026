"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { setLessonDone } from "@/lib/progress";
import { useAuth } from "@/components/providers/AuthProvider";
import { type ErrorApi } from "@/lib/api";
import { MAX_LECCIONES_DIA } from "@/config/site";
import { getLessonRank } from "@/lib/ranking";
import { Spinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/utils";
import { CompartirWhatsApp } from "@/components/lesson/CompartirWhatsApp";

export function MarkDoneButton({
  uid,
  lessonNumber,
  lessonTitle,
  completed,
  completedAt,
  currentLesson,
  mostrarPuesto = true,
  hechasHoy = 0,
}: {
  uid: string;
  lessonNumber: number;
  /** Titulo de la leccion: es la idea que se comparte con el grupo. */
  lessonTitle: string;
  completed: boolean;
  completedAt: number | null;
  /** Lección en la que va la persona (no puede marcar más adelante que esta). */
  currentLesson: number;
  /** El puesto del día ("fuiste el #N") es del plan Pro. */
  mostrarPuesto?: boolean;
  /** Cuántas lleva marcadas hoy, para avisar del tope antes de que lo toque. */
  hechasHoy?: number;
}) {
  const { refrescarPerfil } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(completed);
  const [at, setAt] = useState<number | null>(completedAt);
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoy, setHoy] = useState(hechasHoy);

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
      setHoy(res.hechasHoy);

      /*
       * Volver a leer el perfil AQUÍ no es un detalle: era la causa de que
       * pareciera que solo se podía hacer una lección al día.
       *
       * El perfil se leía UNA vez, al iniciar sesión, y ahí se quedaba. Al
       * marcar la lección 112 el servidor subía `currentLesson` a 113, pero el
       * navegador seguía creyendo que era 112; al abrir la 113 se encontraba
       * con "aún no es tu lección de hoy". Solo recargando la página entera
       * volvía a funcionar, y nadie recarga: se da por hecho que hay un tope
       * diario.
       */
      await refrescarPerfil();
    } catch (err) {
      // El tope del día no es "algo salió mal": es una respuesta esperada y
      // merece decirse con sus palabras, no con un error genérico de conexión.
      const clave = (err as ErrorApi)?.clave;
      setError(
        clave === "limite-diario"
          ? `Hoy ya hiciste ${MAX_LECCIONES_DIA} lecciones. Mañana sigues con esta.`
          : "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.",
      );
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

  // Tope del día alcanzado. Se avisa ANTES de que toque el botón: dejar que lo
  // pulse para luego negárselo es hacerle perder el gesto.
  if (!done && hoy >= MAX_LECCIONES_DIA) {
    return (
      <div className="card flex flex-col items-center gap-3 p-6 text-center">
        <span className="text-3xl" aria-hidden>
          🌙
        </span>
        <p className="font-display text-lg font-semibold">Por hoy ya está</p>
        <p className="max-w-sm text-sm text-muted">
          Hiciste tus <strong className="text-fg">{MAX_LECCIONES_DIA} lecciones</strong> de hoy.
          El Curso pide dejar que cada idea repose y te acompañe el resto del día. Mañana sigues
          con esta.
        </p>
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
          {mostrarPuesto && position && (
            <p className="font-display text-base font-bold text-gold">
              🌅 ¡Fuiste el #{position} en hacer la lección {lessonNumber}!
            </p>
          )}
          {at && <p className="text-xs text-muted">Marcada el {formatDateTime(at)}</p>}
          {/* Compartir con el grupo: solo tiene sentido una vez hecha. */}
          <CompartirWhatsApp lessonNumber={lessonNumber} title={lessonTitle} />

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
          {hoy > 0 && (
            <p className="text-xs text-muted">
              Hoy llevas {hoy} de {MAX_LECCIONES_DIA}.
            </p>
          )}
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
