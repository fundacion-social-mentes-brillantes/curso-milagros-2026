import type { AppUser, GroupStats, UserStatus } from "@/types";
import { daysSince, pct } from "@/lib/utils";
import { SITE } from "@/config/site";

export function userStatus(u: AppUser): UserStatus {
  const d = daysSince(u.lastActivityAt);
  if (d < 3) return "active";
  if (d <= 7) return "paused";
  return "inactive";
}

export const STATUS_LABEL: Record<UserStatus, string> = {
  active: "Activo",
  paused: "En pausa",
  inactive: "Inactivo",
};

function mode(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const counts = new Map<number, number>();
  let best = numbers[0] ?? 0;
  let bestCount = 0;
  for (const n of numbers) {
    const c = (counts.get(n) ?? 0) + 1;
    counts.set(n, c);
    if (c > bestCount) {
      bestCount = c;
      best = n;
    }
  }
  return best;
}

export function computeGroupStats(users: AppUser[]): GroupStats {
  const total = users.length;
  if (total === 0) {
    return {
      totalUsers: 0,
      activeToday: 0,
      active7d: 0,
      inactive7d: 0,
      averageCurrentLesson: 0,
      maxLesson: 0,
      modeLesson: 0,
      completionRate: 0,
    };
  }

  const activeToday = users.filter((u) => daysSince(u.lastActivityAt) < 1).length;
  const active7d = users.filter((u) => daysSince(u.lastActivityAt) < 7).length;
  const inactive7d = total - active7d;
  const currents = users.map((u) => u.currentLesson || 1);
  const averageCurrentLesson = Math.round(
    currents.reduce((a, b) => a + b, 0) / total,
  );
  const maxLesson = Math.max(...currents);
  const modeLesson = mode(currents);
  const completionRate = Math.round(
    users.reduce((a, u) => a + pct(u.completedLessonsCount, SITE.totalLessons), 0) /
      total,
  );

  return {
    totalUsers: total,
    activeToday,
    active7d,
    inactive7d,
    averageCurrentLesson,
    maxLesson,
    modeLesson,
    completionRate,
  };
}

/** Texto de "lectura del grupo" generado por lógica simple (sin IA). */
export function groupAnalysisText(users: AppUser[], stats: GroupStats): string {
  if (stats.totalUsers === 0) {
    return "Aún no hay personas registradas. Comparte el enlace para que el grupo comience su camino.";
  }

  const stalled = users.filter((u) => daysSince(u.lastActivityAt) > 7);
  const parts: string[] = [];

  const ratio = stats.active7d / stats.totalUsers;
  if (ratio >= 0.7) {
    parts.push("El grupo tiene muy buena continuidad esta semana.");
  } else if (ratio >= 0.4) {
    parts.push("El grupo avanza con un ritmo razonable.");
  } else {
    parts.push("La actividad del grupo está baja esta semana.");
  }

  parts.push(
    `En promedio van por la lección ${stats.averageCurrentLesson}, y la lección donde más personas coinciden es la ${stats.modeLesson}.`,
  );

  if (stalled.length === 0) {
    parts.push("Nadie lleva más de 7 días sin marcar una lección. 🌅");
  } else if (stalled.length <= 5) {
    const names = stalled.map((u) => u.displayName.split(" ")[0]).join(", ");
    parts.push(
      `${stalled.length} ${stalled.length === 1 ? "persona lleva" : "personas llevan"} más de 7 días sin avanzar: ${names}. Un mensaje cálido podría ayudar.`,
    );
  } else {
    parts.push(
      `${stalled.length} personas llevan más de 7 días sin avanzar; quizá convenga un recordatorio amoroso al grupo.`,
    );
  }

  return parts.join(" ");
}
