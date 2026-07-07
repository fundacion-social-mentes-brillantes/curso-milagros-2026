"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { subscribeUserProgress } from "@/lib/progress";
import { getLessonRank } from "@/lib/ranking";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { StatCard } from "@/components/dashboard/StatCard";
import { Histogram, bucketLessons } from "@/components/ui/Charts";
import { PageLoader } from "@/components/ui/Spinner";
import { pct, formatDate } from "@/lib/utils";
import { SITE } from "@/config/site";
import type { Progress } from "@/types";

function DashboardInner() {
  const { appUser } = useAuth();
  const [progress, setProgress] = useState<Progress[] | null>(null);
  const [rank, setRank] = useState<{ lesson: number; position: number } | null>(null);

  useEffect(() => {
    if (!appUser) return;
    return subscribeUserProgress(appUser.uid, setProgress);
  }, [appUser?.uid]);

  // Puesto en la ÚLTIMA lección que completó (top por lección, no por día).
  useEffect(() => {
    if (!appUser || !progress) return;
    const doneList = progress.filter((p) => p.completed);
    if (doneList.length === 0) {
      setRank(null);
      return;
    }
    const last = [...doneList].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
    if (!last) return;
    const lessonNumber = last.lessonNumber;
    getLessonRank(appUser.uid, lessonNumber)
      .then((p) => setRank(p ? { lesson: lessonNumber, position: p } : null))
      .catch(() => {});
  }, [appUser?.uid, progress]);

  if (!appUser) return <PageLoader />;

  const completed = (progress ?? []).filter((p) => p.completed);
  const completedCount = appUser.completedLessonsCount || completed.length;
  const current = appUser.currentLesson || 1;
  const percent = pct(completedCount, SITE.totalLessons);
  const firstName = appUser.displayName.split(" ")[0] ?? "Caminante";

  const recent = [...completed]
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 6);

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="animate-fade-up">
        <p className="section-eyebrow">Mi camino</p>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
          Hola, {firstName} 🌅
        </h1>
        <p className="mt-2 text-muted">
          {completedCount === 0
            ? "Hoy es un hermoso día para comenzar tu primera lección."
            : "Qué bueno tenerte de vuelta. Continúa cuando estés listo."}
        </p>
        {rank && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold/15 px-4 py-2 text-sm font-bold text-gold">
            🌅 Fuiste el #{rank.position} en hacer la lección {rank.lesson}
          </div>
        )}
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {/* progreso */}
        <div className="card flex flex-col items-center justify-center gap-4 p-6 text-center">
          <ProgressRing value={percent} size={150}>
            <div>
              <p className="font-display text-3xl font-bold">{percent}%</p>
              <p className="text-xs text-muted">de 365</p>
            </div>
          </ProgressRing>
          <p className="text-sm text-muted">
            Has completado <span className="font-semibold text-fg">{completedCount}</span> lecciones.
          </p>
        </div>

        {/* continuar */}
        <div className="card flex flex-col justify-between gap-4 p-6 lg:col-span-2">
          <div>
            <p className="section-eyebrow">Tu próxima práctica</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Lección {current}</h2>
            <p className="mt-1 text-muted">
              Continúa tu proceso justo donde lo dejaste.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/lecciones/${current}`} className="btn-primary text-base">
              Ir a la lección {current}
            </Link>
            <Link href="/lecciones" className="btn-ghost text-base">
              Ver todas
            </Link>
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Lecciones completadas" value={completedCount} icon="✅" tone="aqua" />
        <StatCard label="Lección actual" value={current} icon="🧭" tone="default" />
        <StatCard label="Avance del proceso" value={`${percent}%`} icon="🌟" tone="gold" />
      </div>

      {/* distribución + recientes */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="font-display text-lg font-semibold">Tu avance por tramos</h3>
          <p className="text-sm text-muted">Lecciones completadas en cada parte del proceso.</p>
          <div className="mt-4">
            <Histogram buckets={bucketLessons(completed.map((p) => p.lessonNumber))} />
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display text-lg font-semibold">Tus últimas lecciones</h3>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Aún no has marcado lecciones como hechas.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {recent.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <Link href={`/lecciones/${p.lessonNumber}`} className="font-semibold hover:text-primary">
                    Lección {p.lessonNumber}
                  </Link>
                  <span className="text-xs text-muted">{formatDate(p.completedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RouteGuard>
      <DashboardInner />
    </RouteGuard>
  );
}
