"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  enCamino,
  pendientesDe,
  reenviarPendientes,
  suscribirPendientes,
  type MarcaPendiente,
} from "@/lib/marcas-pendientes";

/** Una marca recién hecha que todavía va camino al servidor no es un problema todavía. */
const RECIEN = 90_000;

/**
 * Vigila, desde cualquier pantalla, las lecciones marcadas que todavía no
 * llegan al servidor (ver src/lib/marcas-pendientes.ts).
 *
 * Las reenvía solas al abrir la app, al volver a ella (por ejemplo desde
 * WhatsApp), al recuperar la señal y cada medio minuto. Mientras haya alguna,
 * lo dice arriba de la pantalla: una marca perdida no puede volver a pasar en
 * silencio. Cuando queda guardada, avisa unos segundos y refresca el perfil para
 * que «Hoy» y el avance se pongan al día.
 */
export function AvisoMarcasPendientes() {
  const { firebaseUser, refrescarPerfil } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const [pendientes, setPendientes] = useState<MarcaPendiente[]>([]);
  const [guardadas, setGuardadas] = useState<number[]>([]);
  const [intentando, setIntentando] = useState(false);

  useEffect(() => {
    if (!uid) {
      setPendientes([]);
      return;
    }
    const mirar = () => setPendientes(pendientesDe(uid));
    mirar();
    return suscribirPendientes(mirar);
  }, [uid]);

  const intentar = useCallback(async () => {
    if (!uid || pendientesDe(uid).length === 0) return;
    setIntentando(true);
    try {
      const ok = await reenviarPendientes(uid);
      if (ok.length) {
        setGuardadas(ok);
        await refrescarPerfil();
        setTimeout(() => setGuardadas([]), 7000);
      }
    } finally {
      setIntentando(false);
    }
  }, [uid, refrescarPerfil]);

  useEffect(() => {
    if (!uid) return;
    void intentar();
    const alVolver = () => {
      if (document.visibilityState === "visible") void intentar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", alVolver);
    const cada = window.setInterval(() => void intentar(), 30000);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", alVolver);
      window.clearInterval(cada);
    };
  }, [uid, intentar]);

  // Mientras el botón de la lección la está guardando («Guardando tu avance…»)
  // no hace falta alarmar a nadie arriba: el aviso sale si de verdad no se pudo.
  const visibles = uid
    ? pendientes.filter((m) => !(enCamino(uid, m.n) && Date.now() - m.marcadaEn < RECIEN))
    : [];
  if (!uid || (visibles.length === 0 && guardadas.length === 0)) return null;

  const lista = (ns: number[]) =>
    ns.length === 1 ? `la lección ${ns[0]}` : `las lecciones ${ns.slice(0, -1).join(", ")} y ${ns[ns.length - 1]}`;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <div className="vidrio pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-xl">
        {visibles.length > 0 ? (
          <>
            <span aria-hidden>⏳</span>
            <p className="flex-1 text-fg">
              Todavía no {visibles.length === 1 ? "se ha guardado" : "se han guardado"}{" "}
              {lista(visibles.map((m) => m.n).sort((a, b) => a - b))}. Lo seguimos intentando solos.
            </p>
            <button
              onClick={() => void intentar()}
              disabled={intentando}
              className="flex-none rounded-full px-3 py-1.5 text-xs font-semibold text-gold shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.15)]"
            >
              {intentando ? "Intentando…" : "Intentar ahora"}
            </button>
          </>
        ) : (
          <>
            <span aria-hidden>✓</span>
            <p className="flex-1 text-fg">
              Listo: {lista(guardadas)} {guardadas.length === 1 ? "quedó guardada" : "quedaron guardadas"}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
