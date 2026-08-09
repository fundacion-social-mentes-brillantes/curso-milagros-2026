"use client";

import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

/**
 * Directorio de compañeros: SOLO el nombre para mostrar.
 *
 * Existe para que quien sostiene el proceso (Portador de Luz) pueda ver con
 * quiénes está caminando, sin que el correo ni el teléfono de nadie salgan del
 * panel de admin. Cada persona escribe únicamente su propio nombre.
 */

/** Guarda (o actualiza) mi nombre en el directorio. Silencioso: nunca estorba. */
export async function guardarMiNombre(uid: string, nombre: string): Promise<void> {
  const limpio = nombre.trim().slice(0, 60);
  if (!limpio) return;
  try {
    await setDoc(doc(getDb(), "directorio", uid), { nombre: limpio });
  } catch {
    /* si no se puede, la app sigue igual */
  }
}

/** Mapa uid → nombre. Solo funciona para Portadores de Luz y admin. */
export async function leerDirectorio(): Promise<Record<string, string>> {
  try {
    const snap = await getDocs(collection(getDb(), "directorio"));
    const out: Record<string, string> = {};
    for (const d of snap.docs) {
      const n = String(d.data().nombre ?? "").trim();
      if (n) out[d.id] = n;
    }
    return out;
  } catch {
    return {};
  }
}
