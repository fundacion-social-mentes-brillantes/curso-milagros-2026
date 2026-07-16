"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { lessonDocId } from "@/config/lessons.links";
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
    video: {
      type: v.type ?? "none",
      url: v.url ?? "",
      status: v.status ?? "soon",
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
 * Lee una lección. Prioriza la edición del admin (Firestore) y, si no existe,
 * usa el contenido fijo que viaja con la app (public/lessons).
 */
export async function getLessonByNumber(n: number): Promise<Lesson | null> {
  try {
    const snap = await getDoc(doc(getDb(), "lessons", lessonDocId(n)));
    if (snap.exists()) return toLesson(snap.id, snap.data());
  } catch {
    /* sin conexión / sin permisos → respaldo estático */
  }
  return fetchStaticLesson(n);
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

  try {
    const snap = await getDocs(collection(getDb(), "lessons"));
    return snap.docs
      .map((d) => toLesson(d.id, d.data()))
      .sort((a, b) => a.number - b.number);
  } catch {
    return [];
  }
}

/**
 * Guarda la edición de una lección (crea o actualiza). Como las lecciones
 * viven en archivos, el primer guardado crea el documento de override.
 */
export async function updateLesson(
  n: number,
  patch: Partial<Omit<Lesson, "id">>,
): Promise<void> {
  const ref = doc(getDb(), "lessons", lessonDocId(n));
  await setDoc(ref, { number: n, ...patch, updatedAt: Date.now() }, { merge: true });
}
