"use client";

import { useEffect, useState } from "react";
import { getUserNotes } from "@/lib/progress";
import { exportarMiLibro } from "@/lib/pdf-export";
import { Spinner } from "@/components/ui/Spinner";

/**
 * "Mi libro del año": junta todo lo que la persona escribió en su cuaderno y
 * se lo entrega en PDF. Solo aparece cuando ya escribió algo (si no, sería un
 * botón vacío que produce culpa).
 */
export function MiLibro({ nombre, uid }: { nombre: string; uid: string }) {
  const [cuantas, setCuantas] = useState<number | null>(null);
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    let vivo = true;
    getUserNotes(uid)
      .then((n) => vivo && setCuantas(n.length))
      .catch(() => vivo && setCuantas(0));
    return () => {
      vivo = false;
    };
  }, [uid]);

  if (!cuantas) return null;

  async function descargar() {
    setBajando(true);
    try {
      const notas = await getUserNotes(uid);
      await exportarMiLibro(nombre, notas);
    } finally {
      setBajando(false);
    }
  }

  return (
    <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold">📓 Mi libro del año</h3>
        <p className="text-sm text-muted">
          Llevas <strong>{cuantas}</strong> {cuantas === 1 ? "día escrito" : "días escritos"} en tu
          cuaderno. Puedes descargarlo cuando quieras.
        </p>
      </div>
      <button onClick={() => void descargar()} disabled={bajando} className="btn-primary">
        {bajando ? <Spinner /> : "Descargar mi libro"}
      </button>
    </div>
  );
}
