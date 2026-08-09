"use client";

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { bogotaDateStr } from "@/lib/utils";
import { cicloActual, filtrarPorCiclo, idRanking } from "@/lib/ciclo";
import type { AppUser, DailyDone } from "@/types";

function toDailyDone(data: Record<string, unknown>): DailyDone {
  return {
    uid: String(data.uid ?? ""),
    name: String(data.name ?? "Caminante"),
    date: String(data.date ?? ""),
    completedAt: Number(data.completedAt ?? 0),
    position: Number(data.position ?? 0),
    lessonNumber: Number(data.lessonNumber ?? 0),
  };
}

/** Fecha de hoy (Colombia) en formato YYYY-MM-DD. */
export function todayBogota(): string {
  return bogotaDateStr(Date.now());
}

/** Puesto (top) de una persona en una lección concreta, o null si no la ha hecho. */
export async function getLessonRank(uid: string, n: number): Promise<number | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, "dailyDone", idRanking(await cicloActual(), n, uid)));
  if (!snap.exists()) return null;
  const p = Number(snap.data().position ?? 0);
  return p > 0 ? p : null;
}

/** (Admin) Ranking de un día, ordenado por hora (1º = más temprano). */
export async function listDailyDone(date: string): Promise<DailyDone[]> {
  const db = getDb();
  const ciclo = await cicloActual();
  const snap = await getDocs(
    query(
      collection(db, "dailyDone"),
      ...(filtrarPorCiclo(ciclo) ? [where("ciclo", "==", ciclo)] : []),
      where("date", "==", date),
    ),
  );
  return snap.docs
    .map((d) => toDailyDone(d.data()))
    .sort((a, b) => a.completedAt - b.completedAt);
}

/** Minuto del día (0..1439) en horario de Colombia para una marca de tiempo. */
function minuteOfDayBogota(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export interface CourseRankRow {
  uid: string;
  name: string;
  days: number;
  avgPosition: number;
  avgMinute: number;
}

/**
 * (Admin) Ranking ACUMULADO del curso: por cada persona, promedio de la hora a
 * la que hace su lección y de su puesto.
 *
 * IMPORTANTE: se calcula con el acumulado que cada persona lleva en SU PROPIO
 * perfil (rankDias / rankSumaPuesto / rankSumaMinuto, que se van sumando al
 * marcar cada lección). Antes se leía la colección `dailyDone` COMPLETA en cada
 * visita al panel: con 100 personas eran decenas de miles de lecturas por
 * visita y se agotaba la cuota gratis de Firebase. Ahora cuesta CERO lecturas
 * extra, porque el panel ya tiene la lista de personas cargada.
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
