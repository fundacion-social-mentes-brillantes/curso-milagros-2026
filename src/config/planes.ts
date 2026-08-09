import type { Plan } from "@/types";

/**
 * Cómo se llaman los planes EN PANTALLA.
 *
 * Nadie es "ordinario": quien recorre el camino es un **Caminante**, y quien
 * además lo sostiene para otros es un **Portador de Luz**. Los nombres
 * internos ("ordinario" / "pro") se quedan en la base de datos para no romper
 * lo ya guardado; aquí vive lo que la gente lee.
 *
 * Si algún día quieres cambiar los nombres, cámbialos SOLO aquí.
 */
export interface PlanInfo {
  nombre: string;
  emoji: string;
  /** Una línea que explica el plan con cariño. */
  frase: string;
  /** Imagen que lo identifica (en /public/images/planes). */
  imagen: string;
}

export const PLAN_INFO: Readonly<Record<Plan, PlanInfo>> = {
  ordinario: {
    nombre: "Caminante",
    emoji: "🕊️",
    frase: "Recorres el camino, una lección y un día a la vez.",
    imagen: "/images/planes/caminante.webp",
  },
  pro: {
    nombre: "Portador de Luz",
    emoji: "✨",
    frase: "Caminas y además sostienes la luz para que otros caminen.",
    imagen: "/images/planes/portador-de-luz.webp",
  },
};

export function planInfo(plan: Plan | undefined): PlanInfo {
  return PLAN_INFO[plan === "ordinario" ? "ordinario" : "pro"];
}

/** Lo que recibe quien es Portador de Luz (se muestra en la invitación). */
export const BENEFICIOS_PORTADOR: readonly string[] = [
  "🎬 El video de cada lección",
  "🎧 La lección narrada en voz alta",
  "🕊️ Lumi, tu acompañante del Curso",
  "🔔 Las campanadas: la idea del día te busca",
  "📓 Tu cuaderno y, al terminar, tu libro del año",
];
