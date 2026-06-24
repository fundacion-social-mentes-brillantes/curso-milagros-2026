"use client";

import { useEffect, useState } from "react";
import { getCourseRanking } from "@/lib/ranking";
import type { CourseRankRow } from "@/lib/ranking";

/** Hora promedio (minuto del día) en formato "6:42 a. m." */
function fmtAvgHour(min: number): string {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const mm = total % 60;
  const ampm = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

/** Ranking acumulado del curso: quién hace su lección más temprano en promedio. */
export function CourseRanking() {
  const [rows, setRows] = useState<CourseRankRow[] | null>(null);

  useEffect(() => {
    getCourseRanking()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="mt-6 card p-6">
      <h3 className="font-display text-lg font-semibold">Madrugadores del curso ⭐</h3>
      <p className="text-sm text-muted">
        Promedio en lo que va del proceso: quién hace su lección más temprano y en qué puesto va
        cada persona.
      </p>
      <ul className="mt-4 space-y-1.5">
        {rows.map((r, i) => (
          <li
            key={r.uid}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface-2"
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                i === 0
                  ? "bg-gold/20 text-gold"
                  : i === 1 || i === 2
                    ? "bg-aqua/15 text-aqua"
                    : "bg-surface-2 text-muted"
              }`}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {i === 0 ? "🥇 " : ""}
                {r.name}
              </p>
              <p className="truncate text-xs text-muted">
                ⏰ promedio {fmtAvgHour(r.avgMinute)}
                {r.avgPosition > 0 && <> · 🏅 puesto prom. {r.avgPosition.toFixed(1)}</>}
                {" · "}
                {r.days} {r.days === 1 ? "día" : "días"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
