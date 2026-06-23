"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { setUserEnrolled, setUserRole } from "@/lib/users";
import { STATUS_LABEL, userStatus } from "@/lib/admin-analytics";
import { ADMIN_EMAILS_PUBLIC } from "@/config/firebase-public";
import { pct, relativeTime, cn } from "@/lib/utils";
import { SITE } from "@/config/site";
import type { AppUser, UserStatus } from "@/types";

type EnrollFilter = "all" | "in" | "out";

const STATUS_CLASS: Record<UserStatus, string> = {
  active: "bg-success/15 text-success",
  paused: "bg-gold/15 text-gold",
  inactive: "bg-muted/15 text-muted",
};

// Correos que SIEMPRE son admin (no se pueden quitar desde la tabla).
const ADMIN_EMAILS_LOWER = ADMIN_EMAILS_PUBLIC.map((e) => e.toLowerCase());
function isPermanentAdmin(email: string): boolean {
  return ADMIN_EMAILS_LOWER.includes(email.toLowerCase());
}

export function UsersTable({
  users,
  editable = false,
}: {
  users: AppUser[];
  editable?: boolean;
}) {
  const { firebaseUser } = useAuth();
  const myUid = firebaseUser?.uid;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<EnrollFilter>("all");
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [enrollBusy, setEnrollBusy] = useState<string | null>(null);

  const enrolledCount = useMemo(() => users.filter((u) => u.enrolled).length, [users]);
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
            className="input max-w-[180px]"
            placeholder="Buscar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
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
                    {editable ? (
                      <button
                        onClick={() => void toggleEnrolled(u)}
                        disabled={enrollBusy === u.uid}
                        title={u.enrolled ? "Inscrito (clic para quitar)" : "No inscrito (clic para inscribir)"}
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-full text-sm font-bold transition",
                          u.enrolled
                            ? "bg-success/20 text-success hover:bg-success/30"
                            : "border border-border bg-surface text-muted hover:text-fg",
                        )}
                      >
                        {u.enrolled ? "✓" : "○"}
                      </button>
                    ) : (
                      <span className={`badge ${u.enrolled ? "bg-success/15 text-success" : "bg-muted/15 text-muted"}`}>
                        {u.enrolled ? "Sí" : "No"}
                      </span>
                    )}
                  </td>
                  {editable && (
                    <td className="p-4">
                      {isPermanentAdmin(u.email) ? (
                        <span
                          className="badge bg-gold/20 text-gold"
                          title="Administrador permanente (correo de la fundación)"
                        >
                          ★ Admin
                        </span>
                      ) : (
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
                            "badge transition disabled:opacity-50",
                            u.role === "admin"
                              ? "bg-gold/20 text-gold hover:bg-gold/30"
                              : "bg-surface-2 text-muted hover:text-fg",
                          )}
                        >
                          {u.role === "admin" ? "★ Admin" : "Hacer admin"}
                        </button>
                      )}
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
