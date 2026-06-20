export const SITE = {
  name: "Un Curso de Milagros 2026",
  shortName: "UCDM 2026",
  org: "Gimnasio Emocional Mentes Brillantes",
  tagline: "Un paso de paz cada día.",
  description:
    "Acompañamiento diario de las 365 lecciones de Un Curso de Milagros, con video, lectura, guía y comunidad.",
  courseYear: Number(process.env.NEXT_PUBLIC_COURSE_YEAR ?? 2026),
  totalLessons: 365,
} as const;

export const NAV_USER = [
  { href: "/dashboard", label: "Mi camino" },
  { href: "/lecciones", label: "Lecciones" },
] as const;

export const NAV_ADMIN = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/usuarios", label: "Personas" },
  { href: "/admin/lecciones", label: "Lecciones" },
  { href: "/admin/foro", label: "Foro" },
] as const;
