"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { setUserEnrolled, setUserRole } from "@/lib/users";
import { STATUS_LABEL, userStatus } from "@/lib/admin-analytics";
import { isPermanentAdmin } from "@/lib/admins";
import { pct, relativeTime, cn } from "@/lib/utils";
import { SITE } from "@/config/site";
import type { AppUser, UserStatus } from "@/types";

type EnrollFilter = "all" | "in" | "out";

const STATUS_CLASS: Record<UserStatus, string> = {
  active: "bg-success/15 text-success",
  paused: "bg-gold/15 text-gold",
  inactive: "bg-muted/15 text-muted",
};

export function UsersTable({
  users,
  editable = false,
}: {
  users: AppUser[];
  editable?: boolean;
}) {
  const { firebaseUser } = useAuth();
  const myUid = firebaseUser?.uid;
  const iAmSuper = isPermanentAdmin(firebaseUser?.email);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<EnrollFilter>("all");
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [enrollBusy, setEnrollBusy] = useState<string | null>(null);

  const enrolledCount = useMemo(
    () => users.filter((u) => u.enrolled && !isPermanentAdmin(u.email)).length,
    [users],
  );
  const adminCount = useMemo(
    () => users.filter((u) => u.role === "admin" || isPermanentAdmin(u.email)).length,
    [users],
  );

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...users]
      .filter((u) => (filter === "all" ? true : filter === "in" ? u.enrolled : !u.enrolled))
      .filter(
        (u) =>
          !query ||
          u.displayName.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
      )
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [users, q, filter]);

  async function toggleRole(u: AppUser) {
    const makingAdmin = u.role !== "admin";
    const ok = window.confirm(
      makingAdmin
        ? `¿Hacer administrador a ${u.displayName}? Podrá ver y gestionar todo el panel, igual que tú.`
        : `¿Quitar el acceso de administrador a ${u.displayName}?`,
    );
    if (!ok) return;
    setPendingUid(u.uid);
    try {
      await setUserRole(u.uid, makingAdmin ? "admin" : "user");
    } finally {
      setPendingUid(null);
    }
  }

  async function toggleEnrolled(u: AppUser) {
    setEnrollBusy(u.uid);
    try {
      await setUserEnrolled(u.uid, !u.enrolled);
    } finally {
      setEnrollBusy(null);
    }
  }

  // Control de "inscrito" (pastilla clara, fácil de tocar en celular).
  function EnrolledControl({ u }: { u: AppUser }) {
    if (!editable) {
      return (
        <span className={`badge ${u.enrolled ? "bg-success/15 text-success" : "bg-muted/15 text-muted"}`}>
          {u.enrolled ? "Sí" : "No"}
        </span>
      );
    }
    return (
      <button
        onClick={() => void toggleEnrolled(u)}
        disabled={enrollBusy === u.uid}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
          u.enrolled
            ? "bg-success/20 text-success hover:bg-success/30"
            : "border border-border bg-surface text-muted hover:text-fg",
        )}
      >
        {enrollBusy === u.uid ? "…" : u.enrolled ? "✓ Inscrito" : "○ Inscribir"}
      </button>
    );
  }

  // Control de rol/admin.
  function RoleControl({ u }: { u: AppUser }) {
    if (isPermanentAdmin(u.email)) {
      return (
        <span className="badge bg-gold/20 text-gold" title="Administrador permanente (correo de la fundación)">
          ★ Admin
        </span>
      );
    }
    if (!iAmSuper) {
      return (
        <span
          className={cn("badge", u.role === "admin" ? "bg-gold/20 text-gold" : "bg-surface-2 text-muted")}
          title="Solo el admin principal (fundación) puede cambiar admins"
        >
          {u.role === "admin" ? "★ Admin" : "Usuario"}
        </span>
      );
    }
    return (
      <button
        onClick={() => void toggleRole(u)}
        disabled={pendingUid === u.uid || u.uid === myUid}
        title={
          u.uid === myUid
            ? "No puedes cambiar tu propio rol"
            : u.role === "admin"
              ? "Quitar acceso de administrador"
              : "Dar acceso de administrador"
        }
        className={cn(
          "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
          u.role === "admin" ? "bg-gold/20 text-gold hover:bg-gold/30" : "bg-surface-2 text-muted hover:text-fg",
        )}
      >
        {u.role === "admin" ? "★ Admin" : "Hacer admin"}
      </button>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Personas ({users.length})</h3>
          <p className="text-xs text-muted">
            {enrolledCount} inscritas · {users.length - enrolledCount} solo registradas ·{" "}
            {adminCount} con acceso admin
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "Todas"],
              ["in", "Inscritas"],
              ["out", "No inscritas"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                filter === key
                  ? "bg-primary text-primary-fg"
                  : "border border-border bg-surface text-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
          <input
            className="input max-w-[160px] flex-1 sm:flex-none"
            placeholder="Buscar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* MÓVIL: tarjetas apiladas (fácil de leer y tocar) */}
      <div className="space-y-2.5 p-3 md:hidden">
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">No hay personas que coincidan.</p>
        )}
        {rows.map((u) => {
          const status = userStatus(u);
          return (
            <div key={u.uid} className="rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center gap-3">
                <Avatar src={u.photoURL} name={u.displayName} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{u.displayName}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </div>
                <span className={`badge shrink-0 ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted">
                <span className="truncate">📍 {u.country || "—"}</span>
                <span className="truncate">📱 {u.phone || "—"}</span>
                <span>🧭 Lección {u.currentLesson}</span>
                <span>
                  ✅ {u.completedLessonsCount}{" "}
                  <span className="opacity-70">({pct(u.completedLessonsCount, SITE.totalLessons)}%)</span>
                </span>
                <span className="col-span-2">🕐 Última actividad: {relativeTime(u.lastActivityAt)}</span>
              </div>

              {editable && (
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <span className="flex items-center gap-2 text-xs text-muted">
                    Inscrito: <EnrolledControl u={u} />
                  </span>
                  <RoleControl u={u} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* PC: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="p-4 font-semibold">Persona</th>
              <th className="p-4 font-semibold">País</th>
              <th className="p-4 font-semibold">Celular</th>
              <th className="p-4 font-semibold">Lección actual</th>
              <th className="p-4 font-semibold">Completadas</th>
              <th className="p-4 font-semibold">Última actividad</th>
              <th className="p-4 font-semibold">Estado</th>
              <th className="p-4 font-semibold">Inscrito</th>
              {editable && <th className="p-4 font-semibold">Rol</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const status = userStatus(u);
              return (
                <tr key={u.uid} className="border-b border-border/60 last:border-0">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={u.photoURL} name={u.displayName} size={36} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{u.displayName}</p>
                        <p className="truncate text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-muted">{u.country || "—"}</td>
                  <td className="p-4 text-muted">{u.phone || "—"}</td>
                  <td className="p-4 tabular-nums">{u.currentLesson}</td>
                  <td className="p-4">
                    <span className="tabular-nums">{u.completedLessonsCount}</span>
                    <span className="ml-1 text-xs text-muted">
                      ({pct(u.completedLessonsCount, SITE.totalLessons)}%)
                    </span>
                  </td>
                  <td className="p-4 text-muted">{relativeTime(u.lastActivityAt)}</td>
                  <td className="p-4">
                    <span className={`badge ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
                  </td>
                  <td className="p-4">
                    <EnrolledControl u={u} />
                  </td>
                  {editable && (
                    <td className="p-4">
                      <RoleControl u={u} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-8 text-center text-sm text-muted">No hay personas que coincidan.</p>
        )}
      </div>
    </div>
  );
}
