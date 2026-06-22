"use client";

import { collection, getDocs, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export interface ResetResult {
  usersReset: number;
  progressDeleted: number;
}

/**
 * Reinicia el AVANCE de todo el grupo para comenzar un nuevo año:
 * - Borra todos los documentos de progreso (lecciones marcadas).
 * - Pone a cada persona en la lección 1 (avance y contador a cero).
 *
 * NO toca: cuentas (nombre/correo/país/celular), lecciones/contenido, ni el foro.
 * Solo el admin puede ejecutarlo (las reglas de Firestore lo exigen).
 */
export async function resetCourseForNewYear(): Promise<ResetResult> {
  const db = getDb();

  // 1) Borrar todos los documentos de progreso, en lotes (máx. 400 por lote).
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

  // 2) Reiniciar el avance de cada persona (sin tocar sus datos ni su rol/inscripción).
  const usersSnap = await getDocs(collection(db, "users"));
  let usersReset = 0;
  batch = writeBatch(db);
  ops = 0;
  for (const d of usersSnap.docs) {
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

  return { usersReset, progressDeleted };
}
