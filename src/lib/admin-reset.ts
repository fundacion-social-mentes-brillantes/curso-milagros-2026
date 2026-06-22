"use client";

import { addDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { CohortArchive } from "@/types";

export interface ResetResult {
  usersReset: number;
  progressDeleted: number;
  archivedLabel: string;
}

/**
 * Reinicia el AVANCE de todo el grupo para comenzar un nuevo año, pero ANTES
 * guarda un RESUMEN del año que termina (historial), para no perder la memoria
 * de quiénes participaron y cuánto avanzaron.
 *
 * NO toca: cuentas (nombre/correo/país/celular), lecciones/contenido, ni el foro.
 * Solo el admin puede ejecutarlo (las reglas de Firestore lo exigen).
 */
export async function resetCourseForNewYear(label: string): Promise<ResetResult> {
  const db = getDb();
  const cleanLabel = label.trim() || String(new Date().getFullYear());

  // 0) Leer usuarios (sirve para el historial y para el reinicio).
  const docs = (await getDocs(collection(db, "users"))).docs;

  // 1) Guardar el resumen del año (solo inscritas) en la colección "cohorts".
  const participants = docs
    .map((d) => d.data())
    .filter((u) => u.enrolled !== false)
    .map((u) => ({
      name: String(u.fullName || u.displayName || "Caminante"),
      email: String(u.email || ""),
      country: String(u.country || ""),
      completed: Number(u.completedLessonsCount || 0),
      currentLesson: Number(u.currentLesson || 1),
    }))
    .slice(0, 3000);

  const total = participants.length;
  const finishedCount = participants.filter((p) => p.completed >= 365).length;
  const avgCompletion = total
    ? Math.round(participants.reduce((a, p) => a + (p.completed / 365) * 100, 0) / total)
    : 0;
  const avgLesson = total
    ? Math.round(participants.reduce((a, p) => a + p.currentLesson, 0) / total)
    : 0;

  await addDoc(collection(db, "cohorts"), {
    label: cleanLabel,
    archivedAt: Date.now(),
    total,
    finishedCount,
    avgCompletion,
    avgLesson,
    participants,
  });

  // 2) Borrar el progreso (en lotes de 400).
  const progressSnap = await getDocs(collection(db, "progress"));
  let progressDeleted = 0;
  let batch = writeBatch(db);
  let ops = 0;
  for (const d of progressSnap.docs) {
    batch.delete(d.ref);
    ops++;
    progressDeleted++;
    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  // 3) Reiniciar el avance de cada persona (sin tocar sus datos ni rol/inscripción).
  let usersReset = 0;
  batch = writeBatch(db);
  ops = 0;
  for (const d of docs) {
    batch.update(d.ref, {
      currentLesson: 1,
      completedLessonsCount: 0,
      lastCompletedAt: 0,
    });
    ops++;
    usersReset++;
    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  return { usersReset, progressDeleted, archivedLabel: cleanLabel };
}

/** (Admin) Lista los años cerrados (historial), del más reciente al más antiguo. */
export async function listCohorts(): Promise<CohortArchive[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, "cohorts"));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        label: String(data.label ?? ""),
        archivedAt: Number(data.archivedAt ?? 0),
        total: Number(data.total ?? 0),
        finishedCount: Number(data.finishedCount ?? 0),
        avgCompletion: Number(data.avgCompletion ?? 0),
        avgLesson: Number(data.avgLesson ?? 0),
        participants: Array.isArray(data.participants)
          ? (data.participants as CohortArchive["participants"])
          : [],
      };
    })
    .sort((a, b) => b.archivedAt - a.archivedAt);
}
