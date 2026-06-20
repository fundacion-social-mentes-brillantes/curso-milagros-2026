"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { lessonDocId, TOTAL_LESSONS } from "@/config/lessons.links";
import { buildStubLesson, emptyCommentary } from "@/lib/lesson-template";
import { LESSON_25_COMMENTARY, LESSON_25_TITLE } from "@/data/lesson-25";
import type { Lesson, LessonCommentary } from "@/types";

export { emptyCommentary };

/** Normaliza un documento de Firestore a un Lesson completo (con defaults). */
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

export async function getLessonByNumber(n: number): Promise<Lesson | null> {
  const db = getDb();
  const ref = doc(db, "lessons", lessonDocId(n));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toLesson(snap.id, snap.data());
}

/** Lee todas las lecciones (orden por número). */
export async function listLessons(): Promise<Lesson[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, "lessons"));
  const lessons = snap.docs.map((d) => toLesson(d.id, d.data()));
  lessons.sort((a, b) => a.number - b.number);
  return lessons;
}

/** Actualiza campos de una lección (solo admin, según reglas). */
export async function updateLesson(
  n: number,
  patch: Partial<Omit<Lesson, "id" | "number">>,
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "lessons", lessonDocId(n));
  await updateDoc(ref, { ...patch, updatedAt: Date.now() });
}

/** Crea o reemplaza una lección (admin / seed). */
export async function setLesson(lesson: Lesson): Promise<void> {
  const db = getDb();
  const ref = doc(db, "lessons", lesson.id);
  await setDoc(ref, lesson, { merge: true });
}

/**
 * Crea las 365 lecciones que falten (no toca las existentes) y llena la
 * Lección 25 de ejemplo. Se ejecuta desde el panel admin, con permisos de
 * admin (según reglas). No necesita credenciales de servidor.
 */
export async function seedLessonsClient(
  onProgress?: (done: number, total: number) => void,
): Promise<{ created: number; skipped: number }> {
  const db = getDb();
  const now = Date.now();

  const snap = await getDocs(collection(db, "lessons"));
  const existing = new Set(snap.docs.map((d) => d.id));

  let created = 0;
  let skipped = existing.size;
  let batch = writeBatch(db);
  let ops = 0;

  for (let n = 1; n <= TOTAL_LESSONS; n++) {
    const id = lessonDocId(n);
    if (existing.has(id)) continue;

    const lesson = buildStubLesson(n, now);
    if (n === 25) {
      lesson.title = LESSON_25_TITLE;
      lesson.commentary = LESSON_25_COMMENTARY;
      lesson.commentaryReady = true;
    }

    batch.set(doc(db, "lessons", id), lesson);
    ops++;
    created++;

    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
    onProgress?.(n, TOTAL_LESSONS);
  }
  if (ops > 0) await batch.commit();

  return { created, skipped };
}

/**
 * Importa el texto original de UNA lección llamando a /api/import-lesson
 * (que lee el blog en el servidor) y lo guarda. Crea el doc si no existe.
 */
export async function importLessonTextClient(
  n: number,
): Promise<{ found: boolean; length: number }> {
  const res = await fetch(`/api/import-lesson?n=${n}`);
  if (!res.ok) throw new Error(`No se pudo importar la lección ${n}`);
  const data = (await res.json()) as {
    sourceUrl?: string;
    title?: string;
    originalText?: string;
    found?: boolean;
  };

  const original = String(data.originalText ?? "").trim();
  const db = getDb();
  await setDoc(
    doc(db, "lessons", lessonDocId(n)),
    {
      number: n,
      sourceUrl: data.sourceUrl ?? "",
      originalText: original,
      originalTextLoaded: original.length > 0,
      ...(data.title ? { title: data.title } : {}),
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  return { found: Boolean(data.found), length: original.length };
}
