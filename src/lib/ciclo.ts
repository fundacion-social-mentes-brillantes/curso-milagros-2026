"use client";

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

/**
 * CICLO del curso (el "año" que se está corriendo): "2026", "2027"…
 *
 * Por qué existe: al empezar un año nuevo hay que dejar el avance en cero SIN
 * borrar decenas de miles de registros. Borrarlos costaría más escrituras de
 * las que regala Firebase en un día (20.000) y, si se cortara a la mitad,
 * quedarían datos a medias.
 *
 * En vez de borrar, cada registro de avance y de ranking queda marcado con su
 * ciclo. Al reiniciar, solo se cambia el ciclo activo: lo viejo queda guardado
 * como historia y lo nuevo empieza limpio. Cambiar de año pasa a costar UNA
 * escritura en lugar de decenas de miles.
 */

export const CICLO_POR_DEFECTO = "2026";

let cache: string | null = null;
let cargando: Promise<string> | null = null;

async function leer(): Promise<string> {
  try {
    const snap = await getDoc(doc(getDb(), "config", "curso"));
    const v = snap.exists() ? String(snap.data().ciclo ?? "") : "";
    return v.trim() || CICLO_POR_DEFECTO;
  } catch {
    return CICLO_POR_DEFECTO; // sin conexión o sin permisos: seguimos igual
  }
}

/** Ciclo activo. Se lee una sola vez y queda en memoria. */
export async function cicloActual(): Promise<string> {
  if (cache) return cache;
  cargando ??= leer();
  cache = await cargando;
  return cache;
}

/**
 * Deja el nombre del ciclo seguro para usarlo dentro del id de un documento:
 * solo letras, números y guiones. Un "/" partiría la ruta y rompería la app.
 */
export function limpiarCiclo(texto: string): string {
  const limpio = String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9-]/g, "")
    .slice(0, 20);
  return limpio || String(new Date().getFullYear());
}

/** (Admin) Cambia el ciclo activo: así arranca un año nuevo sin borrar nada. */
export async function fijarCiclo(ciclo: string): Promise<void> {
  const limpio = limpiarCiclo(ciclo);
  await setDoc(doc(getDb(), "config", "curso"), { ciclo: limpio, cambiadoEn: Date.now() });
  cache = limpio;
  cargando = null;
}

/**
 * Identificadores de documento.
 *
 * OJO (compatibilidad): el PRIMER ciclo (2026) mantiene los identificadores de
 * siempre y sus documentos no llevan el campo `ciclo`. Así, el avance que la
 * gente YA tiene sigue viéndose igual, sin migrar nada ni gastar escrituras.
 * A partir del segundo año, todo lleva el ciclo por delante y queda separado.
 */
export function idProgreso(ciclo: string, uid: string, n: number): string {
  return ciclo === CICLO_POR_DEFECTO ? `${uid}_${n}` : `${ciclo}_${uid}_${n}`;
}
export function idRanking(ciclo: string, n: number, uid: string): string {
  return ciclo === CICLO_POR_DEFECTO ? `${n}_${uid}` : `${ciclo}_${n}_${uid}`;
}

/**
 * Filtro para las consultas. En el primer ciclo NO se filtra (los documentos
 * viejos no tienen el campo y quedarían fuera); del segundo año en adelante sí,
 * y así el año nuevo nunca mezcla registros del anterior.
 */
export function filtrarPorCiclo(ciclo: string): boolean {
  return ciclo !== CICLO_POR_DEFECTO;
}
