"use client";

import { useEffect, useState } from "react";
import { listDailyDone, todayBogota } from "@/lib/ranking";
import { leerDirectorio } from "@/lib/directorio";

interface Fila {
  uid: string;
  nombre: string;
  hora: string;
  leccion: number;
}

/**
 * "Quiénes caminan contigo hoy": el orden en que el grupo hizo su lección.
 *
 * Es del plan que sostiene el proceso (Portador de Luz). Los nombres salen del
 * /directorio, que solo guarda el nombre para mostrar: aquí nunca aparece el
 * correo ni el teléfono de nadie.
 */
export function MisCompaneros({ uid }: { uid: string }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([listDailyDone(todayBogota()), leerDirectorio()])
      .then(([hoy, dir]) => {
        if (!vivo) return;
        setFilas(
          hoy.map((d) => ({
            uid: d.uid,
            nombre: dir[d.uid] || d.name || "Caminante",
            leccion: d.lessonNumber,
            hora: new Intl.DateTimeFormat("es-CO", {
              timeZone: "America/Bogota",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(d.completedAt)),
          })),
        );
      })
      .catch(() => vivo && setFilas([]));
    return () => {
      vivo = false;
    };
  }, []);

  if (!filas || filas.length === 0) return null;

  return (
    <div className="card mt-6 p-4 sm:p-6">
      <h3 className="font-display text-lg font-semibold">Quiénes caminan contigo hoy 🌄</h3>
      <p className="text-sm text-muted">
        El orden en que el grupo hizo su lección hoy. No es una competencia: es
        saber que no vas solo.
      </p>
      <ul className="mt-4 space-y-1.5">
        {filas.map((f, i) => (
          <li
            key={f.uid}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
              f.uid === uid ? "bg-gold/10 ring-1 ring-gold/30" : ""
            }`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-muted">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold">
              {f.nombre}
              {f.uid === uid && <span className="ml-1 text-xs text-gold">(tú)</span>}
            </span>
            <span className="shrink-0 text-xs text-muted">
              lección {f.leccion} · {f.hora}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
