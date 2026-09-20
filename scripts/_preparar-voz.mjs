import { readFileSync, writeFileSync } from "node:fs";

/**
 * Texto de una lección listo para LEER EN VOZ ALTA.
 *
 * Tres cuidados, y el tercero es el que más se nota al escuchar:
 *
 *  1. Fuera la numeración del Curso ("1.", "2 "). En papel sirve para citar; leída
 *     en voz alta es "uno punto dos tres" y rompe la frase.
 *  2. Nada de mayúsculas sostenidas: el motor las deletrea o las grita.
 *  3. SE CONSERVAN LOS SALTOS DE PÁRRAFO. El generador viejo lo aplastaba todo a
 *     una línea, y por eso sonaba de corrido, sin respirar. ElevenLabs respeta el
 *     párrafo como pausa: es lo que da el ritmo de meditación que se busca aquí.
 */
function paraVoz(l) {
  let t = String(l.originalText || "");
  t = t.replace(/^[ 	]*##[ 	]*/gm, "");     // encabezados de sección
  /*
   * OJO con el espacio al principio: tiene que ser [ 	], NO \s.
   * `\s` incluye el salto de línea, así que `^\s*\d+\.` se comía también la
   * línea en blanco de antes y pegaba dos párrafos en uno. Justo lo contrario
   * de lo que se busca: el párrafo es la pausa que da el ritmo.
   */
  t = t.replace(/^[ 	]*\d+\.[ 	]*/gm, "");  // "1. " al empezar párrafo
  // Los corchetes del libro marcan alternativas para decir; en ElevenLabs los
  // corchetes son acotaciones de dirección, así que se pasan a paréntesis.
  t = t.replace(/\[/g, "(").replace(/\]/g, ")");

  /*
   * LOS ESPACIOS EN BLANCO DEL CURSO → UNA PAUSA.
   *
   * Las lecciones 4 y 5 traen huecos para que cada quien los rellene con lo
   * suyo: "Este pensamiento acerca de _____ no significa nada". Mandados tal
   * cual, la voz intenta pronunciarlos y suelta un ruido inventado: en la
   * primera prueba la lección 4 dijo "acerca de uaskeanon no significa nada".
   *
   * Una pausa es lo que el libro pide de verdad: el hueco es para que quien
   * escucha lo llene en silencio con su propio pensamiento.
   */
  t = t.replace(/_{2,}/g, '<break time="0.7s" />');
  t = t.replace(/([\s"“(¿¡])\d{1,2}\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“])/g, "$1"); // "2 Esa mesa"
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  // El título pasa por lo mismo: también trae corchetes del libro, y se añadía
  // al final sin limpiar, así que se colaban tal cual en la locución.
  const titulo = l.title ? `${String(l.title).replace(/\[/g, "(").replace(/\]/g, ")")}\n\n` : "";
  return `Lección ${l.number}.\n\n${titulo}${t}`;
}

let total = 0;
const DESDE = Number(process.argv[2] || 1);
const HASTA = Number(process.argv[3] || 5);
for (let n = DESDE; n <= HASTA; n++) {
  const l = JSON.parse(readFileSync(`public/lessons/${String(n).padStart(3,"0")}.json`, "utf8"));
  const t = paraVoz(l);
  writeFileSync(`audio-nuevo/${String(n).padStart(3,"0")}.txt`, t, "utf8");
  total += t.length;
  if (process.env.SILENCIO !== "1") console.log(`  ${n}: ${String(t.length).padStart(5)} caracteres`);
}
console.log(`  ─────────────────────`);
console.log(`  total: ${total} caracteres  ≈ ${Math.round(total*0.605)} créditos  ≈ ${(total/753).toFixed(1)} min de audio`);
