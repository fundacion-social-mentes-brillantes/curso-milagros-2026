import type { LessonVideo } from "@/types";

/**
 * Extrae el ID de un enlace de YouTube (o acepta el ID directo).
 * Acepta: youtu.be/ID, watch?v=ID, /embed/ID, /shorts/ID, /live/ID.
 */
export function youtubeId(input: string): string | null {
  if (!input) return null;
  const m = input.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([a-zA-Z0-9_-]{11})/);
  if (m && m[1]) return m[1];
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

export interface ResolvedVideo {
  kind: "iframe" | "none";
  src: string;
}

/**
 * Convierte la configuración del video en algo reproducible.
 * Solo YouTube: si el enlace no es válido, no se muestra nada (nunca se
 * inyecta una URL arbitraria en el reproductor).
 */
export function resolveVideo(video: LessonVideo): ResolvedVideo {
  if (video.status !== "available" || video.type !== "youtube" || !video.url) {
    return { kind: "none", src: "" };
  }
  const id = youtubeId(video.url);
  return id
    ? { kind: "iframe", src: `https://www.youtube.com/embed/${id}?rel=0` }
    : { kind: "none", src: "" };
}
