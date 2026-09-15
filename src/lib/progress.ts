"use client";

import { llamar, llamarSeguro, cargarUnaVez } from "@/lib/api";
import { lessonDocId } from "@/config/lessons.links";
import type { Progress } from "@/types";

/**
 * Avance de la persona: qué lecciones lleva hechas y las notas de su cuaderno.
 *
 * Todo el cálculo delicado —avanzar la lección actual, recontar las hechas y
 * repartir el puesto del ranking— ocurre ahora en el servidor, en una sola
 * operación. Antes se hacía desde el navegador en varios pasos, y si alguien
 * cerraba la página a medias podía quedar descuadrado.
 */

interface AvanceApi {
  lessonNumber: number;
  completed: boolean;
  completedAt: number | null;
  nota?: string;
  notaEn?: number;
}

function aProgress(uid: string, a: AvanceApi): Progress {
  return {
    id: `${uid}_${a.lessonNumber}`,
    userId: uid,
    lessonId: lessonDocId(a.lessonNumber),
    lessonNumber: a.lessonNumber,
    completed: Boolean(a.completed),
    completedAt: a.completedAt ?? null,
  };
}

export async function getLessonProgress(
  uid: string,
  n: number,
): Promise<Progress | null> {
  const a = await llamarSeguro<AvanceApi | null>(`/avance/${n}`, null);
  return a ? aProgress(uid, a) : null;
}

export async function getUserProgress(uid: string): Promise<Progress[]> {
  const r = await llamarSeguro<{ avance: AvanceApi[] }>("/avance", { avance: [] });
  return r.avance.map((a) => aProgress(uid, a));
}

/** Todo mi avance. Ya no es en vivo; se pide una vez al abrir la pantalla. */
export function subscribeUserProgress(
  uid: string,
  cb: (items: Progress[]) => void,
): () => void {
  return cargarUnaVez(() => getUserProgress(uid), cb);
}

/**
 * Marca (o desmarca) una lección como hecha.
 *
 * Devuelve el puesto que le tocó en ESA lección (1º = la primera persona en
 * hacerla), o null si no aplica. El puesto es del servidor: así no hay dos
 * personas que se crean la misma posición.
 */
export async function setLessonDone(
  _uid: string,
  n: number,
  completed: boolean,
): Promise<{ position: number | null }> {
  try {
    const r = await llamar<{ position: number | null }>(`/avance/${n}`, {
      metodo: "POST",
      cuerpo: { completed },
    });
    return { position: r.position ?? null };
  } catch {
    // Que no se pueda calcular el puesto no debe impedir seguir con el proceso.
    return { position: null };
  }
}

/** "Mi cuaderno": nota corta y PRIVADA para una lección. */
export async function getLessonNote(_uid: string, n: number): Promise<string> {
  const a = await llamarSeguro<AvanceApi | null>(`/avance/${n}`, null);
  return String(a?.nota ?? "");
}

export async function saveLessonNote(
  _uid: string,
  n: number,
  nota: string,
): Promise<void> {
  await llamar(`/avance/${n}/nota`, { metodo: "PUT", cuerpo: { nota } });
}

/** Todas mis notas, de la lección más vieja a la más nueva. */
export async function getUserNotes(
  _uid: string,
): Promise<{ lessonNumber: number; nota: string; notaEn: number }[]> {
  const r = await llamarSeguro<{
    notas: { lessonNumber: number; nota: string; notaEn: number }[];
  }>("/notas", { notas: [] });
  return r.notas;
}
