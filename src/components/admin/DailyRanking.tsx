"use client";

import { useEffect, useState } from "react";
import { listDailyDone, todayBogota } from "@/lib/ranking";
import { formatTime } from "@/lib/utils";
import type { DailyDone } from "@/types";

/** Ranking del día: orden en que las personas hicieron su lección hoy (por hora). */
export function DailyRanking() {
  const [rows, setRows] = useState<DailyDone[] | null>(null);

  useEffect(() => {
    listDailyDone(todayBogota())
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  if (!rows) return null;

  return (
    <div className="mt-6 card p-6">
      <h3 className="font-display text-lg font-semibold">Ranking de hoy ⏱️</h3>
      <p className="text-sm text-muted">
        Orden en que las personas hicieron su lección hoy, por hora (1º = más temprano).
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Aún nadie ha marcado su lección hoy. 🌅</p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {rows.map((r, i) => (
            <li
              key={r.uid}
              className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-surface-2"
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  i === 0
                    ? "bg-gold/20 text-gold"
                    : i === 1 || i === 2
                      ? "bg-aqua/15 text-aqua"
                      : "bg-surface-2 text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {i === 0 ? "🥇 " : ""}
                {r.name}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {r.lessonNumber > 0 ? `L${r.lessonNumber} · ` : ""}
                {formatTime(r.completedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
