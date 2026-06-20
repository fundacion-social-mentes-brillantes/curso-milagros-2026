"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { listLessons } from "@/lib/lessons";
import { subscribeUserProgress } from "@/lib/progress";
import { EmptyState } from "@/components/common/EmptyState";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type { Lesson, Progress } from "@/types";

type Filter = "all" | "pending" | "done";

function LeccionesInner() {
  const { appUser, isAdmin } = useAuth();
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    listLessons()
      .then(setLessons)
      .catch(() => {
        setError(true);
        setLessons([]);
      });
  }, []);

  useEffect(() => {
    if (!appUser) return;
    return subscribeUserProgress(appUser.uid, setProgress);
  }, [appUser?.uid]);

  const doneSet = useMemo(
    () => new Set(progress.filter((p) => p.completed).map((p) => p.lessonNumber)),
    [progress],
  );

  const filtered = useMemo(() => {
    if (!lessons) return [];
    const query = q.trim().toLowerCase();
    return lessons.filter((l) => {
      const done = doneSet.has(l.number);
      if (filter === "done" && !done) return false;
      if (filter === "pending" && done) return false;
      if (!query) return true;
      return (
        String(l.number).includes(query) ||
        l.title.toLowerCase().includes(query)
      );
    });
  }, [lessons, doneSet, filter, q]);

  if (lessons === null) return <PageLoader label="Cargando lecciones..." />;

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="animate-fade-up">
        <p className="section-eyebrow">El proceso</p>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Las 365 lecciones</h1>
        <p className="mt-2 text-muted">
          {doneSet.size > 0
            ? `Llevas ${doneSet.size} lecciones completadas. Sigue a tu ritmo.`
            : "Elige una lección para comenzar tu práctica."}
        </p>
      </header>

      {/* controles */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="input sm:max-w-xs"
          placeholder="Buscar por número o título..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-2">
          {(
            [
              ["all", "Todas"],
              ["pending", "Pendientes"],
              ["done", "Realizadas"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                filter === key
                  ? "bg-primary text-primary-fg"
                  : "border border-border bg-surface text-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* contenido */}
      {lessons.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="🌱"
            title={error ? "No se pudieron cargar las lecciones" : "Todavía no hay lecciones"}
            description={
              isAdmin
                ? "Ejecuta el script de datos semilla (npm run seed) para crear la estructura de las 365 lecciones."
                : "El facilitador está preparando el contenido. Vuelve pronto. 🌅"
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon="🔎" title="Sin resultados" description="Prueba con otro número o quita el filtro." />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((l) => {
            const done = doneSet.has(l.number);
            return (
              <Link
                key={l.id}
                href={`/lecciones/${l.number}`}
                className="card group flex flex-col gap-2 p-4 transition hover:-translate-y-0.5 hover:shadow-glow"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-bold text-primary">{l.number}</span>
                  {done ? (
                    <span className="badge bg-success/15 text-success">✓</span>
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-gold/60" aria-label="Pendiente" />
                  )}
                </div>
                <p className="line-clamp-2 min-h-[2.6rem] text-sm font-semibold leading-snug">
                  {l.title || `Lección ${l.number}`}
                </p>
                <div className="mt-auto flex items-center gap-2 text-xs text-muted">
                  {l.video.status === "available" ? <span>🎬 Video</span> : <span>🕯️ Pronto</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LeccionesPage() {
  return (
    <RouteGuard>
      <LeccionesInner />
    </RouteGuard>
  );
}
