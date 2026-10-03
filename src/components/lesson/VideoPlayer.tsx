"use client";

import { useRef, useState } from "react";
import { resolveVideo } from "@/lib/video";
import { imagenLeccion } from "@/config/assets";
import { lessonDocId } from "@/config/lessons.links";
import type { LessonVideo } from "@/types";

/**
 * El video de la lección, embebido en la página y rodeado de luz dorada: solo
 * hay que tocar Play. Si todavía no hay video, se ve la imagen de la lección
 * con el aviso de que viene pronto.
 */
export function VideoPlayer({ video, title, numero }: { video: LessonVideo; title: string; numero?: number }) {
  const resolved = resolveVideo(video);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [conImagen, setConImagen] = useState(true);

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

  // Pone el video a pantalla completa e intenta girarlo a horizontal (celular).
  function goFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    const anyEl = el as HTMLElement & {
      webkitRequestFullscreen?: () => void;
    };
    try {
      if (el.requestFullscreen) void el.requestFullscreen();
      else if (anyEl.webkitRequestFullscreen) anyEl.webkitRequestFullscreen();
    } catch {
      /* algunos navegadores no lo permiten desde aquí */
    }
    try {
      const orient = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      orient?.lock?.("landscape").catch(() => {});
    } catch {
      /* el bloqueo de orientación no está disponible en todos lados */
    }
  }

  return (
    <div>
      <div ref={wrapRef} className="halo-oro aspect-video w-full overflow-hidden rounded-[1.4rem] bg-black">
        {resolved.kind === "iframe" ? (
          <iframe
            src={resolved.src}
            title={`Video — ${title}`}
            className="h-full w-full"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video src={resolved.src} controls playsInline className="h-full w-full" preload="metadata">
            Tu navegador no puede reproducir este video.
          </video>
        )}
      </div>

      {/* En celular: verlo en pantalla completa y girado. */}
      <button onClick={goFullscreen} className="btn-ghost mt-3 w-full justify-center text-sm sm:hidden">
        Ver en pantalla completa
      </button>
    </div>
  );
}
