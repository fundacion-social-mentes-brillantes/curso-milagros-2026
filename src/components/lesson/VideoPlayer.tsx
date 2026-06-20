"use client";

import Image from "next/image";
import { resolveVideo } from "@/lib/video";
import type { LessonVideo } from "@/types";

export function VideoPlayer({ video, title }: { video: LessonVideo; title: string }) {
  const resolved = resolveVideo(video);

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

  return (
    <div className="card aspect-video w-full overflow-hidden bg-black">
      {resolved.kind === "iframe" ? (
        <iframe
          src={resolved.src}
          title={`Video — ${title}`}
          className="h-full w-full"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video src={resolved.src} controls className="h-full w-full" preload="metadata">
          Tu navegador no puede reproducir este video.
        </video>
      )}
    </div>
  );
}
