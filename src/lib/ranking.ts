"use client";

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { bogotaDateStr } from "@/lib/utils";
import type { DailyDone } from "@/types";

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
  const snap = await getDoc(doc(db, "dailyDone", `${n}_${uid}`));
  if (!snap.exists()) return null;
  const p = Number(snap.data().position ?? 0);
  return p > 0 ? p : null;
}

/** (Admin) Ranking de un día, ordenado por hora (1º = más temprano). */
export async function listDailyDone(date: string): Promise<DailyDone[]> {
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, "dailyDone"), where("date", "==", date)),
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
 * la que hace su lección y de su puesto diario. Ordenado de quien madruga más
 * (en promedio) a quien lo hace más tarde. Lee todos los registros del ranking.
 */
export async function getCourseRanking(): Promise<CourseRankRow[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, "dailyDone"));
  const byUid = new Map<string, { name: string; positions: number[]; minutes: number[] }>();
  for (const d of snap.docs) {
    const data = d.data();
    const uid = String(data.uid ?? "");
    if (!uid) continue;
    const completedAt = Number(data.completedAt ?? 0);
    const position = Number(data.position ?? 0);
    const e = byUid.get(uid) ?? { name: "Caminante", positions: [], minutes: [] };
    e.name = String(data.name ?? e.name);
    if (position > 0) e.positions.push(position);
    if (completedAt > 0) e.minutes.push(minuteOfDayBogota(completedAt));
    byUid.set(uid, e);
  }
  const rows: CourseRankRow[] = [];
  for (const [uid, e] of byUid) {
    const days = Math.max(e.minutes.length, e.positions.length);
    if (days === 0) continue;
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    rows.push({ uid, name: e.name, days, avgPosition: avg(e.positions), avgMinute: avg(e.minutes) });
  }
  // Más temprano en promedio primero.
  rows.sort((a, b) => a.avgMinute - b.avgMinute);
  return rows;
}
