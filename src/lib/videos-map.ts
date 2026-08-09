"use client";

/**
 * Mapa lección → video de YouTube.
 *
 * Vive en `public/videos.json` y lo mantiene AL DÍA, solo, el escenario de
 * Make: cada noche lee los videos del canal de GEMB (títulos "LECCIÓN N UCDM"),
 * arma el mapa completo y lo guarda. Al ser una sincronización total, si una
 * noche falla, la siguiente lo deja al día otra vez.
 *
 * El admin puede seguir poniendo un enlace a mano desde /admin/lecciones: esa
 * edición manual (Firestore) tiene prioridad sobre este mapa.
 */

let cache: Record<number, string> | null = null;
let cargando: Promise<Record<number, string>> | null = null;

async function cargar(): Promise<Record<number, string>> {
  try {
    const res = await fetch("/videos.json", { cache: "no-cache" });
    if (!res.ok) return {};
    const data = (await res.json()) as { videos?: Record<string, string> };
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(data.videos ?? {})) {
      const n = Number(k);
      if (Number.isFinite(n) && typeof v === "string" && v.trim()) out[n] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

/** Devuelve el ID/enlace de YouTube de una lección, o null si aún no hay. */
export async function videoDeLeccion(n: number): Promise<string | null> {
  if (!cache) {
    cargando ??= cargar();
    cache = await cargando;
  }
  return cache[n] ?? null;
}

/** Olvida lo cacheado (por si el admin acaba de cambiar algo). */
export function olvidarMapaVideos(): void {
  cache = null;
  cargando = null;
}
