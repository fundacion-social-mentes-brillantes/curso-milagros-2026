/**
 * Antes de compilar: que haya UNA sola copia de Firebase (@firebase/app y
 * @firebase/component) en node_modules.
 *
 * Por qué existe: el 17-oct-2026 se publicó una versión con dos copias (una la
 * traía firebase-admin, otra el paquete firebase). El login dejó de funcionar
 * en vivo con «Component auth has not been registered yet» y hubo que volver
 * atrás. Compilar NO avisa de esto: la web se arma bien y falla en el celular.
 * Si hay dos copias, aquí se detiene la compilación y no se publica nada.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const VIGILADOS = ["app", "component"];
const encontrados = Object.fromEntries(VIGILADOS.map((n) => [n, new Set()]));

function recorrer(carpeta) {
  if (!existsSync(carpeta)) return;
  for (const nombre of readdirSync(carpeta)) {
    if (nombre === ".bin" || nombre === ".cache") continue;
    const ruta = join(carpeta, nombre);
    if (nombre === "@firebase") {
      for (const n of VIGILADOS) {
        const pj = join(ruta, n, "package.json");
        if (existsSync(pj)) encontrados[n].add(JSON.parse(readFileSync(pj, "utf8")).version);
      }
    }
    if (nombre.startsWith("@")) {
      for (const sub of readdirSync(ruta)) recorrer(join(ruta, sub, "node_modules"));
    } else {
      recorrer(join(ruta, "node_modules"));
    }
  }
}

recorrer("node_modules");

let mal = false;
for (const n of VIGILADOS) {
  const versiones = [...encontrados[n]];
  if (versiones.length > 1) {
    console.error(`✗ Hay ${versiones.length} copias de @firebase/${n}: ${versiones.join(", ")}. El login fallaría en vivo.`);
    mal = true;
  }
}
if (mal) {
  console.error("  Revisa qué paquete trae la otra copia: npm ls @firebase/app");
  process.exit(1);
}
console.log(`✓ Firebase en una sola copia (app ${[...encontrados.app].join("")}, component ${[...encontrados.component].join("")})`);
