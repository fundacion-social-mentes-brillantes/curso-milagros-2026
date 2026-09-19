/**
 * LEER EL LIBRO DE EJERCICIOS desde el texto extraído del PDF.
 *
 * Vive aparte porque lo usan dos: el que audita y el que importa. Si cada uno
 * tuviera su copia, acabarían partiendo el libro de forma distinta y nadie
 * sabría cuál de los dos dice la verdad.
 *
 * EL CORTE ENTRE LECCIONES, que es lo delicado.
 *
 * Entre lección y lección el libro intercala secciones suyas que NO pertenecen
 * a la lección anterior: las catorce "¿Qué es…?", las introducciones de cada
 * tanda de repaso, "SEGUNDA PARTE", "LECCIONES FINALES" y el epílogo. Si se
 * dejan dentro, la lección anterior parece tener el doble de texto del que
 * tiene.
 *
 * La trampa que costó una auditoría entera: "1. ¿Qué es el perdón?" es una
 * sección del libro, pero "1. ¿Qué es lo que mantiene al mundo prisionero sino
 * tus propias creencias?" es el primer párrafo de la lección 132. Empiezan
 * igual. Cortar mirando solo el principio de la línea se comía lecciones
 * enteras: la 132 se quedaba en 56 caracteres de los 8.000 que tiene, y la 165
 * y la 291 igual. Como la comparación seguía dando "parecido alto" por otros
 * motivos, el fallo no se vio.
 *
 * Lo que sí las distingue: los títulos de sección son líneas CORTAS que
 * terminan en «?» y ahí acaban. Los párrafos de lección son largos y siguen.
 */

import { readFileSync } from "node:fs";

const SALTO = "\n";

/** Encabezados de sección del libro que cortan la lección anterior. */
function esSeccionDelLibro(linea) {
  const t = linea.trim();

  // "1. ¿Qué es el perdón?" y las trece hermanas. Cortas y acaban en «?».
  if (/^\d+\.\s*¿Qu[eé]\s+(es|soy)\b/i.test(t)) {
    return t.endsWith("?") && t.length <= 60;
  }

  return /^(Introducci[oó]n\b|PRIMERA PARTE|SEGUNDA PARTE|LECCIONES FINALES|EP[IÍ]LOGO)/i.test(t);
}

/** Separa el título (las primeras líneas) del cuerpo numerado. */
function partirTituloYTexto(trozo) {
  const partes = [];
  let j = 0;
  while (j < trozo.length && trozo[j].trim() === "") j++;
  // El título acaba al llegar al primer párrafo numerado ("1. ") o a la primera
  // idea de repaso entre paréntesis ("(125) ..."). Sin lo segundo, en las
  // lecciones de repaso —que no tienen párrafos numerados— el título se comía
  // la lección entera y quedaba vacía.
  while (
    j < trozo.length &&
    trozo[j].trim() !== "" &&
    !/^\s*\d+\.\s/.test(trozo[j]) &&
    !/^\s*\(\d+\)/.test(trozo[j])
  ) {
    partes.push(trozo[j].trim());
    j++;
  }
  return {
    titulo: partes.join(" ").replace(/\s+/g, " ").trim(),
    // El texto NO repite el título: en la app el título va en la cabecera, y
    // volver a ponerlo dentro lo enseñaría dos veces.
    texto: trozo.slice(j).join(SALTO).trim(),
    cuerpo: trozo.join(SALTO).trim(),
  };
}

/**
 * Devuelve un Map con { titulo, texto, cuerpo } por número de lección.
 *
 * Las 361 a 365 no llevan marca propia en el libro: comparten un mismo texto
 * bajo "LECCIONES 361-365". Se les da a las cinco ese texto, que es justo lo
 * que hace el libro.
 */
export function leerLibro(ruta) {
  const lineas = readFileSync(ruta, "utf8").split(SALTO);

  const marcas = [];
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/^\s*LECCI[OÓ]N\s+(\d+)\s*$/);
    if (m) marcas.push({ numero: Number(m[1]), linea: i });
  }

  const salida = new Map();
  for (let i = 0; i < marcas.length; i++) {
    const desde = marcas[i].linea + 1;
    const hasta = i + 1 < marcas.length ? marcas[i + 1].linea : lineas.length;
    let trozo = lineas.slice(desde, hasta);

    const corte = trozo.findIndex((l, k) => k > 0 && esSeccionDelLibro(l));
    if (corte > 0) trozo = trozo.slice(0, corte);

    salida.set(marcas[i].numero, partirTituloYTexto(trozo));
  }

  // Las cinco finales comparten texto.
  const iFinales = lineas.findIndex((l) => /^\s*LECCIONES\s+361-365\s*$/.test(l));
  if (iFinales >= 0) {
    let fin = lineas.findIndex((l, k) => k > iFinales && /^\s*EP[IÍ]LOGO\s*$/.test(l));
    if (fin < 0) fin = lineas.length;
    const comun = partirTituloYTexto(lineas.slice(iFinales + 1, fin));
    for (let n = 361; n <= 365; n++) salida.set(n, { ...comun });
  }

  return salida;
}

/**
 * Las INTRODUCCIONES de cada tanda de repaso.
 *
 * El libro las imprime antes de la primera lección de la tanda, como sección
 * aparte. En la app viven DENTRO de esa primera lección (51, 81, 111, 141, 171
 * y 201), porque quien abre la 51 necesita leer de qué va el repaso que
 * empieza; mandarlo a otra pantalla a buscarla se la salta todo el mundo.
 *
 * Se indexan por la lección que viene justo después, que es su dueña.
 */
export function leerIntroducciones(ruta) {
  const lineas = readFileSync(ruta, "utf8").split(SALTO);
  const salida = new Map();

  for (let i = 0; i < lineas.length; i++) {
    if (!/^\s*Introducci[oó]n\s*$/i.test(lineas[i])) continue;

    let destino = null;
    let fin = lineas.length;
    for (let j = i + 1; j < lineas.length; j++) {
      const m = lineas[j].match(/^\s*LECCI[OÓ]N\s+(\d+)\s*$/);
      if (m) {
        destino = Number(m[1]);
        fin = j;
        break;
      }
    }
    if (destino === null) continue;
    salida.set(destino, lineas.slice(i + 1, fin).join(SALTO).trim());
  }

  return salida;
}

/**
 * Deja el texto del PDF legible en pantalla.
 *
 * El PDF viene maquetado para imprimir: sangrías enormes para centrar versos,
 * cortes de línea a mitad de frase y espacios finos invisibles. Nada de eso
 * significa nada, es cómo estaba en la página.
 *
 * Lo que SÍ se conserva, y es lo importante: la numeración de párrafos ("1.",
 * "2.") y la de frases dentro del párrafo ("2 ", "3 "). Son del Curso, la gente
 * cita con ellas, y quitarlas sería mutilar el texto.
 */
export function limpiarTexto(crudo) {
  const parrafos = [];
  let actual = [];

  const cerrar = () => {
    if (actual.length) {
      parrafos.push(actual.join(" "));
      actual = [];
    }
  };

  for (const linea of String(crudo).split(SALTO)) {
    // Espacios raros del PDF: duro, fino y fino sin corte.
    const t = linea.replace(/[   ]/g, " ").trimEnd();

    if (t.trim() === "") {
      cerrar();
      continue;
    }
    // Un párrafo nuevo empieza con "N. ". Lo anterior se cierra.
    if (/^\s*\d+\.\s/.test(t)) cerrar();
    actual.push(t.trim());
  }
  cerrar();

  return parrafos
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

/**
 * La Introducción de las LECCIONES FINALES.
 *
 * Va aparte de `leerIntroducciones` porque a esta no le sigue una "LECCIÓN N"
 * sino el encabezado "LECCIONES 361-365", así que aquella no la encuentra.
 * En la app vive dentro de la 361, que es donde la gente llega.
 */
export function leerIntroFinal(ruta) {
  const lineas = readFileSync(ruta, "utf8").split(SALTO);
  const iFinales = lineas.findIndex((l) => /^\s*LECCIONES FINALES\s*$/.test(l));
  if (iFinales < 0) return "";
  const iIntro = lineas.findIndex((l, k) => k > iFinales && /^\s*Introducci[oó]n\s*$/i.test(l));
  if (iIntro < 0) return "";
  let fin = lineas.findIndex((l, k) => k > iIntro && /^\s*LECCIONES\s+361-365\s*$/.test(l));
  if (fin < 0) fin = lineas.length;
  return lineas.slice(iIntro + 1, fin).join(SALTO).trim();
}
