"use client";

import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { lessonDocId } from "@/config/lessons.links";
import { bogotaDateStr, clampLesson } from "@/lib/utils";
import { isPermanentAdmin } from "@/lib/admins";
import { cicloActual, filtrarPorCiclo, idProgreso, idRanking } from "@/lib/ciclo";
import type { Progress } from "@/types";

/** Minuto del día (0..1439) en horario de Colombia. */
function minutoDelDiaBogota(ms: number): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0);
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** Id del avance: lleva el ciclo delante para no mezclar años. */
async function progressId(uid: string, n: number): Promise<string> {
  return idProgreso(await cicloActual(), uid, n);
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
  const snap = await getDoc(doc(db, "progress", await progressId(uid, n)));
  return snap.exists() ? toProgress(snap.id, snap.data()) : null;
}

export function subscribeUserProgress(
  uid: string,
  cb: (items: Progress[]) => void,
): () => void {
  const db = getDb();
  let parar: (() => void) | null = null;
  let cancelado = false;
  // Solo el avance del ciclo (año) que se está corriendo.
  void cicloActual().then((ciclo) => {
    if (cancelado) return;
    const q = query(
      collection(db, "progress"),
      where("userId", "==", uid),
      ...(filtrarPorCiclo(ciclo) ? [where("ciclo", "==", ciclo)] : []),
    );
    parar = onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => toProgress(d.id, d.data())));
    });
  });
  return () => {
    cancelado = true;
    parar?.();
  };
}

export async function getUserProgress(uid: string): Promise<Progress[]> {
  const db = getDb();
  const ciclo = await cicloActual();
  const q = query(
    collection(db, "progress"),
    where("userId", "==", uid),
    ...(filtrarPorCiclo(ciclo) ? [where("ciclo", "==", ciclo)] : []),
  );
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
): Promise<{ position: number | null }> {
  const db = getDb();
  const now = Date.now();
  const ciclo = await cicloActual();
  await setDoc(
    doc(db, "progress", idProgreso(ciclo, uid, n)),
    {
      userId: uid,
      ciclo,
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
      ...(filtrarPorCiclo(ciclo) ? [where("ciclo", "==", ciclo)] : []),
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

  // Ranking POR LECCIÓN: el puesto refleja en qué orden hiciste ESTA lección
  // (no el día). Así, si vas atrasado y haces la 40 mientras otros van en la 41,
  // tu puesto es el de la lección 40. Un registro por lección por persona.
  // Va en try/catch para que NUNCA impida marcar la lección como hecha.
  let position: number | null = null;
  // La cuenta de gestión de la fundación no entra al ranking (no es participante).
  const isFoundationAccount = isPermanentAdmin(String(userSnap.data()?.email ?? ""));
  if (completed && !isFoundationAccount) {
    try {
      const ddRef = doc(db, "dailyDone", idRanking(ciclo, n, uid));
      const ddSnap = await getDoc(ddRef);
      if (ddSnap.exists()) {
        position = Number(ddSnap.data().position ?? 0) || null;
      } else {
        const cnt = await getCountFromServer(
          query(
            collection(db, "dailyDone"),
            ...(filtrarPorCiclo(ciclo) ? [where("ciclo", "==", ciclo)] : []),
            where("lessonNumber", "==", n),
          ),
        );
        position = cnt.data().count + 1;
        // Sin el nombre: era un dato personal que cualquiera con sesión podía
        // leer. El nombre para mostrar vive en /directorio (solo Portadores).
        await setDoc(ddRef, {
          uid,
          ciclo,
          date: bogotaDateStr(now),
          completedAt: now,
          position,
          lessonNumber: n,
        });
        // Acumulado del ranking EN EL PROPIO PERFIL. Así el panel de admin ya
        // no tiene que leer toda la colección dailyDone (eso se comía la cuota
        // gratis de Firebase: miles de lecturas cada vez que se abría /admin).
        await updateDoc(userRef, {
          rankDias: increment(1),
          rankSumaPuesto: increment(position),
          rankSumaMinuto: increment(minutoDelDiaBogota(now)),
        });
      }
    } catch {
      position = null;
    }
  }

  return { position };
}

/**
 * "Mi cuaderno": nota corta y PRIVADA de la persona para una lección.
 * Vive en el mismo documento del avance (no hace falta otra colección).
 */
export async function getLessonNote(uid: string, n: number): Promise<string> {
  const db = getDb();
  try {
    const snap = await getDoc(doc(db, "progress", await progressId(uid, n)));
    return snap.exists() ? String(snap.data().nota ?? "") : "";
  } catch {
    return "";
  }
}

export async function saveLessonNote(uid: string, n: number, nota: string): Promise<void> {
  const db = getDb();
  const ciclo = await cicloActual();
  await setDoc(
    doc(db, "progress", idProgreso(ciclo, uid, n)),
    {
      userId: uid,
      ciclo,
      lessonId: lessonDocId(n),
      lessonNumber: n,
      nota: nota.slice(0, 1000),
      notaEn: Date.now(),
    },
    { merge: true },
  );
}

/** Todas las notas del ciclo actual, de la más vieja a la más nueva. */
export async function getUserNotes(
  uid: string,
): Promise<{ lessonNumber: number; nota: string; notaEn: number }[]> {
  const items = await getUserProgress(uid);
  const db = getDb();
  const ciclo = await cicloActual();
  const q = query(
    collection(db, "progress"),
    where("userId", "==", uid),
    ...(filtrarPorCiclo(ciclo) ? [where("ciclo", "==", ciclo)] : []),
  );
  const snap = await getDocs(q);
  void items;
  return snap.docs
    .map((d) => ({
      lessonNumber: Number(d.data().lessonNumber ?? 0),
      nota: String(d.data().nota ?? "").trim(),
      notaEn: Number(d.data().notaEn ?? 0),
    }))
    .filter((x) => x.nota.length > 0)
    .sort((a, b) => a.lessonNumber - b.lessonNumber);
}
