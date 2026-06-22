"use client";

import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { lessonDocId } from "@/config/lessons.links";
import { clampLesson } from "@/lib/utils";
import type { Progress } from "@/types";

function progressId(uid: string, n: number): string {
  return `${uid}_${n}`;
}

function toProgress(id: string, data: Record<string, unknown>): Progress {
  return {
    id,
    userId: String(data.userId ?? ""),
    lessonId: String(data.lessonId ?? ""),
    lessonNumber: Number(data.lessonNumber ?? 0),
    completed: Boolean(data.completed),
    completedAt: (data.completedAt as number | null) ?? null,
  };
}

export async function getLessonProgress(
  uid: string,
  n: number,
): Promise<Progress | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, "progress", progressId(uid, n)));
  return snap.exists() ? toProgress(snap.id, snap.data()) : null;
}

export function subscribeUserProgress(
  uid: string,
  cb: (items: Progress[]) => void,
): () => void {
  const db = getDb();
  const q = query(collection(db, "progress"), where("userId", "==", uid));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toProgress(d.id, d.data())));
  });
}

export async function getUserProgress(uid: string): Promise<Progress[]> {
  const db = getDb();
  const q = query(collection(db, "progress"), where("userId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toProgress(d.id, d.data()));
}

/**
 * Marca (o desmarca) una lección como hecha, guarda fecha/hora y actualiza
 * el progreso de la persona (conteo + lección actual + última actividad).
 */
export async function setLessonDone(
  uid: string,
  n: number,
  completed: boolean,
): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await setDoc(
    doc(db, "progress", progressId(uid, n)),
    {
      userId: uid,
      lessonId: lessonDocId(n),
      lessonNumber: n,
      completed,
      completedAt: completed ? now : null,
    },
    { merge: true },
  );

  // Recalcula el total de lecciones completadas.
  const countSnap = await getCountFromServer(
    query(
      collection(db, "progress"),
      where("userId", "==", uid),
      where("completed", "==", true),
    ),
  );
  const completedCount = countSnap.data().count;

  // Avanza la "lección actual" si corresponde.
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  const current = Number(userSnap.data()?.currentLesson ?? 1);
  const nextCurrent = completed ? Math.max(current, clampLesson(n + 1)) : current;

  await updateDoc(userRef, {
    completedLessonsCount: completedCount,
    currentLesson: nextCurrent,
    lastActivityAt: now,
    // Solo al COMPLETAR registramos la fecha (para "quién hizo la lección hoy").
    ...(completed ? { lastCompletedAt: now } : {}),
  });
}
