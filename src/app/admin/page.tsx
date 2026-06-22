"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { listUsers } from "@/lib/users";
import { computeGroupStats } from "@/lib/admin-analytics";
import { StatCard } from "@/components/dashboard/StatCard";
import { GroupAnalysis } from "@/components/admin/GroupAnalysis";
import { Histogram, bucketLessons, BarRow } from "@/components/ui/Charts";
import { PageLoader } from "@/components/ui/Spinner";
import { SITE } from "@/config/site";
import type { AppUser } from "@/types";

function AdminInner() {
  const [users, setUsers] = useState<AppUser[] | null>(null);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  if (users === null) return <PageLoader label="Cargando panel..." />;

  // Las estadísticas se calculan SOLO con las personas inscritas en el proceso.
  const enrolled = users.filter((u) => u.enrolled);
  const stats = computeGroupStats(enrolled);
  const topMovers = [...enrolled]
    .sort((a, b) => b.completedLessonsCount - a.completedLessonsCount)
    .slice(0, 8);

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-eyebrow">Administración</p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Panel del grupo</h1>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Inscritas"
          value={stats.totalUsers}
          hint={`${users.length} registradas en total`}
          icon="👥"
        />
        <StatCard label="Activas hoy" value={stats.activeToday} icon="🌞" tone="gold" />
        <StatCard label="Activas (7 días)" value={stats.active7d} icon="📅" tone="aqua" />
        <StatCard label="Inactivas (+7 días)" value={stats.inactive7d} icon="🌙" tone="warn" />
        <StatCard label="Lección promedio" value={stats.averageCurrentLesson} icon="🧭" />
        <StatCard label="Más avanzada" value={stats.maxLesson} icon="🏔️" tone="gold" />
        <StatCard label="Lección más común" value={stats.modeLesson} icon="👣" tone="aqua" />
        <StatCard label="Avance promedio" value={`${stats.completionRate}%`} icon="🌟" tone="gold" />
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
