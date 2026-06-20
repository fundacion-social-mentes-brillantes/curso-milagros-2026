"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Avatar } from "@/components/ui/Avatar";
import { NAV_USER, SITE } from "@/config/site";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { firebaseUser, appUser, isAdmin, signOutUser } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = firebaseUser ? [...NAV_USER] : [];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur-md">
      <nav className="container-page flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">✦</span>
          <span className="hidden sm:inline">{SITE.shortName}</span>
        </Link>

        {/* enlaces escritorio */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                pathname.startsWith(l.href)
                  ? "bg-primary/12 text-primary"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                pathname.startsWith("/admin")
                  ? "bg-gold/20 text-gold"
                  : "text-gold/90 hover:bg-gold/10",
              )}
            >
              Admin
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {firebaseUser ? (
            <div className="hidden items-center gap-2 md:flex">
              <Avatar src={appUser?.photoURL} name={appUser?.displayName ?? "Tú"} size={34} />
              <button
                onClick={() => void signOutUser()}
                className="text-sm font-semibold text-muted hover:text-fg"
              >
                Salir
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn-primary hidden md:inline-flex">
              Entrar
            </Link>
          )}

          {/* botón móvil */}
          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menú"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* menú móvil */}
      {open && (
        <div className="border-t border-border bg-surface md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-fg hover:bg-surface-2"
              >
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-gold hover:bg-gold/10"
              >
                Panel de administración
              </Link>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
              {firebaseUser ? (
                <>
                  <span className="flex items-center gap-2">
                    <Avatar src={appUser?.photoURL} name={appUser?.displayName ?? "Tú"} size={32} />
                    <span className="text-sm font-semibold">{appUser?.displayName}</span>
                  </span>
                  <button
                    onClick={() => {
                      setOpen(false);
                      void signOutUser();
                    }}
                    className="text-sm font-semibold text-muted"
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
        </div>
      )}
    </header>
  );
}
