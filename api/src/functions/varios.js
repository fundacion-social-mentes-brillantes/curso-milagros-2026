"use strict";

/**
 * Rutas de DIRECTORIO y de CONFIGURACIÓN del curso.
 *
 *   GET /api/directorio   nombres de los compañeros   (sesión)
 *   GET /api/config       el ciclo que se está corriendo (público)
 *   PUT /api/config       arrancar un ciclo nuevo       (admin)
 *
 * El directorio guarda SOLO el nombre para mostrar: ni correo ni teléfono. Así
 * quien sostiene el proceso puede ver con quiénes está caminando (en el ranking
 * aparecen nombres, no identificadores) sin que los datos de contacto de nadie
 * salgan nunca del panel de admin.
 *
 * El "ciclo" es el año que se está corriendo: "2026", "2027"… Existe para poder
 * empezar de cero cada año SIN borrar decenas de miles de registros: cada
 * avance queda marcado con su ciclo, y arrancar un año nuevo es cambiar una
 * sola palabra en vez de vaciar la base entera.
 */

const { app } = require("@azure/functions");
const { json, malaPeticion, manejar, cuerpoJson } = require("../shared/http");
const { P, CICLO_POR_DEFECTO, leerUno, leerParticion, guardar } = require("../shared/tablas");

/**
 * Dónde vive el ciclo.
 *
 * Vive en su propia tabla `config`. Es un solo dato, pero de él depende en qué
 * cajón se guarda el avance de todo el mundo, así que conviene que esté
 * separado y sea fácil de mirar.
 */
const TABLA_CONFIG = "config";
const PARTICION_CONFIG = P.config();
const FILA_CONFIG = "curso";

/**
 * Deja el nombre del ciclo seguro para usarlo dentro de una clave: solo letras,
 * números y guiones. Un "/" o un "|" partirían la partición donde se guarda el
 * avance y lo dejarían en un sitio equivocado, imposible de encontrar después.
 */
function limpiarCiclo(texto) {
  const limpio = String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // fuera tildes: "2026ñ" no es un año
    .replace(/[^A-Za-z0-9-]/g, "")
    .slice(0, 20);
  return limpio || String(new Date().getFullYear());
}

// ---------------------------------------------------------- GET /directorio
app.http("directorioLeer", {
  route: "directorio",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: manejar("sesion", async () => {
    const filas = await leerParticion("directorio", P.directorio());

    const directorio = {};
    for (const f of filas) {
      const nombre = String(f.nombre ?? "").trim();
      // Sin nombre no aporta nada: mejor no devolver la fila que devolverla vacía.
      if (nombre) directorio[f._fila] = nombre;
    }

    return json(directorio);
  }),
});

// -------------------------------------------------------------- GET /config
app.http("configLeer", {
  route: "config",
  methods: ["GET"],
  authLevel: "anonymous",
  /*
   * Es la única ruta PÚBLICA de lectura, a propósito: el navegador necesita
   * saber en qué ciclo está ANTES de entrar, para pedir el avance del año
   * correcto. Y lo que devuelve es una etiqueta ("2026"), no un dato de nadie.
   */
  handler: manejar("publico", async () => {
    try {
      const fila = await leerUno(TABLA_CONFIG, PARTICION_CONFIG, FILA_CONFIG);
      const ciclo = String(fila?.ciclo ?? "").trim();
      return json({ ciclo: ciclo || CICLO_POR_DEFECTO });
    } catch {
      // Si el almacén no responde, la app debe seguir funcionando con el ciclo
      // de siempre en vez de quedarse en blanco sin poder entrar.
      return json({ ciclo: CICLO_POR_DEFECTO });
    }
  }),
});

// -------------------------------------------------------------- PUT /config
app.http("configGuardar", {
  route: "config",
  methods: ["PUT"],
  authLevel: "anonymous",
  /*
   * Cambiar el ciclo reinicia el proceso de TODO el grupo: el avance del año
   * anterior queda guardado como historia y todo el mundo vuelve a empezar. Por
   * eso escribir aquí es solo del admin, aunque leer sea público.
   */
  handler: manejar("admin", async (req) => {
    const body = await cuerpoJson(req);

    const pedido = String(body.ciclo ?? "").trim();
    if (!pedido) return malaPeticion("falta el ciclo");

    const ciclo = limpiarCiclo(pedido);

    await guardar(TABLA_CONFIG, PARTICION_CONFIG, FILA_CONFIG, {
      ciclo,
      cambiadoEn: Date.now(), // para saber cuándo se arrancó el año nuevo
    });

    return json({ ciclo });
  }),
});
