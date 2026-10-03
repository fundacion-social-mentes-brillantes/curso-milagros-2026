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
  // La animación dorada: arranca al tocar (sin esperar al servidor) y se queda si
  // se guardó; si falla, el botón vuelve a ser de vidrio.
  const [animando, setAnimando] = useState(false);
  const [recienMarcada, setRecienMarcada] = useState(false);

  /*
   * Ponerse al día con lo que llega del servidor.
   *
   * ESTO ARREGLA UN FALLO FEO. La pantalla de la lección se dibuja en cuanto
   * tiene el texto (que es un archivo local, instantáneo), pero el avance viene
   * de la API y llega después. En ese primer dibujo `completed` vale false, y
   * `useState` se queda con ese valor PARA SIEMPRE: cuando el avance llegaba
   * diciendo "sí, ya la hiciste", la pantalla ya no se enteraba.
   *
   * Resultado: abrías una lección que habías hecho y te salía el botón de
   * "Marcar lección como hecha", como si tu avance se hubiera perdido.
   */
  useEffect(() => {
    setDone(completed);
    setAt(completedAt);
  }, [completed, completedAt]);

  // Lo mismo con la cuenta del día, que también llega con el perfil.
  useEffect(() => {
    setHoy(hechasHoy);
  }, [hechasHoy]);

  // Si ya estaba hecha, recupera su puesto EN ESTA lección.
  useEffect(() => {
    if (completed) {
      getLessonRank(uid, lessonNumber)
        .then(setPosition)
        .catch(() => {});
    }
  }, [completed, uid, lessonNumber]);

  async function toggle(next: boolean): Promise<boolean> {
    setBusy(true);
    setError(null);
    if (!next) setRecienMarcada(false);
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
      return true;
    } catch (err) {
      // El tope del día no es "algo salió mal": es una respuesta esperada y
      // merece decirse con sus palabras, no con un error genérico de conexión.
      const clave = (err as ErrorApi)?.clave;
      setError(
        clave === "limite-diario"
          ? `Hoy ya hiciste ${MAX_LECCIONES_DIA} lecciones. Mañana sigues con esta.`
          : "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function marcar() {
    setAnimando(true);
    const ok = await toggle(true);
    if (ok) setRecienMarcada(true);
    setAnimando(false);
  }

  // Mejora 3: no se puede marcar una lección MÁS ADELANTE de donde va la persona.
  const ahead = !done && lessonNumber > currentLesson;
  if (ahead) {
    return (
      <div className="vidrio flex flex-col items-center gap-3 rounded-[1.6rem] p-6 text-center">
        <p className="text-xl text-fg">Aún no es tu lección de hoy</p>
        <p className="max-w-sm text-sm text-muted">
          Vas en la <strong className="font-medium text-fg">lección {currentLesson}</strong>. El proceso se
          hace <strong className="font-medium text-fg">una lección a la vez, en orden</strong>. Cuando termines las anteriores
          podrás marcar esta.
        </p>
        <Link href={`/lecciones/${currentLesson}`} className="boton-cristal mt-1">
          Ir a mi lección {currentLesson}
        </Link>
      </div>
    );
  }

  // Tope del día alcanzado. Se avisa ANTES de que toque el botón: dejar que lo
  // pulse para luego negárselo es hacerle perder el gesto.
  if (!done && hoy >= MAX_LECCIONES_DIA) {
    return (
      <div className="vidrio flex flex-col items-center gap-3 rounded-[1.6rem] p-6 text-center">
        <p className="text-xl text-fg">Por hoy ya está</p>
        <p className="max-w-sm text-sm text-muted">
          Hiciste tus <strong className="font-medium text-fg">{MAX_LECCIONES_DIA} lecciones</strong> de hoy.
          El Curso pide dejar que cada idea repose y te acompañe el resto del día. Mañana sigues
          con esta.
        </p>
      </div>
    );
  }

  /*
   * El botón de vidrio se vuelve de oro al marcar (≈ 800 ms): un punto de luz,
   * la luz recorre el borde, se llena de dorado, aparece el ✓, un resplandor y
   * se calma. Si la lección ya estaba hecha al abrirla, se ve dorado sin más.
   */
  const claseBoton = done ? (recienMarcada || animando ? "leida hecha" : "leida dorada") : animando ? "leida hecha" : "leida";

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {!done && (
        <p className="text-sm text-muted">
          Cuando termines tu práctica de hoy, márcala para guardar tu avance.
          {hoy > 0 && ` Hoy llevas ${hoy} de ${MAX_LECCIONES_DIA}.`}
        </p>
      )}
      <button
        onClick={() => {
          if (!done && !busy) void marcar();
        }}
        disabled={busy}
        aria-live="polite"
        className={claseBoton}
      >
        <span className="llena" />
        <span className="resplandor" />
        <span className="recorre" />
        <span className="punto" />
        <svg className="check" viewBox="0 0 24 24" aria-hidden>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
        <span className="textos">
          <span className="texto-pendiente">Marcar como lección leída</span>
          <span className="texto-hecho">Lección completada</span>
        </span>
      </button>

      {done && (
        <>
          {mostrarPuesto && position && (
            <p className="text-base font-medium text-gold">
              ¡Fuiste el #{position} en hacer la lección {lessonNumber}!
            </p>
          )}
          {at && <p className="text-xs text-muted">Marcada el {formatDateTime(at)}</p>}
          {/* Compartir con el grupo: solo tiene sentido una vez hecha. */}
          <CompartirWhatsApp lessonNumber={lessonNumber} title={lessonTitle} />
          <button onClick={() => void toggle(false)} disabled={busy} className="text-xs font-medium text-muted underline-offset-4 hover:underline">
            {busy ? <Spinner /> : "Desmarcar"}
          </button>
        </>
      )}
      {error && <p className="text-sm text-warning">{error}</p>}
    </div>
  );
}
