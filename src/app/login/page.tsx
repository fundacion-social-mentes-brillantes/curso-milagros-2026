"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";
import { SITE } from "@/config/site";

export default function LoginPage() {
  const { firebaseUser, loading, configured, signIn } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (firebaseUser) router.replace("/dashboard");
  }, [firebaseUser, router]);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("popup-closed") || msg.includes("cancelled")) {
        setError("Cerraste la ventana de Google. Inténtalo de nuevo.");
      } else {
        setError("No se pudo iniciar sesión. Revisa tu conexión e inténtalo otra vez.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-12">
      <div className="card w-full max-w-md p-8 text-center animate-fade-up">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-deep text-3xl shadow-glow">
          🌅
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold">Bienvenido a tu camino</h1>
        <p className="mt-2 text-sm text-muted">
          {SITE.name} · {SITE.org}
        </p>

        {!configured ? (
          <p className="mt-6 rounded-xl bg-warning/10 p-4 text-sm text-warning">
            La app aún no está conectada a Firebase. Revisa <code>INSTALACION.md</code>.
          </p>
        ) : (
          <button
            onClick={() => void handleSignIn()}
            disabled={busy || loading}
            className="btn-ghost mt-7 w-full justify-center gap-3 py-3 text-base"
          >
            {busy ? (
              <Spinner />
            ) : (
              <>
                <GoogleIcon /> Continuar con Google
              </>
            )}
          </button>
        )}

        {error && <p className="mt-4 text-sm text-warning">{error}</p>}

        <p className="mt-6 text-xs text-muted">
          Tu cuenta es privada. Solo guardamos tu nombre, correo y avance para acompañarte.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.9 35.9 44 30.4 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
