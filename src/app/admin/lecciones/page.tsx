"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { getLessonByNumber, listLessons } from "@/lib/lessons";
import { LessonEditor } from "@/components/admin/LessonEditor";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/types";

function LeccionesAdminInner() {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [current, setCurrent] = useState<Lesson | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    listLessons()
      .then(setLessons)
      .catch(() => setLessons([]));
  }, []);

  useEffect(() => {
    if (selected == null) {
      setCurrent(null);
      return;
    }
    let active = true;
    setLoadingCurrent(true);
    getLessonByNumber(selected)
      .then((l) => active && setCurrent(l))
      .finally(() => active && setLoadingCurrent(false));
    return () => {
      active = false;
    };
  }, [selected]);

  const filtered = useMemo(() => {
    if (!lessons) return [];
    const query = q.trim().toLowerCase();
    if (!query) return lessons;
    return lessons.filter(
      (l) => String(l.number).includes(query) || l.title.toLowerCase().includes(query),
    );
  }, [lessons, q]);

  function handleSaved(updated: Lesson) {
    setCurrent(updated);
    setLessons((prev) =>
      prev?.map((l) => (l.number === updated.number ? { ...l, title: updated.title } : l)) ?? prev,
    );
  }

  if (lessons === null) return <PageLoader label="Cargando lecciones..." />;

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-eyebrow">Administración</p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Lecciones y videos</h1>
          <p className="mt-2 text-sm text-muted">
            Las 365 ya están cargadas. Edita la guía o pega el link del video; el texto original queda fijo.
          </p>
        </div>
        <Link href="/admin" className="btn-ghost text-sm">
          ← Panel
        </Link>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* lista */}
        <div className="card flex max-h-[75vh] flex-col p-3">
          <input
            className="input mb-2"
            placeholder="Buscar lección..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="-mr-1 flex-1 space-y-1 overflow-y-auto pr-1 scrollbar-soft">
            {filtered.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelected(l.number)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
                  selected === l.number ? "bg-primary/12 text-primary" : "hover:bg-surface-2",
                )}
              >
                <span className="min-w-0 truncate">
                  <span className="font-bold">{l.number}</span>
                  <span className="ml-2 text-muted">{l.title || "—"}</span>
                </span>
                <span className="shrink-0 text-xs">
                  {l.video.status === "available" ? "🎬" : "🕯️"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* editor */}
        <div>
          {loadingCurrent ? (
            <div className="grid place-items-center py-20">
              <Spinner className="h-8 w-8" />
            </div>
          ) : current ? (
            <LessonEditor key={current.number} lesson={current} onSaved={handleSaved} />
          ) : (
            <EmptyState
              icon="👈"
              title="Elige una lección"
              description="Selecciona una lección de la lista para editar su guía, su video y ver su texto original."
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function LeccionesAdminPage() {
  return (
    <RouteGuard requireAdmin>
      <LeccionesAdminInner />
    </RouteGuard>
  );
}
