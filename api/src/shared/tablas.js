"use strict";

/**
 * Acceso a los datos (Azure Table Storage), y el ESQUEMA en un solo sitio.
 *
 * Cómo se organiza: cada fila vive en una "partición". Buscar dentro de una
 * partición es instantáneo y barato; recorrer toda la tabla es lento. Por eso
 * la partición se eligió según cómo pregunta la app:
 *
 *   users      → partición fija "u",     fila = uid
 *   progress   → partición = ciclo|uid,  fila = número de lección ("001")
 *   dailyDone  → partición = ciclo|L42,  fila = uid      (para el puesto del día)
 *   forumPosts → partición = lección,    fila = id del mensaje
 *   lessons    → partición fija "l",     fila = "001"
 *   directorio → partición fija "d",     fila = uid
 *
 * Así "el avance de Ana" o "el foro de la lección 42" son una sola consulta
 * directa. Solo el panel de admin recorre tablas enteras, y lo hace de vez en
 * cuando y con pocos miles de filas.
 */

const { TableClient, odata } = require("@azure/data-tables");

const CONEXION = process.env.TABLES_CONNECTION_STRING || "";
const CICLO_POR_DEFECTO = "2026";

const clientes = new Map();

function tabla(nombre) {
  if (!CONEXION) throw new Error("Falta TABLES_CONNECTION_STRING");
  let c = clientes.get(nombre);
  if (!c) {
    c = TableClient.fromConnectionString(CONEXION, nombre, { allowInsecureConnection: false });
    clientes.set(nombre, c);
  }
  return c;
}

/**
 * Deja un texto apto para ser clave de particion o de fila.
 * Azure prohibe /, \, # y ? y los caracteres de control; se cambian por "_".
 */
function clave(texto) {
  let salida = "";
  for (const ch of String(texto ?? "")) {
    const c = ch.codePointAt(0);
    const prohibido =
      c < 32 || (c >= 127 && c <= 159) || ch === "/" || ch === "\\" || ch === "#" || ch === "?";
    salida += prohibido ? "_" : ch;
  }
  return salida;
}

/** Número de lección como "001" (para que ordene bien alfabéticamente). */
function nLeccion(n) {
  return String(Math.max(1, Math.min(365, Number(n) || 1))).padStart(3, "0");
}

// ---------------------------------------------------------------- particiones
const P = {
  users: () => "u",
  progress: (ciclo, uid) => `${clave(ciclo)}|${clave(uid)}`,
  dailyDone: (ciclo, n) => `${clave(ciclo)}|L${nLeccion(n)}`,
  forum: (n) => `L${nLeccion(n)}`,
  lessons: () => "l",
  directorio: () => "d",
  recordatorios: () => "r",
  config: () => "cfg",
  cohorts: () => "c",
};

// ------------------------------------------------------------------ lectura
async function leerUno(nombreTabla, particion, fila) {
  try {
    const e = await tabla(nombreTabla).getEntity(clave(particion), clave(fila));
    return limpiar(e);
  } catch (err) {
    if (err && (err.statusCode === 404 || err.code === "ResourceNotFound")) return null;
    throw err;
  }
}

/** Todas las filas de una partición (consulta directa, barata). */
async function leerParticion(nombreTabla, particion) {
  const salida = [];
  const it = tabla(nombreTabla).listEntities({
    queryOptions: { filter: odata`PartitionKey eq ${clave(particion)}` },
  });
  for await (const e of it) salida.push(limpiar(e));
  return salida;
}

/** Recorre la tabla entera. Solo para el panel de admin: es lo más caro. */
async function leerTodo(nombreTabla, filtro) {
  const salida = [];
  const it = tabla(nombreTabla).listEntities(
    filtro ? { queryOptions: { filter: filtro } } : undefined,
  );
  for await (const e of it) salida.push(limpiar(e));
  return salida;
}

async function contarParticion(nombreTabla, particion) {
  let n = 0;
  const it = tabla(nombreTabla).listEntities({
    queryOptions: { filter: odata`PartitionKey eq ${clave(particion)}`, select: ["RowKey"] },
  });
  for await (const _ of it) n++;
  return n;
}

// ----------------------------------------------------------------- escritura
/** Crea o actualiza mezclando: los campos que no mandas se quedan como estaban. */
async function guardar(nombreTabla, particion, fila, datos) {
  const entidad = {
    partitionKey: clave(particion),
    rowKey: clave(fila),
    ...aplanar(datos),
  };
  await tabla(nombreTabla).upsertEntity(entidad, "Merge");
  return entidad;
}

/** Reemplaza la fila entera. */
async function reemplazar(nombreTabla, particion, fila, datos) {
  await tabla(nombreTabla).upsertEntity(
    { partitionKey: clave(particion), rowKey: clave(fila), ...aplanar(datos) },
    "Replace",
  );
}

/**
 * Guarda muchas filas de UNA MISMA partición de golpe (hasta 100 por tanda).
 * Lo usa el registro cuando alguien entra diciendo "voy en la lección 60" y hay
 * que dar por hechas las 59 anteriores: de una en una serían 59 viajes.
 */
async function guardarLote(nombreTabla, particion, filas) {
  const cliente = tabla(nombreTabla);
  const pk = clave(particion);
  for (let i = 0; i < filas.length; i += 100) {
    const tanda = filas.slice(i, i + 100).map((f) => [
      "upsert",
      { partitionKey: pk, rowKey: clave(f.fila), ...aplanar(f.datos) },
      "Merge",
    ]);
    if (tanda.length) await cliente.submitTransaction(tanda);
  }
}

async function borrar(nombreTabla, particion, fila) {
  try {
    await tabla(nombreTabla).deleteEntity(clave(particion), clave(fila));
  } catch (err) {
    if (!err || (err.statusCode !== 404 && err.code !== "ResourceNotFound")) throw err;
  }
}

// ------------------------------------------------------- traducción de datos
/**
 * Table Storage solo guarda textos, números, booleanos y fechas. Los objetos y
 * listas (por ejemplo el comentario de una lección) se guardan como texto JSON
 * con la marca `__json_` delante, y al leer se reconstruyen solos.
 */
function aplanar(datos) {
  const fuera = {};
  for (const [k, v] of Object.entries(datos || {})) {
    if (v === undefined) continue;
    if (v === null) {
      fuera[k] = null;
    } else if (typeof v === "object") {
      fuera[`__json_${k}`] = JSON.stringify(v);
    } else {
      fuera[k] = v;
    }
  }
  return fuera;
}

function limpiar(entidad) {
  const fuera = {};
  for (const [k, v] of Object.entries(entidad)) {
    if (k === "etag" || k === "timestamp" || k === "odata.metadata") continue;
    if (k.startsWith("__json_")) {
      try {
        fuera[k.slice(7)] = JSON.parse(v);
      } catch {
        fuera[k.slice(7)] = null;
      }
    } else if (k === "partitionKey") {
      fuera._particion = v;
    } else if (k === "rowKey") {
      fuera._fila = v;
    } else {
      fuera[k] = v;
    }
  }
  return fuera;
}

module.exports = {
  P,
  CICLO_POR_DEFECTO,
  nLeccion,
  clave,
  leerUno,
  leerParticion,
  leerTodo,
  contarParticion,
  guardar,
  guardarLote,
  reemplazar,
  borrar,
  odata,
};
