/**
 * TRAER EL TEXTO DEL LIBRO a las 365 lecciones.
 *
 * POR QUÉ EXISTE. Hasta ahora el texto venía del blog
 * (aprendiendouncursodemilagros.blogspot.com), que es OTRA traducción al
 * español del mismo Curso. Se parecen mucho —la idea es la misma— pero no son
 * el mismo texto: la lección 1 decía "no significa nada" donde el libro dice
 * "no tiene significado". Esto pone el texto del libro.
 *
 * QUÉ RESPETA, que es lo importante:
 *
 *  · Los títulos de relleno del libro NO se copian. En las tandas de repaso el
 *    libro titula "El repaso de hoy abarca las siguientes ideas:", que no le
 *    dice nada a nadie; la app tiene "Primer Repaso" y eso se queda. La regla:
 *    si el título del libro acaba en ":", se conserva el de la app.
 *
 *  · Las Introducciones de cada tanda de repaso siguen dentro de la primera
 *    lección de la tanda (51, 81, 111, 141, 171, 201). El libro las imprime
 *    aparte, pero quien abre la 51 necesita leerlas ahí.
 *
 *  · `sourceUrl` NO se toca. Apunta al blog, sí, pero de ahí salió la guía de
 *    Lumi y además el escenario de Make lo usa cada día para el enlace que
 *    manda al grupo. Borrarlo rompería eso.
 *
 *  · El comentario, el video y el resto del archivo quedan intactos.
 *
 * Uso:
 *    node scripts/importar-libro.mjs <curso.txt>              (solo enseña)
 *    node scripts/importar-libro.mjs <curso.txt> --aplicar    (escribe)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { leerLibro, leerIntroducciones, leerIntroFinal, limpiarTexto } from "./lib-libro.mjs";

const CARPETA = "public/lessons";
const COPIAS = "copias-antes-del-libro";
const TOTAL = 365;

const ruta = process.argv[2];
const aplicar = process.argv.includes("--aplicar");
if (!ruta) {
  console.error("Falta la ruta del texto extraído del PDF.");
  process.exit(1);
}

const libro = leerLibro(ruta);
const intros = leerIntroducciones(ruta);
const introFinal = leerIntroFinal(ruta);

/**
 * Las que hoy llevan una Introducción dentro; se les vuelve a poner.
 *
 * La 221 abre la SEGUNDA PARTE y su introducción son 8.400 caracteres: sin
 * ella la lección pasaría de 9.289 a 763 y parecería que se perdió casi todo.
 */
const CON_INTRO = [51, 81, 111, 141, 171, 201, 221];

/**
 * Encabezados del comentario, en mayúsculas y con dos puntos.
 *
 * Si aparecen dentro de `originalText` es que al copiar del blog se coló su
 * comentario dentro del texto del Curso. Pasa en la 291: tiene 3.994
 * caracteres de los que 3.200 son comentario. En esos casos el texto del libro
 * es MÁS CORTO y aun así es el bueno, así que el control de "no lo acortes
 * tanto" tiene que apartarse.
 */
const ENCABEZADO_DE_COMENTARIO =
  /^[ \t]*(SENTIDO GENERAL|PROP[ÓO]SITO|ASPECTOS [A-ZÁÉÍÓÚ]+|REFLEXI[ÓO]N FINAL|EJEMPLO|APLICACI[ÓO]N|GLOSARIO|RELACI[ÓO]N CON)[^\r\n]*:[ \t]*$/m;

const cambios = [];
const avisos = [];

for (let n = 1; n <= TOTAL; n++) {
  const archivo = join(CARPETA, `${String(n).padStart(3, "0")}.json`);
  const app = JSON.parse(readFileSync(archivo, "utf8"));
  const delLibro = libro.get(n);

  if (!delLibro) {
    avisos.push(`lección ${n}: no está en el libro, se deja como estaba`);
    continue;
  }

  let texto = limpiarTexto(delLibro.texto);

  if (CON_INTRO.includes(n)) {
    const intro = limpiarTexto(intros.get(n) ?? "");
    if (intro) texto = `## Introducción\n\n${intro}\n\n## La lección de hoy\n\n${texto}`;
    else avisos.push(`lección ${n}: se esperaba una Introducción y no apareció`);
  }

  // La 361 abre las LECCIONES FINALES y arrastra su introducción, igual que la
  // 221 con la SEGUNDA PARTE. Sin ella pasaría de 3.977 caracteres a 339.
  if (n === 361) {
    const fin = limpiarTexto(introFinal);
    if (fin) texto = `## Lecciones finales\n\n${fin}\n\n## La oración de estos días\n\n${texto}`;
    else avisos.push("lección 361: no apareció la Introducción de las lecciones finales");
  }

  // Un texto mucho más corto que el que había es señal de que algo se cortó
  // mal... salvo que lo que había estuviera contaminado con el comentario,
  // porque entonces lo corto es justamente lo limpio.
  const antes = String(app.originalText ?? "").trim();
  const veniaSucia = ENCABEZADO_DE_COMENTARIO.test(antes);
  if (veniaSucia) avisos.push(`lección ${n}: tenía comentario dentro del texto del Curso; se limpia`);
  if (!veniaSucia && texto.length < antes.length * 0.5) {
    avisos.push(
      `lección ${n}: el libro da ${texto.length} caracteres y la app tenía ${antes.length}. NO se toca.`,
    );
    continue;
  }
  if (texto.length < 60) {
    avisos.push(`lección ${n}: solo ${texto.length} caracteres del libro. NO se toca.`);
    continue;
  }

  // Título: el del libro, salvo que sea relleno (acaba en ":").
  const tituloLibro = delLibro.titulo.trim();
  const titulo = !tituloLibro || tituloLibro.endsWith(":") ? String(app.title ?? "") : tituloLibro;

  cambios.push({ n, archivo, app, titulo, texto, antes });
}

// ───────────────────────────────────────────────────────────────── el informe
const raya = "─".repeat(70);
console.log(raya);
console.log(`  TRAER EL TEXTO DEL LIBRO   ${aplicar ? "(ESCRIBIENDO)" : "(solo mirando)"}`);
console.log(raya);
console.log(`  lecciones a actualizar : ${cambios.length} de ${TOTAL}`);
console.log(`  títulos que cambian    : ${cambios.filter((c) => c.titulo !== (c.app.title ?? "")).length}`);
console.log(`  títulos que se respetan: ${cambios.filter((c) => c.titulo === (c.app.title ?? "")).length}`);
if (avisos.length) {
  console.log("");
  console.log(`  AVISOS (${avisos.length}):`);
  for (const a of avisos) console.log(`   · ${a}`);
}
console.log(raya);

if (!aplicar) {
  console.log("  Nada escrito. Repite con --aplicar para que se guarde.");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────── a guardarlo
if (!existsSync(COPIAS)) mkdirSync(COPIAS, { recursive: true });

const ahora = Date.now();
for (const c of cambios) {
  // Copia de lo que había, por si hay que volver atrás sin depender de git.
  writeFileSync(
    join(COPIAS, `${String(c.n).padStart(3, "0")}.json`),
    JSON.stringify({ title: c.app.title, originalText: c.antes }, null, 2) + "\n",
    "utf8",
  );

  const nuevo = {
    ...c.app,
    title: c.titulo,
    originalText: c.texto,
    originalTextLoaded: true,
    // De dónde salió este texto. Antes no se decía en ninguna parte y por eso
    // se pudo creer durante semanas que era el del libro cuando era el del blog.
    textoFuente: "libro-de-ejercicios-pdf",
    updatedAt: ahora,
  };
  writeFileSync(c.archivo, JSON.stringify(nuevo, null, 2) + "\n", "utf8");
}

console.log(`  Guardadas ${cambios.length} lecciones.`);
console.log(`  Copias de lo anterior en ${COPIAS}/`);
