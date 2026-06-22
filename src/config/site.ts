export const SITE = {
  name: "Un Curso de Milagros",
  shortName: "Un Curso de Milagros",
  org: "Gimnasio Emocional Mentes Brillantes",
  tagline: "Un paso de paz cada día.",
  description:
    "Acompañamiento diario de las 365 lecciones de Un Curso de Milagros, con video, lectura, guía y comunidad.",
  facebookUrl: "https://www.facebook.com/fundacionsocialmentesbrillantes",
  courseYear: Number(process.env.NEXT_PUBLIC_COURSE_YEAR ?? 2026),
  totalLessons: 365,
} as const;

/**
 * Solo para este primer año (el proceso ya había comenzado): en el registro se
 * pregunta "¿en qué lección vas?" y se marcan como hechas las anteriores.
 * El próximo año pon esto en `false` y todos empezarán desde la lección 1.
 */
export const ASK_STARTING_LESSON = true;

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
