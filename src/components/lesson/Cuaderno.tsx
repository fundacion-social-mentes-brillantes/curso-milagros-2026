"use client";

import { useEffect, useRef, useState } from "react";
import { getLessonNote, saveLessonNote } from "@/lib/progress";

/**
 * "Mi cuaderno": una o dos líneas privadas por lección.
 *
 * Es lo único del día que escribe la propia persona. Al terminar el año, todas
 * esas líneas se convierten en su libro (PDF). Por eso: sin contador, sin
 * obligación y sin que nadie más lo vea; se guarda solo al dejar de escribir.
 */
export function Cuaderno({ uid, lessonNumber }: { uid: string; lessonNumber: number }) {
  const [texto, setTexto] = useState("");
  const [cargado, setCargado] = useState(false);
  const [estado, setEstado] = useState<"quieto" | "guardando" | "guardado" | "error">("quieto");
  const guardadoRef = useRef("");

  useEffect(() => {
    let vivo = true;
    setCargado(false);
    getLessonNote(uid, lessonNumber)
      .then((n) => {
        if (!vivo) return;
        setTexto(n);
        guardadoRef.current = n;
        setCargado(true);
      })
      .catch(() => vivo && setCargado(true));
    return () => {
      vivo = false;
    };
  }, [uid, lessonNumber]);

  async function guardar() {
    const limpio = texto.trim().slice(0, 1000);
    if (limpio === guardadoRef.current) return;
    setEstado("guardando");
    try {
      await saveLessonNote(uid, lessonNumber, limpio);
      guardadoRef.current = limpio;
      setEstado("guardado");
      setTimeout(() => setEstado("quieto"), 2500);
    } catch {
      // Antes se perdía el texto sin decir nada.
      setEstado("error");
    }
  }

  if (!cargado) return null;

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden>📓</span>
          <h3 className="font-display text-sm font-semibold">Mi cuaderno</h3>
        </div>
        <span className="text-[11px] text-muted">
          {estado === "guardando"
            ? "guardando…"
            : estado === "guardado"
              ? "guardado ✓"
              : estado === "error"
                ? "⚠️ no se pudo guardar, inténtalo de nuevo"
                : "solo tú lo ves"}
        </span>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, 1000))}
        onBlur={() => void guardar()}
        rows={2}
        placeholder="¿Dónde te sirvió hoy esta lección? (una línea basta)"
        className="mt-2 w-full resize-none rounded-xl border border-border bg-bg/50 px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <p className="mt-1 text-[11px] text-muted">
        Al terminar el año, todo lo que escribas aquí será tu libro. 🌱
      </p>
    </div>
  );
}
