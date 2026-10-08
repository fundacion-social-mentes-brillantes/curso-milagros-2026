"use client";

import { avanceDemo, esDemo } from "@/lib/demo";
import { llamar, llamarSeguro, cargarUnaVez } from "@/lib/api";
import { lessonDocId } from "@/config/lessons.links";
import { bogotaDateStr } from "@/lib/utils";
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
  if (process.env.NODE_ENV === "development" && esDemo()) return avanceDemo().find((p) => p.lessonNumber === n) ?? null;
  const a = await llamarSeguro<AvanceApi | null>(`/avance/${n}`, null);
  return a ? aProgress(uid, a) : null;
}

export async function getUserProgress(uid: string): Promise<Progress[]> {
  if (process.env.NODE_ENV === "development" && esDemo()) return avanceDemo();
  const r = await llamarSeguro<{ avance: AvanceApi[] }>("/avance", { avance: [] });
  return r.avance.map((a) => aProgress(uid, a));
}

/**
 * LA LECCIÓN DEL DÍA: la que se practica hoy, que no siempre es `currentLesson`.
 *
 * Al marcar una lección, el servidor sube `currentLesson` a la siguiente en el
 * acto. Si «Hoy» mostrara siempre ese número, la persona marca la 134 por la
 * mañana y la pantalla salta a la 135 cuando el Curso le pide seguir repitiendo
 * la idea de la 134 todo el día. Valeria lo reportó así el 8-oct-2026.
 *
 * Regla: si hoy (hora de Colombia, desde la medianoche) marcó la lección que va
 * justo antes de la que le toca, esa es la del día; si no, la que le toca. Si
 * hoy marcó varias para ponerse al día (132, 133 y 134), la del día es la 134.
 * Volver a marcar hoy una lección vieja no cuenta: no es la que está practicando.
 *
 * Es la misma regla que usa el recordatorio de las 3 a. m.
 * (api/src/functions/recordatorio.js): quien practica de madrugada recibe los
 * avisos de la lección que acaba de hacer. Si se cambia una, cambiar la otra.
 */
export function leccionDelDia(
  currentLesson: number,
  avance: Progress[],
  ahora: number = Date.now(),
): { numero: number; hechaHoy: boolean } {
  const hoy = bogotaDateStr(ahora);
  let mayor = 0;
  for (const p of avance) {
    if (p.completed && p.completedAt && bogotaDateStr(p.completedAt) === hoy) {
      mayor = Math.max(mayor, p.lessonNumber);
    }
  }
  // Al marcar, la lección actual pasa a la siguiente; con la 365 se queda en 365.
  const recienHecha = mayor > 0 && (mayor === currentLesson - 1 || (mayor === 365 && currentLesson === 365));
  return recienHecha ? { numero: mayor, hechaHoy: true } : { numero: currentLesson, hechaHoy: false };
}

/** ¿Marcó alguna lección hoy? Sirve para no pedir el avance entero sin necesidad. */
export function marcoAlgoHoy(lastCompletedAt: number | null | undefined, ahora: number = Date.now()): boolean {
  return Boolean(lastCompletedAt) && bogotaDateStr(Number(lastCompletedAt)) === bogotaDateStr(ahora);
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
): Promise<{ position: number | null; hechasHoy: number }> {
  if (process.env.NODE_ENV === "development" && esDemo()) {
    await new Promise((r) => setTimeout(r, 450));
    return { position: completed ? 3 : null, hechasHoy: completed ? 1 : 0 };
  }
  /*
   * OJO: esto NO lleva try/catch, y es a propósito.
   *
   * Antes lo tenía, con la idea de que no poder calcular el puesto del ranking
   * no impidiera seguir. Pero el catch se tragaba TODA la llamada, no solo el
   * puesto: si el servidor rechazaba la petición, la pantalla decía "hecha"
   * igual y la lección no se había guardado en ninguna parte.
   *
   * Ahora el error sube, y quien llama decide qué decir. El puesto ya viene
   * protegido en el servidor: si el ranking falla, la lección se marca igual y
   * `position` llega en null.
   */
  const r = await llamar<{ position: number | null; hechasHoy?: number }>(
    `/avance/${n}`,
    { metodo: "POST", cuerpo: { completed } },
  );
  return { position: r.position ?? null, hechasHoy: Number(r.hechasHoy ?? 0) };
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
