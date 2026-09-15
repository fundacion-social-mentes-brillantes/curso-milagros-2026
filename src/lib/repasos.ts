/**
 * LOS REPASOS del Libro de ejercicios.
 *
 * Cada cierto tiempo el Curso no trae una idea nueva, sino que manda repasar
 * ideas anteriores. Son 69 días de los 365, repartidos en seis bloques, y su
 * estructura es completamente regular:
 *
 *   51–60    repasan las lecciones   1–50    (5 por día)
 *   81–90    repasan las lecciones  61–80    (2 por día)
 *  111–120   repasan las lecciones  91–110   (2 por día)
 *  141–150   repasan las lecciones 121–140   (2 por día)
 *  171–180   repasan las lecciones 151–170   (2 por día)
 *  201–220   repasan las lecciones 181–200   (1 por día)
 *
 * Por qué se calcula en vez de leerlo del texto: el texto marca las lecciones
 * repasadas con "(75)", pero no siempre —la 51 usa otro formato— y basta un
 * espacio de más, "(76 )", para que deje de detectarse. Con la estructura no
 * hay sorpresas. Aun así se comprobó una por una contra el texto real de las
 * 69: coinciden todas.
 *
 * Para qué sirve: un día de repaso que solo diga "El repaso de hoy abarca las
 * siguientes ideas" no le dice nada a nadie. Sabiendo QUÉ lecciones repasa, se
 * pueden enseñar sus ideas y llevar a la persona a cada una.
 */

interface Bloque {
  desde: number;
  hasta: number;
  /** Primera lección que repasa el bloque. */
  repasaDesde: number;
  /** Cuántas lecciones repasa cada día. */
  porDia: number;
  nombre: string;
}

const BLOQUES: Bloque[] = [
  { desde: 51, hasta: 60, repasaDesde: 1, porDia: 5, nombre: "Primer repaso" },
  { desde: 81, hasta: 90, repasaDesde: 61, porDia: 2, nombre: "Segundo repaso" },
  { desde: 111, hasta: 120, repasaDesde: 91, porDia: 2, nombre: "Tercer repaso" },
  { desde: 141, hasta: 150, repasaDesde: 121, porDia: 2, nombre: "Cuarto repaso" },
  { desde: 171, hasta: 180, repasaDesde: 151, porDia: 2, nombre: "Quinto repaso" },
  { desde: 201, hasta: 220, repasaDesde: 181, porDia: 1, nombre: "Sexto repaso" },
];

export interface Repaso {
  /** "Primer repaso", "Segundo repaso"… */
  nombre: string;
  /** Números de las lecciones que se repasan ese día. */
  lecciones: number[];
}

/** ¿Es un día de repaso? Devuelve qué repasa, o null si es una lección normal. */
export function repasoDe(numero: number): Repaso | null {
  for (const b of BLOQUES) {
    if (numero >= b.desde && numero <= b.hasta) {
      const posicion = numero - b.desde;
      const primera = b.repasaDesde + posicion * b.porDia;
      return {
        nombre: b.nombre,
        lecciones: Array.from({ length: b.porDia }, (_, i) => primera + i),
      };
    }
  }
  return null;
}

/** Cuántos días del proceso son de repaso (69 de 365). */
export function totalDiasDeRepaso(): number {
  return BLOQUES.reduce((suma, b) => suma + (b.hasta - b.desde + 1), 0);
}
