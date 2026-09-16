"use client";

import { llamarSeguro } from "@/lib/api";
import { llamar } from "@/lib/api";

/**
 * Los grupos y su fecha de arranque.
 *
 * De la fecha sale "en qué lección va el grupo hoy", y de ahí el techo hasta el
 * que alguien puede adelantarse. La cuenta la hace el servidor: si la hiciera
 * el navegador, bastaría con cambiar la hora del computador para saltársela.
 */

export interface Grupo {
  nombre: string;
  /** "2026-06-22": el día en que ese grupo hizo la lección 1. */
  inicio: string;
  /** En qué lección va hoy, según esa fecha. */
  leccionHoy: number;
}

export async function listarGrupos(): Promise<Grupo[]> {
  const r = await llamarSeguro<{ grupos: Grupo[] }>("/grupos", { grupos: [] });
  return r.grupos;
}

/** (Admin) Pone o cambia la fecha en que un grupo empezó la lección 1. */
export async function guardarFechaDeGrupo(
  nombre: string,
  inicio: string,
): Promise<Grupo> {
  return llamar<Grupo>("/grupos", { metodo: "PUT", cuerpo: { nombre, inicio } });
}
