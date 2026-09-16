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

/**
 * Cuántas lecciones se pueden marcar en un mismo día.
 *
 * El Curso pide una al día y repetirla durante toda la jornada; diez seguidas
 * es leerlas, no practicarlas. Pero quien se atrasa necesita poder alcanzar al
 * grupo, así que tres es el término medio.
 *
 * Esto es solo para AVISAR en pantalla. Quien de verdad lo impide es el
 * servidor (`MAXIMO_POR_DIA` en `api/src/functions/avance.js`): un tope que
 * vive en el navegador lo salta cualquiera recargando. Si se cambia uno,
 * cambiar el otro.
 */
export const MAX_LECCIONES_DIA = 3;

/**
 * Bajo qué nombre van quienes todavía no tienen grupo asignado, a efectos de
 * la fecha de arranque.
 *
 * Tratarlos como un grupo más —y no como un caso aparte— evita mantener dos
 * caminos distintos: hay UNA sola manera de ponerle fecha a la gente.
 *
 * TIENE QUE COINCIDIR con `SIN_GRUPO` en `api/src/shared/grupos.js`, que es
 * quien decide de verdad. Si cambia uno, cambiar el otro.
 */
export const SIN_GRUPO = "General";

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

/**
 * Países del desplegable. La usan el registro y la pantalla de Ajustes: si
 * estuviera copiada en las dos, acabarían diferentes y alguien no encontraría
 * el suyo al editar el que ya había elegido.
 */
export const PAISES = [
  "Colombia",
  "México",
  "Argentina",
  "Chile",
  "Perú",
  "Ecuador",
  "Venezuela",
  "Bolivia",
  "Paraguay",
  "Uruguay",
  "Guatemala",
  "Honduras",
  "El Salvador",
  "Nicaragua",
  "Costa Rica",
  "Panamá",
  "Cuba",
  "República Dominicana",
  "Puerto Rico",
  "España",
  "Estados Unidos",
  "Otro",
] as const;
