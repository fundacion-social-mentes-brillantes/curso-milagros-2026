"use client";

import Image from "next/image";
import { useRef } from "react";
import { resolveVideo } from "@/lib/video";
import type { LessonVideo } from "@/types";

export function VideoPlayer({ video, title }: { video: LessonVideo; title: string }) {
  const resolved = resolveVideo(video);
  const wrapRef = useRef<HTMLDivElement>(null);

  if (resolved.kind === "none") {
    return (
      <div className="card flex aspect-video w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 to-gold/10 px-4 text-center sm:gap-3">
        <Image
          src="/images/empty-video.png"
          alt="Ilustración de una pantalla de video con un amanecer"
          width={800}
          height={600}
          className="h-24 w-auto max-w-[72%] sm:h-32"
        />
        <div>
          <p className="font-display text-lg font-semibold">Video disponible pronto</p>
          <p className="text-sm text-muted">Estamos preparando el video de esta lección.</p>
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
      <div ref={wrapRef} className="card aspect-video w-full overflow-hidden bg-black">
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

      {/* En celular: botón grande para verlo en pantalla completa y girado. */}
      <button onClick={goFullscreen} className="btn-ghost mt-2 w-full justify-center text-sm sm:hidden">
        ⛶ Ver en pantalla completa
      </button>
      <p className="mt-1 text-center text-xs text-muted sm:hidden">
        Gira tu celular para verlo más grande 🔄
      </p>
    </div>
  );
}
