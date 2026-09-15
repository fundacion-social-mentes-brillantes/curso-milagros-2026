/**
 * LA IDEA DE UNA LECCIÓN: la frase que se repite durante el día.
 *
 * Normalmente es el título de la lección. Pero hay dos casos en que no sirve, y
 * conviene distinguirlos porque NO son lo mismo:
 *
 *  - REPASO: las lecciones 52 a 60, 85 y 87 se titulan "El repaso de hoy abarca
 *    las siguientes ideas:". Ahí sí es un repaso de verdad, y decirlo es exacto.
 *
 *  - SIN TÍTULO: la 213 y la 359 se quedaron sin título en el contenido. NO son
 *    repasos; es un hueco que hay que rellenar desde /admin/lecciones. Llamarlas
 *    "repaso" sería decirle a la gente algo que no es cierto.
 *
 * Esta misma regla vive también en el recordatorio del servidor
 * (`api/src/functions/recordatorio.js`): si se cambia aquí, cambiarla allá.
 */

const FRASE_DE_REPASO = /^(el\s+)?repaso\b|abarca las siguientes ideas/i;

export type MotivoIdea = "propia" | "repaso" | "sin-titulo";

export interface IdeaDeLeccion {
  /** La frase para mostrar o compartir. Vacía solo si la lección no tiene título. */
  idea: string;
  motivo: MotivoIdea;
}

export function ideaDeLeccion(titulo: string | null | undefined): IdeaDeLeccion {
  const t = String(titulo ?? "").trim();

  if (!t) {
    // Sin título no nos inventamos una frase: mejor no decir nada que mentir.
    return { idea: "", motivo: "sin-titulo" };
  }
  if (FRASE_DE_REPASO.test(t)) {
    return { idea: "Hoy toca repasar las ideas de los días anteriores.", motivo: "repaso" };
  }
  return { idea: t, motivo: "propia" };
}
