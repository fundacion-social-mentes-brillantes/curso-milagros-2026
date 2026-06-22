"use client";

import { useEffect } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { relativeTime } from "@/lib/utils";
import { exportPeoplePdf } from "@/lib/pdf-export";
import type { AppUser } from "@/types";

/** Convierte un teléfono en enlace de WhatsApp (solo dígitos). */
function waLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
}

/**
 * Ventana con una lista de personas (para las tarjetas del panel admin):
 * inscritas, activas hoy, quiénes no han hecho la lección de hoy, etc.
 */
export function PeopleListModal({
  title,
  description,
  people,
  onClose,
}: {
  title: string;
  description?: string;
  people: AppUser[];
  onClose: () => void;
}) {
  // Cerrar con la tecla Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] grid animate-fade-in place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="card flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold">{title}</h3>
            <p className="mt-0.5 text-sm text-muted">
              {people.length} {people.length === 1 ? "persona" : "personas"}
              {description ? ` · ${description}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {people.length > 0 && (
              <button
                onClick={() =>
                  void exportPeoplePdf(people, { title, subtitle: description })
                }
                className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-fg transition hover:bg-surface-2"
                title="Descargar esta lista en PDF"
              >
                ⬇ PDF
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="scrollbar-soft flex-1 overflow-y-auto p-3">
          {people.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">
              No hay personas en esta lista. 🌿
            </p>
          ) : (
            <ul className="space-y-1">
              {people.map((u) => {
                const wa = waLink(u.phone);
                const name = u.fullName || u.displayName;
                return (
                  <li
                    key={u.uid}
                    className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-surface-2"
                  >
                    <Avatar src={u.photoURL} name={name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{name}</p>
                      <p className="truncate text-xs text-muted">
                        Lección {u.currentLesson || 1}
                        {u.country ? ` · ${u.country}` : ""}
                        {u.lastActivityAt ? ` · activa ${relativeTime(u.lastActivityAt)}` : ""}
                      </p>
                    </div>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold text-success transition hover:bg-success/25"
                        title={`Escribir a ${u.phone} por WhatsApp`}
                      >
                        WhatsApp
                      </a>
                    ) : (
                      u.phone && (
                        <span className="shrink-0 text-xs text-muted">{u.phone}</span>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
