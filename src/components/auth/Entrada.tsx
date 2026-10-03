"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Libro, NombreCurso } from "@/components/marca/Libro";
import { Spinner } from "@/components/ui/Spinner";
import { SITE } from "@/config/site";

/**
 * La portada y el acceso son la misma pantalla: el libro, el nombre del curso
 * (la imagen fija de la referencia), «Un paso de paz cada día» y una sola
 * tarjeta de vidrio con lo necesario. Quien ya entró pasa directo a «Hoy».
 */
export function Entrada() {
  const { firebaseUser, loading, configured, signIn } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (firebaseUser) router.replace("/hoy");
  }, [firebaseUser, router]);

  async function entrar() {
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
    <div className="container-page flex min-h-[calc(100dvh-9rem)] flex-col items-center justify-center py-10 text-center">
      <Libro className="aparece w-[4.2rem] [transform:perspective(900px)_rotateX(9deg)] md:w-20" />
      <NombreCurso className="aparece mt-6 w-[min(80vw,20rem)] [animation-delay:.1s] md:w-[28rem]" />
      <p className="aparece mt-4 text-[1.05rem] font-light text-muted [animation-delay:.25s]">{SITE.tagline}</p>

      <section className="vidrio aparece mt-9 w-full max-w-[22rem] rounded-[1.6rem] p-5 [animation-delay:.35s] md:max-w-[24rem]">
        {!configured ? (
          <p className="rounded-xl bg-warning/10 p-4 text-sm text-warning">
            La app aún no está conectada. Revisa <code>INSTALACION.md</code>.
          </p>
        ) : (
          <button onClick={() => void entrar()} disabled={busy || loading} className="boton-cristal w-full">
            {busy ? (
              <Spinner />
            ) : (
              <>
                <span className="grid h-[1.55rem] w-[1.55rem] place-items-center rounded-full bg-white">
                  <GoogleIcon />
                </span>
                Continuar con Google
              </>
            )}
          </button>
        )}
        <Link href="/lecciones" className="mt-4 inline-block text-[0.95rem] font-medium text-muted hover:text-fg">
          Ver las lecciones
        </Link>
        {error && <p className="mt-3 text-sm text-warning">{error}</p>}
      </section>

      <p className="aparece mt-6 max-w-xs text-xs leading-relaxed text-muted/80 [animation-delay:.5s]">
        Tu cuenta es privada. Solo guardamos tu nombre, correo y avance para acompañarte.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.9 35.9 44 30.4 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
