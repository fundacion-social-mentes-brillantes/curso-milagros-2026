"use client";

import { llamar, llamarSeguro } from "@/lib/api";

/**
 * CICLO del curso (el "año" que se está corriendo): "2026", "2027"…
 *
 * Por qué existe: al empezar un año nuevo hay que dejar el avance en cero SIN
 * borrar nada. Cada registro queda marcado con su ciclo; al reiniciar solo se
 * cambia cuál es el ciclo activo, y lo viejo queda guardado como historia.
 * Cambiar de año cuesta UNA escritura en vez de decenas de miles.
 *
 * En Azure el ciclo forma parte de la "partición" donde vive cada dato, así que
 * el año nuevo empieza literalmente en otro cajón: es imposible que se mezclen.
 */

export const CICLO_POR_DEFECTO = "2026";

let cache: string | null = null;
let cargando: Promise<string> | null = null;

async function leer(): Promise<string> {
  const r = await llamarSeguro<{ ciclo: string }>(
    "/config",
    { ciclo: CICLO_POR_DEFECTO },
    { publica: true },
  );
  return String(r.ciclo || "").trim() || CICLO_POR_DEFECTO;
}

/** Ciclo activo. Se lee una sola vez y queda en memoria. */
export async function cicloActual(): Promise<string> {
  if (cache) return cache;
  cargando ??= leer();
  cache = await cargando;
  return cache;
}

/**
 * Deja el nombre del ciclo seguro para usarlo como parte de una ruta:
 * solo letras, números y guiones.
 */
export function limpiarCiclo(texto: string): string {
  const limpio = String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9-]/g, "")
    .slice(0, 20);
  return limpio || String(new Date().getFullYear());
}

/** (Admin) Cambia el ciclo activo: así arranca un año nuevo sin borrar nada. */
export async function fijarCiclo(ciclo: string): Promise<void> {
  const limpio = limpiarCiclo(ciclo);
  await llamar("/config", { metodo: "PUT", cuerpo: { ciclo: limpio } });
  cache = limpio;
  cargando = null;
}
