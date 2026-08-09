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

/** Base fija: el mapa que ya viene con la app (public/videos.json). */
async function cargarBase(): Promise<Record<number, string>> {
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

/**
 * Lo último del canal, tal cual lo deja Make cada noche (public/videos-canal.json):
 * la respuesta cruda de YouTube con los títulos y los IDs. Aquí se traduce
 * "LECCIÓN 91 UCDM" → 91. Así Make no tiene que entender nada: solo copia.
 */
async function cargarCanal(): Promise<Record<number, string>> {
  try {
    const res = await fetch("/videos-canal.json", { cache: "no-cache" });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      items?: { snippet?: { title?: string; resourceId?: { videoId?: string } } }[];
    };
    const out: Record<number, string> = {};
    for (const it of data.items ?? []) {
      const titulo = it.snippet?.title ?? "";
      const id = it.snippet?.resourceId?.videoId ?? "";
      const m = titulo.match(/LECCI[OÓ]N\s+(\d{1,3})\b/i);
      if (m && m[1] && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
        const n = Number(m[1]);
        if (n >= 1 && n <= 365 && !out[n]) out[n] = id;
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function cargar(): Promise<Record<number, string>> {
  const [base, canal] = await Promise.all([cargarBase(), cargarCanal()]);
  return { ...base, ...canal }; // lo del canal (más reciente) manda
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
