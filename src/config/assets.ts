/**
 * De dónde salen los archivos PESADOS (los audios narrados y las imágenes de
 * cada lección): 643 de los 650 MB del proyecto.
 *
 * Por qué se sacan fuera: Azure Static Web Apps no admite sitios de más de
 * 250 MB. Sacando estas dos carpetas el sitio baja a 7 MB y entra de sobra.
 * De paso, servirlos desde almacenamiento los hace más rápidos y baratos.
 *
 * Si la variable NO está puesta, se usan las rutas de siempre (dentro del
 * sitio). Así el mismo código funciona igual en Vercel y en Azure, y se puede
 * probar el cambio sin migrar nada.
 */

const BASE = (process.env.NEXT_PUBLIC_ASSETS_URL ?? "").replace(/\/+$/, "");

/** Audio narrado de una lección. `n` con ceros: "001". */
export function audioLeccion(n: string): string {
  return BASE ? `${BASE}/audio/${n}.mp3` : `/audio/lecciones/${n}.mp3`;
}

/** Imagen de una lección. `n` con ceros: "001". */
export function imagenLeccion(n: string): string {
  return BASE ? `${BASE}/imagenes/lecciones/${n}.webp` : `/images/lecciones/${n}.webp`;
}

/** ¿Los pesados ya se sirven desde fuera? (para saber qué se quedó en el sitio) */
export const ASSETS_FUERA = BASE.length > 0;

/**
 * MÚSICA DE FONDO para escuchar la lección.
 *
 * Suena por DEBAJO de la voz, en bucle, y se puede apagar. Va como pista
 * aparte y no mezclada dentro de cada MP3 a propósito: son 365 audios, y si
 * algún día la música cansa —o simplemente se quiere otra— así se cambia un
 * archivo en vez de volver a mezclar y resubir los 365. Además cada quien
 * decide si la quiere; a mucha gente le estorba.
 *
 * Vacío = no hay música todavía y el control ni aparece.
 */
export function musicaDeFondo(): string {
  return BASE ? `${BASE}/audio/fondo.mp3` : "";
}
