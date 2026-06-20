/**
 * Links a la fuente del texto original de cada lección
 * (blog "Aprendiendo Un Curso de Milagros").
 *
 * En vez de listar 365 URLs a mano, se generan a partir del patrón del blog
 * (carpeta año/mes) con las excepciones reales que no siguen el patrón.
 * El script `import:textos` usa estos links para bajar el texto original.
 */

export const TOTAL_LESSONS = 365;

const BASE = "https://aprendiendouncursodemilagros.blogspot.com";

/** Rangos de lecciones -> carpeta año/mes del blog. */
const RANGES: ReadonlyArray<{ from: number; to: number; path: string }> = [
  { from: 3, to: 31, path: "2017/01" },
  { from: 32, to: 59, path: "2017/02" },
  { from: 60, to: 90, path: "2017/03" },
  { from: 91, to: 120, path: "2017/04" },
  { from: 121, to: 151, path: "2017/05" },
  { from: 152, to: 181, path: "2017/06" },
  { from: 182, to: 212, path: "2017/07" },
  { from: 213, to: 243, path: "2017/08" },
  { from: 244, to: 273, path: "2017/09" },
  { from: 274, to: 304, path: "2017/10" },
  { from: 305, to: 334, path: "2017/11" },
  { from: 335, to: 360, path: "2017/12" },
];

/** URLs que no siguen el patrón estándar. */
const EXCEPTIONS: Readonly<Record<number, string>> = {
  1: `${BASE}/2015/01/primera-parte-leccion-1-nada-de-lo-que.html`,
  2: `${BASE}/2018/01/ucdm-libro-de-ejercicios-leccion-2.html`,
  // Nota: el blog escribió "ejerciciosleccion" sin guion en la 24.
  24: `${BASE}/2017/01/ucdm-libro-de-ejerciciosleccion-24.html`,
};

/** Las lecciones 361 a 365 comparten una sola entrada en el blog. */
const FINAL_FIVE_URL = `${BASE}/2017/12/ucdm-libro-de-ejercicios-leccion-361-365.html`;

/** Devuelve la URL de la fuente del texto original para una lección. */
export function lessonSourceUrl(n: number): string {
  if (n >= 361 && n <= 365) return FINAL_FIVE_URL;
  const exception = EXCEPTIONS[n];
  if (exception) return exception;
  const range = RANGES.find((r) => n >= r.from && n <= r.to);
  if (!range) return "";
  return `${BASE}/${range.path}/ucdm-libro-de-ejercicios-leccion-${n}.html`;
}

/** Lista completa { number, url } para las 365 lecciones. */
export function allLessonLinks(): ReadonlyArray<{ number: number; url: string }> {
  return Array.from({ length: TOTAL_LESSONS }, (_, i) => {
    const number = i + 1;
    return { number, url: lessonSourceUrl(number) };
  });
}

/** id de documento con ceros a la izquierda: 25 -> "025". */
export function lessonDocId(n: number): string {
  return String(n).padStart(3, "0");
}
