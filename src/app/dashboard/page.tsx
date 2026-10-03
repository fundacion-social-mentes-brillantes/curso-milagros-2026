"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { subscribeUserProgress } from "@/lib/progress";
import { getLessonRank } from "@/lib/ranking";
import { Constelacion } from "@/components/dashboard/Constelacion";
import { MiLibro } from "@/components/dashboard/MiLibro";
import { MisCompaneros } from "@/components/dashboard/MisCompaneros";
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
  // El ranking de compañeros es de quien sostiene el proceso.
  const esPortador = appUser.plan !== "ordinario" || appUser.role === "admin";

  const recent = [...completed]
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 6);

  const hechas = new Set(completed.map((p) => p.lessonNumber));

  return (
    <div className="container-page pb-8 pt-2 sm:pt-4">
      {/* MI CAMINO: el saludo, la espiral de 365 luces y la próxima práctica. */}
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12">
        <div className="text-center lg:text-left">
          <p className="etiqueta aparece">Mi camino</p>
          <h1 className="frase-luz aparece mt-2 text-[2.6rem] leading-tight [animation-delay:.1s] md:text-5xl">Hola, {firstName}</h1>
          <p className="aparece mx-auto mt-3 max-w-sm text-muted [animation-delay:.2s] lg:mx-0">
            {completedCount === 0
              ? "Hoy es un hermoso día para comenzar tu primera lección."
              : "Qué bueno tenerte de vuelta. Cada lección que haces queda encendida en tu camino."}
          </p>
          {rank && (
            <p className="aparece mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-gold [animation-delay:.3s] vidrio">
              Fuiste el #{rank.position} en hacer la lección {rank.lesson}
            </p>
          )}

          <div className="lg:hidden">
            <div className="mx-auto mt-4 aspect-[1/0.9] w-full max-w-[26rem]">
              <Constelacion hechas={hechas} hoy={current} />
            </div>
            <Cifras hechas={completedCount} percent={percent} />
          </div>

          <div className="vidrio aparece mx-auto mt-7 max-w-[26rem] rounded-[1.6rem] p-5 text-left [animation-delay:.4s] lg:mx-0">
            <p className="etiqueta">Tu próxima práctica</p>
            <h2 className="mt-2 text-[1.9rem] leading-tight text-fg">Lección {current}</h2>
            <p className="mt-1 text-sm text-muted">Continúa tu proceso justo donde lo dejaste.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href={`/lecciones/${current}`} className="boton-cristal flex-1">
                Ir a la lección {current}
              </Link>
              <Link href="/lecciones" className="btn-ghost justify-center py-3">
                Ver todas
              </Link>
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="mx-auto aspect-[1/0.9] w-full max-w-[40rem]">
            <Constelacion hechas={hechas} hoy={current} />
          </div>
          <Cifras hechas={completedCount} percent={percent} />
        </div>
      </div>

      {/* Quiénes caminan hoy (solo Portadores de Luz) */}
      {esPortador && <MisCompaneros uid={appUser.uid} />}

      {/* Su cuaderno del año, listo para descargar */}
      <MiLibro nombre={appUser.fullName || appUser.displayName} uid={appUser.uid} />

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

/** «269 de 365 · 74 % completado», en segundo plano y elegante. */
function Cifras({ hechas, percent }: { hechas: number; percent: number }) {
  return (
    <p className="mt-2 flex items-baseline justify-center gap-6 text-sm text-muted">
      <span>
        <b className="numero-luz mr-1.5 text-[1.9rem]">{hechas}</b>de {SITE.totalLessons}
      </span>
      <span>
        <b className="numero-luz mr-1.5 text-[1.9rem]">{percent} %</b>completado
      </span>
    </p>
  );
}

export default function DashboardPage() {
  return (
    <RouteGuard>
      <DashboardInner />
    </RouteGuard>
  );
}
