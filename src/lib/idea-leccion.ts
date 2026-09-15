import { repasoDe } from "@/lib/repasos";

/**
 * LA IDEA DE UNA LECCIÓN: la frase que se repite durante el día.
 *
 * Normalmente es el título de la lección. Hay dos casos en que no sirve, y
 * conviene distinguirlos porque NO son lo mismo:
 *
 *  - REPASO: 69 días del proceso no traen idea nueva, sino que mandan repasar
 *    ideas anteriores, y se titulan "El repaso de hoy abarca las siguientes
 *    ideas:". Eso solo no dice nada. Como la estructura de repasos es conocida
 *    (ver `repasos.ts`), aquí sí se puede decir QUÉ se repasa.
 *
 *  - SIN TÍTULO: si alguna lección se quedara sin título, no nos inventamos una
 *    frase. Mejor no decir nada que decir algo que no es.
 *
 * Esta misma regla vive también en el recordatorio del servidor
 * (`api/src/functions/recordatorio.js`): si se cambia aquí, cambiarla allá.
 */

const FRASE_DE_REPASO = /^(el\s+)?repaso\b|abarca las siguientes ideas/i;

export type MotivoIdea = "propia" | "repaso" | "sin-titulo";

export interface IdeaDeLeccion {
  /** La frase para mostrar o compartir. Vacía solo si no hay nada que decir. */
  idea: string;
  motivo: MotivoIdea;
}

/** "11, 12, 13, 14 y 15" — como se dice en español, con "y" al final. */
function enumerar(numeros: number[]): string {
  if (numeros.length === 0) return "";
  if (numeros.length === 1) return String(numeros[0]);
  return `${numeros.slice(0, -1).join(", ")} y ${numeros[numeros.length - 1]}`;
}

export function ideaDeLeccion(
  titulo: string | null | undefined,
  numero?: number,
): IdeaDeLeccion {
  const t = String(titulo ?? "").trim();

  // El repaso se decide por la ESTRUCTURA del Curso, no por cómo esté escrito
  // el título: así funciona igual aunque la traducción cambie las palabras.
  const repaso = typeof numero === "number" ? repasoDe(numero) : null;
  if (repaso) {
    const cuales = enumerar(repaso.lecciones);
    const idea =
      repaso.lecciones.length === 1
        ? `Hoy vuelvo sobre la idea de la lección ${cuales}.`
        : `Hoy vuelvo sobre las ideas de las lecciones ${cuales}.`;
    return { idea, motivo: "repaso" };
  }

  if (!t) return { idea: "", motivo: "sin-titulo" };

  // Respaldo: si el título tiene pinta de repaso pero el número no lo decía
  // (por ejemplo al compartir sin saber el número), no se manda esa frase.
  if (FRASE_DE_REPASO.test(t)) {
    return { idea: "Hoy toca repasar las ideas de los días anteriores.", motivo: "repaso" };
  }

  return { idea: t, motivo: "propia" };
}
