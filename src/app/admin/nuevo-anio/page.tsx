"use client";

import Link from "next/link";
import { useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { resetCourseForNewYear, type ResetResult } from "@/lib/admin-reset";
import { Spinner } from "@/components/ui/Spinner";

const PHRASE = "REINICIAR";

function NewYearInner() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = text.trim().toUpperCase() === PHRASE;

  async function run() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await resetCourseForNewYear();
      setDone(result);
      setText("");
    } catch {
      setError("No se pudo completar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin" className="text-sm text-muted hover:text-fg">
          ← Volver al panel
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold">Comenzar nuevo año</h1>
        <p className="mt-2 text-muted">
          Reinicia el avance de todo el grupo para empezar el proceso desde la lección 1.
        </p>

        {done ? (
          <div className="card mt-6 p-7 text-center animate-fade-up">
            <span className="text-4xl" aria-hidden>
              🌅
            </span>
            <h2 className="mt-3 font-display text-2xl font-semibold text-success">
              ¡Nuevo año iniciado!
            </h2>
            <p className="mt-2 text-sm text-muted">
              Se reinició el avance de <strong>{done.usersReset}</strong>{" "}
              {done.usersReset === 1 ? "persona" : "personas"}. Todas comienzan en la lección 1.
              Las cuentas, las lecciones y el foro quedaron intactos.
            </p>
            <Link href="/admin" className="btn-primary mt-6">
              Ir al panel
            </Link>
          </div>
        ) : (
          <div className="card mt-6 overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-gold via-gold-soft to-warning" />
            <div className="p-6 sm:p-7">
              <div className="rounded-2xl border border-warning/40 bg-warning/10 p-5">
                <p className="font-display text-lg font-bold text-warning">
                  Al confirmar, esto hará:
                </p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  <li>
                    🔄 Todas las personas vuelven a la <strong>lección 1</strong> (avance y
                    lecciones completadas a cero).
                  </li>
                  <li>📊 Las estadísticas del panel arrancan limpias.</li>
                </ul>
                <p className="mt-4 text-sm font-semibold">No se borra ni se pierde nada de esto:</p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted">
                  <li>🔒 Las cuentas de las personas (nombre, correo, país, celular).</li>
                  <li>🔒 Las 365 lecciones, con sus textos, imágenes y videos.</li>
                  <li>🔒 Los mensajes del foro (se conservan como recuerdo).</li>
                </ul>
                <p className="mt-4 text-sm text-muted">
                  Esta acción <strong>no se puede deshacer</strong>. Úsala solo cuando de verdad
                  vayas a comenzar un nuevo año.
                </p>
              </div>

              <label className="mt-6 block">
                <span className="text-sm font-semibold">
                  Para confirmar, escribe{" "}
                  <span className="font-mono text-warning">REINICIAR</span>
                </span>
                <input
                  className="input mt-1.5"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="REINICIAR"
                  autoComplete="off"
                  autoCapitalize="characters"
                />
              </label>

              {error && <p className="mt-3 text-sm text-warning">{error}</p>}

              <button
                onClick={() => void run()}
                disabled={!ready || busy}
                className="btn-gold mt-5 w-full"
              >
                {busy ? <Spinner /> : "Comenzar nuevo año (reiniciar el avance)"}
              </button>
              {!ready && (
                <p className="mt-2 text-center text-xs text-muted">
                  El botón se activa cuando escribas la palabra exacta.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewYearPage() {
  return (
    <RouteGuard requireAdmin>
      <NewYearInner />
    </RouteGuard>
  );
}
