"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveVideo } from "@/lib/video";
import { imagenLeccion } from "@/config/assets";
import { lessonDocId } from "@/config/lessons.links";
import type { LessonVideo } from "@/types";

type ElementoConWebkit = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type DocumentoConWebkit = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
};
type Orientacion = ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };

/**
 * El video de la lección, embebido en la página y rodeado de luz dorada: solo
 * hay que tocar Play. Si todavía no hay video, se ve la imagen de la lección
 * con el aviso de que viene pronto.
 *
 * «Ver en pantalla completa» (en celulares y tabletas) funciona distinto según
 * lo que deje cada navegador (lo pidió la hermana de Sebastián, 7 oct 2026):
 *  - Android, iPad y computador: pantalla completa de verdad. En el celular,
 *    YA dentro de la pantalla completa, se gira a horizontal para que el video
 *    la llene (girar antes de entrar no funciona: por eso quedaban franjas).
 *  - iPhone: Safari no deja poner en pantalla completa nada que no sea su propio
 *    reproductor, así que se abre un «modo cine» que cubre toda la pantalla. Si
 *    el teléfono está vertical, el video se acuesta para llenarla (aunque tenga
 *    bloqueado el giro): basta con voltear el teléfono. Es el mismo reproductor,
 *    así que el video sigue donde iba.
 */
export function VideoPlayer({ video, title, numero }: { video: LessonVideo; title: string; numero?: number }) {
  const resolved = resolveVideo(video);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [conImagen, setConImagen] = useState(true);
  const [cine, setCine] = useState(false);

  // Al salir de la pantalla completa de verdad, se suelta el giro.
  useEffect(() => {
    const alCambiar = () => {
      const d = document as DocumentoConWebkit;
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        try {
          (screen.orientation as Orientacion | undefined)?.unlock?.();
        } catch {
          /* no todos los navegadores lo tienen */
        }
      }
    };
    document.addEventListener("fullscreenchange", alCambiar);
    document.addEventListener("webkitfullscreenchange", alCambiar);
    return () => {
      document.removeEventListener("fullscreenchange", alCambiar);
      document.removeEventListener("webkitfullscreenchange", alCambiar);
    };
  }, []);

  const cerrarCine = useCallback(() => setCine(false), []);

  // Modo cine: la página no se desplaza detrás, y «atrás» (o deslizar) lo cierra
  // en vez de salir de la lección.
  useEffect(() => {
    if (!cine) return;
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = "hidden";
    history.pushState({ ucdmCine: true }, "");
    const alVolver = () => setCine(false);
    window.addEventListener("popstate", alVolver);
    const alTecla = (e: KeyboardEvent) => e.key === "Escape" && setCine(false);
    window.addEventListener("keydown", alTecla);
    return () => {
      html.style.overflow = antes;
      window.removeEventListener("popstate", alVolver);
      window.removeEventListener("keydown", alTecla);
      // Si se cerró con el botón, se quita la entrada que se puso en el historial.
      if ((history.state as { ucdmCine?: boolean } | null)?.ucdmCine) history.back();
    };
  }, [cine]);

  if (resolved.kind === "none") {
    return (
      <div className="halo-oro relative aspect-video w-full overflow-hidden rounded-[1.4rem] bg-[rgb(var(--surface))]">
        {numero && conImagen && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagenLeccion(lessonDocId(numero))}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setConImagen(false)}
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/70" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-left">
          <p className="text-base font-medium text-white">Video disponible pronto</p>
          <p className="text-sm text-white/75">Estamos preparando el video de esta lección.</p>
        </div>
      </div>
    );
  }

  async function pantallaCompleta() {
    const el = wrapRef.current as ElementoConWebkit | null;
    if (!el) return;
    const d = document as DocumentoConWebkit;
    const permitida = Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
    if (permitida && (el.requestFullscreen || el.webkitRequestFullscreen)) {
      try {
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
        else await el.webkitRequestFullscreen?.();
        try {
          // Ya en pantalla completa: a horizontal (Android). En computador o iPad no aplica.
          await (screen.orientation as Orientacion | undefined)?.lock?.("landscape");
        } catch {
          /* sin bloqueo de giro: se queda como esté el teléfono */
        }
        return;
      } catch {
        /* el navegador no quiso: queda el modo cine */
      }
    }
    setCine(true);
  }

  return (
    <div>
      <div
        ref={wrapRef}
        className={
          cine
            ? "video-cine"
            : "video-marco halo-oro aspect-video w-full overflow-hidden rounded-[1.4rem] bg-black"
        }
      >
        <div className="escenario">
          <iframe
            src={resolved.src}
            title={`Video — ${title}`}
            className="h-full w-full"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
          {cine && (
            <button onClick={cerrarCine} className="cerrar-cine" aria-label="Salir de la pantalla completa">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* En celulares y tabletas: verlo en pantalla completa (en computador está el botón de YouTube). */}
      <button
        onClick={() => void pantallaCompleta()}
        className="btn-ghost mt-3 hidden w-full justify-center text-sm [@media(pointer:coarse)]:inline-flex"
      >
        Ver en pantalla completa
      </button>
    </div>
  );
}
