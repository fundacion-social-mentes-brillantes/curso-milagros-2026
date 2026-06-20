"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { setUserRole } from "@/lib/users";
import { STATUS_LABEL, userStatus } from "@/lib/admin-analytics";
import { pct, relativeTime } from "@/lib/utils";
import { SITE } from "@/config/site";
import type { AppUser, UserStatus } from "@/types";

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
  const [q, setQ] = useState("");
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...users]
      .filter(
        (u) =>
          !query ||
          u.displayName.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
      )
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [users, q]);

  async function toggleRole(u: AppUser) {
    setPendingUid(u.uid);
    try {
      await setUserRole(u.uid, u.role === "admin" ? "user" : "admin");
    } finally {
      setPendingUid(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <h3 className="font-display text-lg font-semibold">Personas ({users.length})</h3>
        <input
          className="input max-w-[220px]"
          placeholder="Buscar..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="p-4 font-semibold">Persona</th>
              <th className="p-4 font-semibold">Lección actual</th>
              <th className="p-4 font-semibold">Completadas</th>
              <th className="p-4 font-semibold">Última actividad</th>
              <th className="p-4 font-semibold">Estado</th>
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
                  {editable && (
                    <td className="p-4">
                      <button
                        onClick={() => void toggleRole(u)}
                        disabled={pendingUid === u.uid}
                        className={`badge transition ${
                          u.role === "admin"
                            ? "bg-gold/20 text-gold hover:bg-gold/30"
                            : "bg-surface-2 text-muted hover:text-fg"
                        }`}
                        title="Cambiar rol"
                      >
                        {u.role === "admin" ? "★ Admin" : "Usuario"}
                      </button>
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
