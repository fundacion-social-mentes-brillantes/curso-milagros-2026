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
  // En la portada el nombre ya está grande en el centro: arriba no se repite.
  const enPortada = !firebaseUser && (pathname === "/" || pathname.startsWith("/login"));

  return (
    <header className="relative z-40">
      <nav className="container-page relative flex h-16 items-center justify-between gap-3 md:h-20">
        <Link
          href={firebaseUser ? "/hoy" : "/"}
          className={cn("flex items-center gap-2.5", enPortada && "invisible")}
          aria-label={`${SITE.name} · ${SITE.org}`}
        >
          <Libro className="w-8" />
          <NombreCurso linea className="w-[9.6rem] md:w-[11rem]" />
        </Link>

        {/* menú del computador: una pastilla pequeña y centrada, como en el video */}
        {links.length > 0 && (
          <div className="nav-pastilla absolute left-1/2 hidden -translate-x-1/2 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={activo(l.href) ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" aria-current={pathname.startsWith("/admin") ? "page" : undefined} className="!text-gold/90">
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
                className={cn("text-sm font-semibold transition", activo("/ajustes") ? "text-fg" : "text-muted hover:text-fg")}
              >
                Ajustes
              </Link>
              <Avatar src={appUser?.photoURL} name={appUser?.displayName ?? "Tú"} size={34} />
              <button onClick={() => void signOutUser()} className="text-sm font-semibold text-muted hover:text-fg">
                Salir
              </button>
            </div>
          ) : enPortada ? null : (
            <Link href="/login" className="boton-blanco hidden !min-h-0 !py-2 !text-sm md:inline-flex">
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
              <span className="tarjeta grid h-9 w-9 place-items-center !rounded-full text-sm">{open ? "✕" : "☰"}</span>
            )}
          </button>
        </div>
      </nav>

      {open && (
        <div className="container-page md:hidden">
          <div className="tarjeta flex flex-col gap-1 !rounded-3xl p-3">
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
              <Link href="/login" onClick={() => setOpen(false)} className="boton-blanco w-full">
                Entrar con Google
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
