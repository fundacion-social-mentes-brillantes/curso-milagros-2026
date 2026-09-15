"use client";

import { llamar, llamarSeguro } from "@/lib/api";
import type { CohortArchive } from "@/types";

export interface ResetResult {
  usersReset: number;
  progressDeleted: number;
  archivedLabel: string;
}

/**
 * Comienza un AÑO NUEVO del curso.
 *
 * Todo el trabajo ocurre en el servidor, en una sola operación. Antes se hacía
 * desde el navegador persona por persona: si se cerraba la pestaña a la mitad,
 * media comunidad quedaba reiniciada y la otra media no. Ahora, o se hace
 * entero o no se hace.
 *
 * NO borra nada del año viejo: solo cambia cuál es el ciclo activo. El avance y
 * el ranking anteriores quedan guardados como historia.
 */
export async function resetCourseForNewYear(label: string): Promise<ResetResult> {
  try {
    return await llamar<ResetResult>("/nuevo-anio", {
      metodo: "POST",
      cuerpo: { label },
    });
  } catch (e) {
    // El servidor avisa si el nombre del año nuevo es el mismo que el actual;
    // ese mensaje tiene que llegarle al admin tal cual, no como "falló algo".
    const err = e as { clave?: string };
    if (err.clave === "mismo-ciclo") {
      throw new Error(
        "Ese ya es el nombre del proceso actual. Escribe el nombre del año que COMIENZA.",
      );
    }
    throw new Error("No se pudo iniciar el año nuevo. Inténtalo de nuevo.");
  }
}

/** (Admin) Los años cerrados, del más reciente al más antiguo. */
export async function listCohorts(): Promise<CohortArchive[]> {
  const r = await llamarSeguro<{ cohortes: CohortArchive[] }>("/cohortes", {
    cohortes: [],
  });
  return r.cohortes;
}
