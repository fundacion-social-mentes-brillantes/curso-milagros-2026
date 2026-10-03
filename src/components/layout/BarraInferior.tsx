"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

/** Íconos de línea fina, del mismo trazo que el libro del logo. */
const ICONOS: Record<string, React.ReactNode> = {
  hoy: (
    <>
      <path d="M3.5 17.5h17" />
      <path d="M6.5 17.5a5.5 5.5 0 0 1 11 0" />
      <path d="M12 5v2.6M5.6 8.4l1.8 1.8M18.4 8.4l-1.8 1.8" />
    </>
  ),
  camino: (
    <>
      <circle cx="12" cy="12" r="1.3" />
      <path d="M12 12c0-2.2 2.6-2.8 3.6-1 1.3 2.4-1 5.4-4 5.3-3.6-.1-5.6-3.6-4.6-6.8 1.2-4 6.3-5.6 9.6-3.2" />
    </>
  ),
  lecciones: (
    <>
      <rect x="4" y="4" width="6.6" height="6.6" rx="2" />
      <rect x="13.4" y="4" width="6.6" height="6.6" rx="2" />
      <rect x="4" y="13.4" width="6.6" height="6.6" rx="2" />
      <rect x="13.4" y="13.4" width="6.6" height="6.6" rx="2" />
    </>
  ),
  ajustes: (
    <>
      <path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9" />
      <circle cx="15" cy="7.5" r="2" />
      <circle cx="9" cy="16.5" r="2" />
    </>
  ),
};

const ENLACES = [
  { href: "/hoy", label: "Hoy", icono: "hoy" },
  { href: "/dashboard", label: "Mi camino", icono: "camino" },
  { href: "/lecciones", label: "Lecciones", icono: "lecciones" },
  { href: "/ajustes", label: "Ajustes", icono: "ajustes" },
];

/** La barra flotante del celular, una pastilla oscura (en el computador el menú va arriba). */
export function BarraInferior() {
  const { firebaseUser } = useAuth();
  const pathname = usePathname();
  if (!firebaseUser) return null;
  return (
    <nav className="barra-inferior" aria-label="Menú principal">
      {ENLACES.map((e) => {
        const activo = pathname === e.href || pathname.startsWith(`${e.href}/`);
        return (
          <Link key={e.href} href={e.href} aria-current={activo ? "page" : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden>
              {ICONOS[e.icono]}
            </svg>
            {e.label}
          </Link>
        );
      })}
    </nav>
  );
}
