"use client";

import { llamar, llamarSeguro } from "@/lib/api";
import { lessonDocId } from "@/config/lessons.links";
import { videoDeLeccion } from "@/lib/videos-map";
import { emptyCommentary } from "@/lib/lesson-template";
import type { Lesson, LessonCommentary } from "@/types";

export { emptyCommentary };

/** Normaliza un documento (de Firestore o JSON) a un Lesson completo. */
export function toLesson(id: string, data: Record<string, unknown>): Lesson {
  const c = (data.commentary ?? {}) as Partial<LessonCommentary>;
  const v = (data.video ?? {}) as Partial<Lesson["video"]>;
  return {
    id,
    number: Number(data.number ?? 0),
    title: String(data.title ?? ""),
    originalText: String(data.originalText ?? ""),
    originalTextLoaded: Boolean(data.originalTextLoaded),
    sourceUrl: String(data.sourceUrl ?? ""),
    commentary: { ...emptyCommentary(), ...c },
    commentaryReady: Boolean(data.commentaryReady),
    // Solo YouTube: si viniera un tipo antiguo (drive/direct) se ignora.
    video: {
      type: v.type === "youtube" ? "youtube" : "none",
      url: v.type === "youtube" ? (v.url ?? "") : "",
      status: v.status === "available" ? "available" : "soon",
    },
    commonImageUrl: (data.commonImageUrl as string | null) ?? null,
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
  };
}

/** Lee el archivo estático de una lección (incluido en la app). */
async function fetchStaticLesson(n: number): Promise<Lesson | null> {
  try {
    const res = await fetch(`/lessons/${lessonDocId(n)}.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    return toLesson(lessonDocId(n), (await res.json()) as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Completa el video con el mapa automático (videos.json, que mantiene Make)
 * SOLO si la lección todavía no tiene uno puesto a mano por el admin.
 */
async function conVideoAutomatico(lesson: Lesson): Promise<Lesson> {
  if (lesson.video.url) return lesson; // el admin ya puso uno: manda el suyo
  const id = await videoDeLeccion(lesson.number);
  if (!id) return lesson;
  return { ...lesson, video: { type: "youtube", url: id, status: "available" } };
}

/**
 * Lee una lección. Prioriza la edición del admin (Firestore) y, si no existe,
 * usa el contenido fijo que viaja con la app (public/lessons). En ambos casos
 * el video se completa con el mapa automático si hace falta.
 */
export async function getLessonByNumber(n: number): Promise<Lesson | null> {
  // Primero la edición del admin (si existe); si no, el contenido fijo que
  // viaja con la app. Que la API no responda NO deja a nadie sin su lección.
  const editada = await llamarSeguro<Record<string, unknown> | null>(
    `/lecciones/${n}`,
    null,
    { publica: true },
  );
  if (editada) return conVideoAutomatico(toLesson(lessonDocId(n), editada));
  const estatica = await fetchStaticLesson(n);
  return estatica ? conVideoAutomatico(estatica) : null;
}

interface IndexEntry {
  number: number;
  title: string;
  videoStatus?: string;
}

/** Lista de las 365 lecciones (desde el índice estático; respaldo Firestore). */
export async function listLessons(): Promise<Lesson[]> {
  try {
    const res = await fetch(`/lessons/index.json`, { cache: "no-cache" });
    if (res.ok) {
      const idx = (await res.json()) as IndexEntry[];
      if (Array.isArray(idx) && idx.length > 0) {
        return idx
          .map((e) =>
            toLesson(lessonDocId(e.number), {
              number: e.number,
              title: e.title,
              video: { type: "none", url: "", status: e.videoStatus ?? "soon" },
            }),
          )
          .sort((a, b) => a.number - b.number);
      }
    }
  } catch {
    /* respaldo Firestore */
  }

  // El índice estático viaja dentro de la app, así que llegar aquí significa
  // que el propio sitio no cargó. No hay respaldo mejor que una lista vacía.
  return [];
}

/**
 * Guarda la edición de una lección (crea o actualiza). Como las lecciones
 * viven en archivos, el primer guardado crea el documento de override.
 */
export async function updateLesson(
  n: number,
  patch: Partial<Omit<Lesson, "id">>,
): Promise<void> {
  await llamar(`/lecciones/${n}`, {
    metodo: "PUT",
    cuerpo: { number: n, ...patch },
  });
}
