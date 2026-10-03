"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Libro, NombreCurso } from "@/components/marca/Libro";
import { NAV_USER, SITE } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Encabezado: el libro del ícono y el nombre del curso (la imagen fija de la
 * referencia, en una línea). En el computador, el menú en una píldora de vidrio;
 * en el celular el menú principal vive en la barra de abajo, y aquí queda solo
 * lo que no cabe allá (administración y salir).
 */
export function Navbar() {
  const { firebaseUser, appUser, isAdmin, signOutUser } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = firebaseUser ? [...NAV_USER] : [];
  const activo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="relative z-40">
      <nav className="container-page flex h-16 items-center justify-between gap-3 md:h-20">
        <Link href={firebaseUser ? "/hoy" : "/"} className="flex items-center gap-2.5" aria-label={`${SITE.name} · ${SITE.org}`}>
          <Libro className="w-8" />
          <NombreCurso linea className="h-[0.82rem] w-auto md:h-[0.95rem]" />
        </Link>

        {/* menú del computador: una píldora de vidrio; lo activo se nota por la luz, no por una caja */}
        {links.length > 0 && (
          <div className="vidrio hidden items-center gap-0.5 rounded-full p-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={activo(l.href) ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-4 py-2 text-sm font-medium transition",
                  activo(l.href)
                    ? "text-fg [text-shadow:0_0_14px_rgb(236_205_140_/_0.5)] before:absolute before:inset-x-2 before:-bottom-1 before:-z-10 before:h-6 before:rounded-full before:bg-[radial-gradient(closest-side,rgb(236_205_140_/_0.28),transparent)]"
                    : "text-muted hover:text-fg",
                )}
              >
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  pathname.startsWith("/admin") ? "text-gold" : "text-gold/80 hover:text-gold",
                )}
              >
                Admin
              </Link>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {firebaseUser ? (
            <div className="hidden items-center gap-3 md:flex">
              <Link
                href="/ajustes"
                className={cn("text-sm font-medium transition", activo("/ajustes") ? "text-fg" : "text-muted hover:text-fg")}
              >
                Ajustes
              </Link>
              <Avatar src={appUser?.photoURL} name={appUser?.displayName ?? "Tú"} size={34} />
              <button onClick={() => void signOutUser()} className="text-sm font-medium text-muted hover:text-fg">
                Salir
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn-primary hidden md:inline-flex">
              Entrar
            </Link>
          )}

          {/* celular: el avatar abre lo poco que no está en la barra de abajo */}
          <button
            className="grid h-9 w-9 place-items-center overflow-hidden rounded-full md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menú"
            aria-expanded={open}
          >
            {firebaseUser ? (
              <Avatar src={appUser?.photoURL} name={appUser?.displayName ?? "Tú"} size={34} />
            ) : (
              <span className="vidrio grid h-9 w-9 place-items-center rounded-full text-sm">{open ? "✕" : "☰"}</span>
            )}
          </button>
        </div>
      </nav>

      {open && (
        <div className="container-page md:hidden">
          <div className="vidrio flex flex-col gap-1 rounded-3xl p-3">
            {firebaseUser ? (
              <>
                <p className="px-3 pb-1 pt-1 text-sm font-medium text-fg">{appUser?.displayName}</p>
                {isAdmin && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="rounded-2xl px-3 py-3 text-sm font-medium text-gold">
                    Panel de administración
                  </Link>
                )}
                <Link href="/ajustes" onClick={() => setOpen(false)} className="rounded-2xl px-3 py-3 text-sm font-medium text-fg">
                  Ajustes
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    void signOutUser();
                  }}
                  className="rounded-2xl px-3 py-3 text-left text-sm font-medium text-muted"
                >
                  Salir
                </button>
              </>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)} className="btn-primary w-full">
                Entrar con Google
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
