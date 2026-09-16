"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  setUserEnrolled,
  setUserGrupo,
  setUserLeccion,
  setUserPlan,
  setUserPuedeAjustarLeccion,
  setUserRole,
  setUserVoiceReader,
} from "@/lib/users";
import { planInfo } from "@/config/planes";
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
  onCambio,
}: {
  users: AppUser[];
  editable?: boolean;
  /**
   * Se llama después de guardar un cambio, para que quien manda la lista la
   * vuelva a pedir. Sin esto el cambio se guarda pero la pantalla se queda
   * igual, y parece que el botón no hace nada.
   */
  onCambio?: () => void;
}) {
  const { firebaseUser } = useAuth();
  const myUid = firebaseUser?.uid;
  const iAmSuper = isPermanentAdmin(firebaseUser?.email);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<EnrollFilter>("all");
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [enrollBusy, setEnrollBusy] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState<string | null>(null);
  const [grupoBusy, setGrupoBusy] = useState<string | null>(null);
  const [leccionBusy, setLeccionBusy] = useState<string | null>(null);
  const [permisoBusy, setPermisoBusy] = useState<string | null>(null);

  /** Los grupos que ya existen, para poder elegirlos sin volver a escribirlos. */
  const gruposExistentes = useMemo(
    () => [...new Set(users.map((u) => (u.grupo || "").trim()).filter(Boolean))].sort(),
    [users],
  );

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

  const [error, setError] = useState<string | null>(null);

  /**
   * Hace un cambio sobre una persona.
   *
   * Tres cosas que antes no pasaban y hacían que pareciera roto:
   *  - si falla, ahora se ve el aviso (antes el error se tragaba en silencio);
   *  - si sale bien, se vuelve a pedir la lista para que el cambio se vea;
   *  - mientras tanto el botón queda ocupado, para no darle dos veces.
   */
  async function guardarCambio(
    uid: string,
    ocupar: (v: string | null) => void,
    accion: () => Promise<void>,
  ) {
    setError(null);
    ocupar(uid);
    try {
      await accion();
      onCambio?.();
    } catch {
      setError("No se pudo guardar el cambio. Revisa tu conexión e inténtalo otra vez.");
    } finally {
      ocupar(null);
    }
  }

  async function toggleRole(u: AppUser) {
    const makingAdmin = u.role !== "admin";
    const ok = window.confirm(
      makingAdmin
        ? `¿Hacer administrador a ${u.displayName}? Podrá ver y gestionar todo el panel, igual que tú.`
        : `¿Quitar el acceso de administrador a ${u.displayName}?`,
    );
    if (!ok) return;
    await guardarCambio(u.uid, setPendingUid, () =>
      setUserRole(u.uid, makingAdmin ? "admin" : "user"),
    );
  }

  async function toggleEnrolled(u: AppUser) {
    await guardarCambio(u.uid, setEnrollBusy, () => setUserEnrolled(u.uid, !u.enrolled));
  }

  async function togglePlan(u: AppUser) {
    await guardarCambio(u.uid, setPlanBusy, () =>
      setUserPlan(u.uid, u.plan === "ordinario" ? "pro" : "ordinario"),
    );
  }

  async function cambiarGrupo(u: AppUser, grupo: string) {
    await guardarCambio(u.uid, setGrupoBusy, () => setUserGrupo(u.uid, grupo));
  }

  /*
   * Mover a alguien de lección. El admin no tiene techo: es quien sabe si esa
   * persona entró tarde o si el número quedó mal puesto.
   *
   * Se avisa de lo que va a pasar porque adelantar NO es solo cambiar un
   * número: da por hechas todas las lecciones anteriores, y eso mueve las
   * cifras del grupo. Retroceder, en cambio, no desmarca nada.
   */
  async function cambiarLeccion(u: AppUser) {
    const escrito = window.prompt(
      [
        `¿En qué lección va ${u.displayName}? (1 a ${SITE.totalLessons})`,
        "",
        "Si la subes, las anteriores quedarán como hechas.",
        "Si la bajas, solo se mueve el número: no se desmarca nada.",
      ].join("\n"),
      String(u.currentLesson || 1),
    );
    if (escrito === null) return;

    const n = Math.trunc(Number(escrito.trim()));
    if (!Number.isFinite(n) || n < 1 || n > SITE.totalLessons) {
      setError(`Escribe un número entre 1 y ${SITE.totalLessons}.`);
      return;
    }
    if (n === u.currentLesson) return;
    await guardarCambio(u.uid, setLeccionBusy, () => setUserLeccion(u.uid, n));
  }

  async function togglePermiso(u: AppUser) {
    await guardarCambio(u.uid, setPermisoBusy, () =>
      setUserPuedeAjustarLeccion(u.uid, !u.puedeAjustarLeccion),
    );
  }

  async function toggleVoice(u: AppUser) {
    await guardarCambio(u.uid, setVoiceBusy, () =>
      setUserVoiceReader(u.uid, !u.voiceReader),
    );
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

  // Plan: Portador de Luz (sostiene el proceso) o Caminante. Decide video,
  // Lumi, la lección narrada y sus logros.
  function PlanControl({ u }: { u: AppUser }) {
    const info = planInfo(u.plan);
    const esPortador = u.plan !== "ordinario";
    if (!editable) {
      return (
        <span className={`badge ${esPortador ? "bg-gold/20 text-gold" : "bg-aqua/15 text-aqua"}`}>
          {info.emoji} {info.nombre}
        </span>
      );
    }
    return (
      <button
        onClick={() => void togglePlan(u)}
        disabled={planBusy === u.uid}
        title="Portador de Luz: sostiene el proceso; ve el video, Lumi y la lección narrada. Caminante: texto y guía completa (gratis siempre)."
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
          esPortador
            ? "bg-gold/20 text-gold hover:bg-gold/30"
            : "border border-border bg-surface text-muted hover:text-fg",
        )}
      >
        {planBusy === u.uid ? "…" : `${info.emoji} ${info.nombre}`}
      </button>
    );
  }

  /**
   * Grupo de la persona.
   *
   * Es un desplegable con los grupos que ya existen más la opción de crear uno.
   * Se hizo así, y no como texto libre suelto, porque escribiendo a mano
   * acaban conviviendo "Grupo 1", "grupo 1" y "Grupo1" como si fueran tres
   * grupos distintos, y entonces las cifras por grupo dejan de servir.
   */
  function GrupoControl({ u }: { u: AppUser }) {
    const actual = (u.grupo || "").trim();
    if (!editable) {
      return <span className="text-sm text-muted">{actual || "—"}</span>;
    }
    return (
      <select
        value={actual}
        disabled={grupoBusy === u.uid}
        aria-label={`Grupo de ${u.displayName}`}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__nuevo__") {
            const nombre = window.prompt(
              "Nombre del grupo nuevo (por ejemplo: Grupo 2)",
              "",
            );
            if (nombre && nombre.trim()) void cambiarGrupo(u, nombre.trim());
            return;
          }
          void cambiarGrupo(u, v);
        }}
        className="max-w-[10rem] rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg outline-none transition focus:border-aqua/60 disabled:opacity-50"
      >
        <option value="">Sin grupo</option>
        {gruposExistentes.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
        <option value="__nuevo__">➕ Nuevo grupo…</option>
      </select>
    );
  }

  // Accesibilidad: lectura de la lección en voz alta (solo para quien la pida).
  function VoiceControl({ u }: { u: AppUser }) {
    return (
      <button
        onClick={() => void toggleVoice(u)}
        disabled={voiceBusy === u.uid}
        title="Lectura en voz alta de la lección (para personas con baja visión que la soliciten)"
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
          u.voiceReader
            ? "bg-aqua/20 text-aqua hover:bg-aqua/30"
            : "border border-border bg-surface text-muted hover:text-fg",
        )}
      >
        {voiceBusy === u.uid ? "…" : u.voiceReader ? "🔊 Voz activa" : "🔇 Voz"}
      </button>
    );
  }

  // La lección en la que va, tocable para cambiarla.
  function LeccionControl({ u }: { u: AppUser }) {
    if (!editable) return <span className="tabular-nums">{u.currentLesson}</span>;
    return (
      <button
        onClick={() => void cambiarLeccion(u)}
        disabled={leccionBusy === u.uid}
        title="Cambiar en qué lección va"
        className="rounded-lg px-2 py-1 font-semibold tabular-nums transition hover:bg-surface-2 disabled:opacity-50"
      >
        {leccionBusy === u.uid ? "…" : `${u.currentLesson} ✎`}
      </button>
    );
  }

  /*
   * El permiso para que esa persona se ajuste ELLA MISMA la lección, sin pasar
   * de donde va su grupo. Apagado, solo se la puedes cambiar tú.
   */
  function PermisoControl({ u }: { u: AppUser }) {
    return (
      <button
        onClick={() => void togglePermiso(u)}
        disabled={permisoBusy === u.uid}
        title="Dejar que esta persona ajuste su propia lección (sin pasar de donde va su grupo)"
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
          u.puedeAjustarLeccion
            ? "bg-primary/20 text-primary hover:bg-primary/30"
            : "border border-border bg-surface text-muted hover:text-fg",
        )}
      >
        {permisoBusy === u.uid
          ? "…"
          : u.puedeAjustarLeccion
            ? "🔓 Puede ajustarla"
            : "🔒 Solo tú"}
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
      {error && (
        <p className="border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          {error}
        </p>
      )}
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
            className="input w-full sm:w-44"
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
                <span className="flex items-center gap-1">
                  🧭 Lección <LeccionControl u={u} />
                </span>
                <span>
                  ✅ {u.completedLessonsCount}{" "}
                  <span className="opacity-70">({pct(u.completedLessonsCount, SITE.totalLessons)}%)</span>
                </span>
                <span className="col-span-2">🕐 Última actividad: {relativeTime(u.lastActivityAt)}</span>
              </div>

              {editable && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <span className="flex items-center gap-2 text-xs text-muted">
                    Inscrito: <EnrolledControl u={u} />
                  </span>
                  <PlanControl u={u} />
                  <VoiceControl u={u} />
                  <RoleControl u={u} />
                  <span className="flex items-center gap-2 text-xs text-muted">
                    Grupo: <GrupoControl u={u} />
                  </span>
                  <PermisoControl u={u} />
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
              <th className="p-4 font-semibold">Plan</th>
              <th className="p-4 font-semibold">Grupo</th>
              {editable && <th className="p-4 font-semibold">Ajusta su lección</th>}
              {editable && <th className="p-4 font-semibold">Voz</th>}
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
                  <td className="p-4">
                    <LeccionControl u={u} />
                  </td>
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
                  <td className="p-4">
                    <PlanControl u={u} />
                  </td>
                  <td className="p-4">
                    <GrupoControl u={u} />
                  </td>
                  {editable && (
                    <td className="p-4">
                      <PermisoControl u={u} />
                    </td>
                  )}
                  {editable && (
                    <td className="p-4">
                      <VoiceControl u={u} />
                    </td>
                  )}
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
