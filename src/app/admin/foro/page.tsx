"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { moderatePost, softDeletePost, subscribeRecentPosts } from "@/lib/forum";
import { Avatar } from "@/components/ui/Avatar";
import { PageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { relativeTime, cn } from "@/lib/utils";
import type { ForumPost, ForumStatus } from "@/types";

const FILTERS: { key: ForumStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "visible", label: "Visibles" },
  { key: "reviewed", label: "Revisados" },
  { key: "hidden", label: "Ocultos" },
  { key: "deleted", label: "Eliminados" },
];

const STATUS_CLASS: Record<ForumStatus, string> = {
  visible: "bg-success/15 text-success",
  reviewed: "bg-aqua/15 text-aqua",
  hidden: "bg-warning/15 text-warning",
  deleted: "bg-muted/15 text-muted",
};

function ForoInner() {
  const [posts, setPosts] = useState<ForumPost[] | null>(null);
  const [filter, setFilter] = useState<ForumStatus | "all">("all");

  useEffect(() => subscribeRecentPosts(setPosts), []);

  const rows = useMemo(
    () => (posts ?? []).filter((p) => filter === "all" || p.status === filter),
    [posts, filter],
  );

  if (posts === null) return <PageLoader label="Cargando foro..." />;

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-eyebrow">Administración</p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Moderación del foro</h1>
          <p className="mt-2 text-muted">Mensajes más recientes de todas las lecciones.</p>
        </div>
        <Link href="/admin" className="btn-ghost text-sm">
          ← Panel
        </Link>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-4 py-2.5 text-sm font-semibold transition",
              filter === f.key ? "bg-primary text-primary-fg" : "border border-border bg-surface text-muted hover:text-fg",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <EmptyState icon="🌼" title="Nada por aquí" description="No hay mensajes con este filtro." />
        ) : (
          rows.map((p) => (
            <div key={p.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <Avatar src={p.userPhoto} name={p.userName} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.userName}</span>
                  <Link href={`/lecciones/${p.lessonNumber}`} className="text-xs font-semibold text-primary hover:underline">
                    Lección {p.lessonNumber}
                  </Link>
                  {p.parentId && <span className="text-xs text-muted">(respuesta)</span>}
                  <span className="text-xs text-muted">· {relativeTime(p.createdAt)}</span>
                  <span className={`badge ${STATUS_CLASS[p.status]}`}>{p.status}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-fg/90">{p.message}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {p.status !== "hidden" ? (
                  <button onClick={() => void moderatePost(p.id, "hidden")} className="btn-ghost flex-1 justify-center px-4 py-2.5 text-xs sm:flex-none sm:py-1.5">
                    Ocultar
                  </button>
                ) : (
                  <button onClick={() => void moderatePost(p.id, "visible")} className="btn-ghost flex-1 justify-center px-4 py-2.5 text-xs sm:flex-none sm:py-1.5">
                    Mostrar
                  </button>
                )}
                {p.status !== "reviewed" && (
                  <button onClick={() => void moderatePost(p.id, "reviewed")} className="btn-ghost flex-1 justify-center px-4 py-2.5 text-xs sm:flex-none sm:py-1.5">
                    Revisado
                  </button>
                )}
                {p.status !== "deleted" && (
                  <button onClick={() => void softDeletePost(p.id)} className="btn-ghost flex-1 justify-center px-4 py-2.5 text-xs text-warning sm:flex-none sm:py-1.5">
                    Borrar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ForoAdminPage() {
  return (
    <RouteGuard requireAdmin>
      <ForoInner />
    </RouteGuard>
  );
}
