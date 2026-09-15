"use client";

import { llamarSeguro } from "@/lib/api";

/**
 * Directorio de compañeros: SOLO el nombre para mostrar.
 *
 * Existe para que quien sostiene el proceso (Portador de Luz) vea con quiénes
 * está caminando, sin que el correo ni el teléfono de nadie salgan del panel de
 * admin.
 *
 * El nombre ya no se escribe desde aquí: lo guarda el servidor solo, cada vez
 * que la persona entra o completa su registro. Así nadie puede escribir en el
 * directorio a nombre de otro.
 */

/**
 * Se conserva por compatibilidad con las pantallas que la llamaban. Ya no hace
 * nada: el servidor mantiene el nombre al día por su cuenta.
 */
export async function guardarMiNombre(_uid: string, _nombre: string): Promise<void> {
  /* lo hace el servidor al entrar y al completar el registro */
}

/** Mapa uid → nombre. Solo para Portadores de Luz y admin. */
export async function leerDirectorio(): Promise<Record<string, string>> {
  const r = await llamarSeguro<{ directorio: Record<string, string> }>("/directorio", {
    directorio: {},
  });
  return r.directorio;
}
