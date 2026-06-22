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
  };
}

/** Fecha de hoy (Colombia) en formato YYYY-MM-DD. */
export function todayBogota(): string {
  return bogotaDateStr(Date.now());
}

/** Posición de HOY de una persona (o null si aún no marcó su lección hoy). */
export async function getTodayPosition(uid: string): Promise<number | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, "dailyDone", `${todayBogota()}_${uid}`));
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
