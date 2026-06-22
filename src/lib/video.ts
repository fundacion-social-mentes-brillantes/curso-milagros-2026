import type { LessonVideo } from "@/types";

/** Extrae el ID de un enlace de Google Drive (o acepta el ID directo). */
export function driveId(input: string): string | null {
  if (!input) return null;
  const byPath = input.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (byPath && byPath[1]) return byPath[1];
  const byQuery = input.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (byQuery && byQuery[1]) return byQuery[1];
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

/** Extrae el ID de un enlace de YouTube (o acepta el ID directo). */
export function youtubeId(input: string): string | null {
  if (!input) return null;
  const m = input.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (m && m[1]) return m[1];
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

export interface ResolvedVideo {
  kind: "iframe" | "video" | "none";
  src: string;
}

/** Convierte la configuración del video en algo reproducible. */
export function resolveVideo(video: LessonVideo): ResolvedVideo {
  if (video.status !== "available" || video.type === "none" || !video.url) {
    return { kind: "none", src: "" };
  }
  if (video.type === "drive") {
    const id = driveId(video.url);
    return id
      ? { kind: "iframe", src: `https://drive.google.com/file/d/${id}/preview` }
      : { kind: "none", src: "" };
  }
  if (video.type === "youtube") {
    const id = youtubeId(video.url);
    return id
      ? { kind: "iframe", src: `https://www.youtube.com/embed/${id}?rel=0` }
      : { kind: "none", src: "" };
  }
  // type === "direct": solo se permiten enlaces http(s) explícitos
  // (evita esquemas peligrosos como javascript:/data: aunque vengan del admin).
  if (/^https?:\/\//i.test(video.url.trim())) {
    return { kind: "video", src: video.url.trim() };
  }
  return { kind: "none", src: "" };
}
