"use client";

import { llamarSeguro } from "@/lib/api";
import { bogotaDateStr } from "@/lib/utils";
import type { AppUser, DailyDone } from "@/types";

/** Fecha de hoy (Colombia) en formato YYYY-MM-DD. */
export function todayBogota(): string {
  return bogotaDateStr(Date.now());
}

/** Puesto de una persona en una lección concreta, o null si no la ha hecho. */
export async function getLessonRank(_uid: string, n: number): Promise<number | null> {
  const r = await llamarSeguro<{ position: number | null }>(`/ranking/${n}`, {
    position: null,
  });
  const p = Number(r.position ?? 0);
  return p > 0 ? p : null;
}

/** (Admin) Ranking de un día, ordenado por hora (1º = más temprano). */
export async function listDailyDone(date: string): Promise<DailyDone[]> {
  const r = await llamarSeguro<{ puestos: DailyDone[] }>(
    `/ranking-dia/${encodeURIComponent(date)}`,
    { puestos: [] },
  );
  return [...r.puestos].sort((a, b) => a.completedAt - b.completedAt);
}

export interface CourseRankRow {
  uid: string;
  name: string;
  days: number;
  avgPosition: number;
  avgMinute: number;
}

/**
 * (Admin) Ranking ACUMULADO del curso: por cada persona, el promedio de la hora
 * a la que hace su lección y de su puesto.
 *
 * IMPORTANTE: se calcula con el acumulado que cada persona lleva en SU PROPIO
 * perfil (rankDias / rankSumaPuesto / rankSumaMinuto, que se suman al marcar
 * cada lección). Se hizo así porque antes había que leer TODOS los registros de
 * puestos en cada visita al panel, y eso agotaba la cuota gratis. Sigue igual
 * de bien en Azure: cuesta CERO consultas extra, porque el panel ya tiene la
 * lista de personas cargada.
 */
export function getCourseRanking(users: AppUser[]): CourseRankRow[] {
  const rows: CourseRankRow[] = [];
  for (const u of users) {
    const days = Number(u.rankDias ?? 0);
    if (days <= 0) continue;
    rows.push({
      uid: u.uid,
      name: u.fullName || u.displayName || "Caminante",
      days,
      avgPosition: Number(u.rankSumaPuesto ?? 0) / days,
      avgMinute: Number(u.rankSumaMinuto ?? 0) / days,
    });
  }
  // Más temprano en promedio primero.
  rows.sort((a, b) => a.avgMinute - b.avgMinute);
  return rows;
}
