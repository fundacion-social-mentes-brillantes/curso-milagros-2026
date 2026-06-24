"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { subscribeUsers } from "@/lib/users";
import { computeGroupStats } from "@/lib/admin-analytics";
import { StatCard } from "@/components/dashboard/StatCard";
import { GroupAnalysis } from "@/components/admin/GroupAnalysis";
import { PeopleListModal } from "@/components/admin/PeopleListModal";
import { isPermanentAdmin } from "@/lib/admins";
import { exportPeoplePdf } from "@/lib/pdf-export";
import { CohortHistory } from "@/components/admin/CohortHistory";
import { DailyRanking } from "@/components/admin/DailyRanking";
import { CourseRanking } from "@/components/admin/CourseRanking";
import { Histogram, bucketLessons, BarRow } from "@/components/ui/Charts";
import { PageLoader } from "@/components/ui/Spinner";
import { SITE } from "@/config/site";
import type { AppUser } from "@/types";

function AdminInner() {
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    description?: string;
    people: AppUser[];
  } | null>(null);

  useEffect(() => {
    // En tiempo real: las estadísticas y listas se actualizan solas.
    return subscribeUsers(setUsers);
  }, []);

  if (users === null) return <PageLoader label="Cargando panel..." />;

  // Las estadísticas se calculan SOLO con las personas inscritas en el proceso,
  // y NUNCA con la cuenta de gestión de la fundación (no es participante).
  const enrolled = users.filter((u) => u.enrolled && !isPermanentAdmin(u.email));
  const stats = computeGroupStats(enrolled);
  const topMovers = [...enrolled]
    .sort((a, b) => b.completedLessonsCount - a.completedLessonsCount)
    .slice(0, 8);

  // "Hoy" = desde la medianoche local hasta las 11:59 p. m.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startTodayMs = startOfToday.getTime();
  const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const activeTodayList = enrolled.filter((u) => u.lastActivityAt >= startTodayMs);
  const notDoneTodayList = enrolled.filter((u) => u.lastCompletedAt < startTodayMs);
  const active7dList = enrolled.filter((u) => u.lastActivityAt >= weekAgoMs);
  const inactive7dList = enrolled.filter((u) => u.lastActivityAt < weekAgoMs);
  const byLessonDesc = [...enrolled].sort(
    (a, b) => (b.currentLesson || 1) - (a.currentLesson || 1),
  );
  const modeList = enrolled.filter((u) => (u.currentLesson || 1) === stats.modeLesson);

  const openList = (title: string, people: AppUser[], description?: string) =>
    setModal({ title, people, description });

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-eyebrow">Administración</p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Panel del grupo</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              void exportPeoplePdf(enrolled, {
                title: "Personas inscritas",
                subtitle: "Inscritas en el proceso",
                fileBase: "inscritas-curso-de-milagros",
              })
            }
            className="btn-gold text-sm"
          >
            ⬇ Descargar PDF
          </button>
          <Link href="/admin/usuarios" className="btn-ghost text-sm">
            Personas
          </Link>
          <Link href="/admin/lecciones" className="btn-ghost text-sm">
            Lecciones
          </Link>
          <Link href="/admin/foro" className="btn-ghost text-sm">
            Foro
          </Link>
        </div>
      </header>

      <p className="mt-6 text-sm text-muted">
        Toca cualquier tarjeta con <span className="font-semibold text-primary">Ver lista →</span> para
        ver quiénes son y escribirles por WhatsApp.
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Inscritas"
          value={enrolled.length}
          hint={`${users.length} registradas en total`}
          icon="👥"
          onClick={() => openList("Personas inscritas", enrolled)}
        />
        <StatCard
          label="Activas hoy"
          value={activeTodayList.length}
          hint="Entraron hoy a la app"
          icon="🌞"
          tone="gold"
          onClick={() => openList("Activas hoy", activeTodayList, "entraron hoy")}
        />
        <StatCard
          label="No han hecho hoy"
          value={notDoneTodayList.length}
          hint="Sin marcar la lección de hoy"
          icon="📌"
          tone="warn"
          onClick={() =>
            openList(
              "No han hecho la lección de hoy",
              notDoneTodayList,
              "para acompañarlas con un mensaje",
            )
          }
        />
        <StatCard
          label="Inactivas (+7 días)"
          value={inactive7dList.length}
          hint="Más de una semana sin entrar"
          icon="🌙"
          tone="warn"
          onClick={() => openList("Inactivas (más de 7 días)", inactive7dList)}
        />
        <StatCard
          label="Activas (7 días)"
          value={active7dList.length}
          hint="Entraron esta semana"
          icon="📅"
          tone="aqua"
          onClick={() => openList("Activas en los últimos 7 días", active7dList)}
        />
        <StatCard
          label="Lección promedio"
          value={stats.averageCurrentLesson}
          hint="En la que va el grupo en promedio"
          icon="🧭"
        />
        <StatCard
          label="Más avanzada"
          value={stats.maxLesson}
          hint="La lección más adelantada del grupo"
          icon="🏔️"
          tone="gold"
          onClick={() =>
            openList(
              "Avance de cada persona",
              byLessonDesc,
              "de la más adelantada a la que va empezando",
            )
          }
        />
        <StatCard
          label="Lección más común"
          value={stats.modeLesson}
          hint="Donde más personas coinciden"
          icon="👣"
          tone="aqua"
          onClick={() => openList(`Personas en la lección ${stats.modeLesson}`, modeList)}
        />
        <StatCard
          label="Avance promedio"
          value={`${stats.completionRate}%`}
          hint="Del total de 365 lecciones"
          icon="🌟"
          tone="gold"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <GroupAnalysis users={enrolled} stats={stats} />

        <div className="card p-6">
          <h3 className="font-display text-lg font-semibold">¿Dónde está el grupo?</h3>
          <p className="text-sm text-muted">Cuántas personas van en cada tramo de lecciones.</p>
          <div className="mt-4">
            <Histogram buckets={bucketLessons(enrolled.map((u) => u.currentLesson || 1))} />
          </div>
        </div>
      </div>

      <div className="mt-6 card p-6">
        <h3 className="font-display text-lg font-semibold">Avance individual</h3>
        <p className="text-sm text-muted">Personas con más lecciones completadas.</p>
        <div className="mt-4 space-y-3">
          {topMovers.length === 0 ? (
            <p className="text-sm text-muted">Aún no hay datos de avance.</p>
          ) : (
            topMovers.map((u) => (
              <BarRow
                key={u.uid}
                label={u.displayName.split(" ")[0] ?? u.displayName}
                value={u.completedLessonsCount}
                max={SITE.totalLessons}
                hint={`${u.completedLessonsCount}`}
              />
            ))
          )}
        </div>
      </div>

      <DailyRanking />

      <CourseRanking />

      <CohortHistory />

      <div className="mt-8 text-center">
        <Link
          href="/admin/nuevo-anio"
          className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          🔄 Comenzar nuevo año (reiniciar el avance del grupo)
        </Link>
      </div>

      {modal && (
        <PeopleListModal
          title={modal.title}
          description={modal.description}
          people={modal.people}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RouteGuard requireAdmin>
      <AdminInner />
    </RouteGuard>
  );
}
