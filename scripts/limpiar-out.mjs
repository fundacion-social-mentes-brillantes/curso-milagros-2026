/**
 * Quita del sitio compilado los archivos pesados que YA se sirven desde Azure
 * Blob Storage (los audios narrados y las imágenes de cada lección).
 *
 * Por qué hace falta: Next copia la carpeta `public/` entera dentro de `out/`,
 * y Azure Static Web Apps no admite sitios de más de 250 MB. Con los audios
 * dentro, `out/` pesa unos 660 MB y el despliegue se rechaza.
 *
 * Los originales NO se tocan: siguen en `public/`, en el repositorio, como
 * fuente de la que se subieron a Azure. Esto solo limpia la copia compilada.
 */

import { rm, stat, readdir } from "node:fs/promises";
import { join } from "node:path";

const SALIDA = "out";

/** Carpetas que ya viven en Blob Storage y sobran dentro del sitio. */
const SOBRAN = ["audio", join("images", "lecciones")];

async function pesar(ruta) {
  let total = 0;
  let archivos = 0;
  try {
    for (const entrada of await readdir(ruta, { withFileTypes: true })) {
      const hijo = join(ruta, entrada.name);
      if (entrada.isDirectory()) {
        const r = await pesar(hijo);
        total += r.total;
        archivos += r.archivos;
      } else {
        total += (await stat(hijo)).size;
        archivos++;
      }
    }
  } catch {
    /* no existe: nada que pesar */
  }
  return { total, archivos };
}

const mb = (b) => (b / 1024 / 1024).toFixed(1).padStart(7);

let quitado = 0;
for (const carpeta of SOBRAN) {
  const ruta = join(SALIDA, carpeta);
  const { total, archivos } = await pesar(ruta);
  if (archivos === 0) {
    console.log(`  ${carpeta}: no estaba`);
    continue;
  }
  await rm(ruta, { recursive: true, force: true });
  quitado += total;
  console.log(`  quitado ${mb(total)} MB  (${archivos} archivos)  ${carpeta}`);
}

const final = await pesar(SALIDA);
console.log(`  ----------------------------------------------`);
console.log(`  liberado ${mb(quitado)} MB`);
console.log(`  el sitio pesa ${mb(final.total)} MB   (Azure admite hasta 250 MB)`);

if (final.total > 250 * 1024 * 1024) {
  console.error("\n  AVISO: el sitio sigue pasándose del límite de Azure.");
  process.exit(1);
}
