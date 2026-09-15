/**
 * MUDANZA DE LOS DATOS: de Firestore (Firebase) a Azure Table Storage.
 *
 * Qué hace: copia lo que hay en la base vieja a la nueva. NO borra nada en
 * Firebase. Se puede correr las veces que haga falta: cada fila se guarda con
 * "upsert" (si ya está, se actualiza; no se duplica).
 *
 * CÓMO SE USA
 * -----------
 *   node scripts/migrar-a-azure.mjs                 ← SIMULACRO (no escribe nada)
 *   node scripts/migrar-a-azure.mjs --escribir      ← copia de verdad
 *   node scripts/migrar-a-azure.mjs --solo users,lessons
 *   node scripts/migrar-a-azure.mjs --limite 5      ← solo 5 documentos por colección
 *   node scripts/migrar-a-azure.mjs --detalle       ← enseña más ejemplos
 *   node scripts/migrar-a-azure.mjs --con-nombres   ← copia también los nombres
 *                                                     propios viejos del ranking
 *
 * El simulacro es lo que pasa por defecto, a propósito: escribir tiene que
 * costar una decisión consciente. Sin `--escribir` este programa no toca Azure.
 *
 * DE DÓNDE SACA LOS PERMISOS
 * --------------------------
 * Para LEER Firebase usa el permiso que ya tiene la cuenta de servicio
 * `clara-agente`, pidiéndole a `gcloud` un pase temporal. No hay ninguna clave
 * guardada en el proyecto ni hay que iniciar sesión a mano.
 *
 * Para ESCRIBIR en Azure usa la variable de entorno TABLES_CONNECTION_STRING
 * (la misma que usa la API). Solo hace falta si se pasa `--escribir`.
 *
 * AL FINAL siempre imprime un recuento: cuántos documentos leyó de Firebase,
 * cuántas filas preparó, cuántas escribió y cuántas quedaron fuera (y por qué).
 * Ese recuento es el que permite auditar que no se perdió nada por el camino.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ─────────────────────────────────────────────── variables de entorno
/**
 * Rellena TABLES_CONNECTION_STRING desde los archivos de configuración del
 * proyecto si no viene ya puesta en la terminal. Es solo una comodidad: así
 * quien corre el script no tiene que exportar la cadena a mano cada vez.
 */
function cargarEntorno() {
  if (process.env.TABLES_CONNECTION_STRING) return;

  // 1) El .env.local de siempre (Next.js).
  const env = path.join(RAIZ, ".env.local");
  if (fs.existsSync(env)) {
    for (const linea of fs.readFileSync(env, "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const valor = m[2].replace(/^["']|["']$/g, "");
      if (!(m[1] in process.env)) process.env[m[1]] = valor;
    }
  }

  // 2) La configuración local de Azure Functions, si existe.
  const local = path.join(RAIZ, "api", "local.settings.json");
  if (!process.env.TABLES_CONNECTION_STRING && fs.existsSync(local)) {
    try {
      const j = JSON.parse(fs.readFileSync(local, "utf8"));
      const v = j?.Values?.TABLES_CONNECTION_STRING;
      if (v) process.env.TABLES_CONNECTION_STRING = String(v);
    } catch {
      /* si está mal escrito, se sigue sin él: ya avisará al escribir */
    }
  }
}
cargarEntorno();

// El acceso a las tablas se reutiliza TAL CUAL del código de la API. Así la
// mudanza guarda exactamente igual que como guardará la app después (mismas
// particiones, misma forma de aplanar objetos). Si mañana cambia allí, cambia
// aquí solo: no hay dos versiones de la verdad.
const require = createRequire(import.meta.url);
const { P, CICLO_POR_DEFECTO, nLeccion, guardarLote, contarParticion } = require(
  path.join(RAIZ, "api", "src", "shared", "tablas.js"),
);

// ───────────────────────────────────────────────────────── opciones
const args = process.argv.slice(2);
const tieneOpcion = (nombre) => args.includes(nombre);
function valorOpcion(nombre, porDefecto = "") {
  const i = args.indexOf(nombre);
  return i >= 0 && args[i + 1] ? args[i + 1] : porDefecto;
}

const ESCRIBIR = tieneOpcion("--escribir");
const DETALLE = tieneOpcion("--detalle");
// Ver `camposSensibles` más abajo: por defecto NO se copian los nombres propios
// que quedaron guardados en el ranking antes de que se decidiera no guardarlos.
const CON_NOMBRES = tieneOpcion("--con-nombres");
const LIMITE = Number(valorOpcion("--limite", "0")) || 0;
const SOLO = valorOpcion("--solo", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ───────────────────────────────────────────────── origen: Firestore
const CUENTA = "clara-agente@clara-gemb.iam.gserviceaccount.com";
const PROYECTO = "curso-milagros-2026";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents`;

let pase = "";
/**
 * Pide a gcloud un pase temporal de la cuenta de servicio. Dura una hora, por
 * eso se guarda en memoria y se vuelve a pedir si Google contesta "caducado".
 */
function pedirPase(refrescar = false) {
  if (pase && !refrescar) return pase;
  try {
    // Se llama por la terminal del sistema porque en Windows gcloud es un .cmd.
    // La orden es fija (no se arma con nada que venga de fuera), así que no hay
    // forma de colar texto ajeno en ella.
    pase = execSync(`gcloud auth print-access-token --account=${CUENTA}`, {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    throw new Error(
      `No se pudo obtener el pase de Google con gcloud (cuenta ${CUENTA}). ` +
        `Comprueba que gcloud está instalado y que esa cuenta aparece en "gcloud auth list". ` +
        `Detalle: ${e?.message ?? e}`,
    );
  }
  if (!pase) throw new Error("gcloud devolvió un pase vacío");
  return pase;
}

/** Una petición a Firestore, reintentando una vez si el pase ya caducó. */
async function pedirAFirestore(url) {
  for (let intento = 0; intento < 2; intento++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${pedirPase(intento > 0)}` },
    });
    if (res.status === 401 && intento === 0) continue; // pase caducado: se renueva
    if (!res.ok) {
      const detalle = (await res.text()).slice(0, 300);
      throw new Error(`Firestore contestó ${res.status}: ${detalle}`);
    }
    return res.json();
  }
  throw new Error("Firestore rechazó el pase dos veces seguidas");
}

/**
 * Traduce un valor de Firestore a un valor normal de JavaScript.
 *
 * Firestore envía cada dato envuelto diciendo de qué tipo es
 * ({"stringValue": "hola"}). Aquí se desenvuelve. Las fechas se convierten a
 * milisegundos porque así es como las guarda toda la app (Date.now()).
 */
function valorFirestore(v) {
  if (!v || typeof v !== "object") return null;
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return Boolean(v.booleanValue);
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return Date.parse(v.timestampValue) || 0;
  if ("bytesValue" in v) return String(v.bytesValue);
  if ("referenceValue" in v) return String(v.referenceValue);
  if ("geoPointValue" in v) {
    return { lat: Number(v.geoPointValue.latitude ?? 0), lng: Number(v.geoPointValue.longitude ?? 0) };
  }
  if ("mapValue" in v) return camposFirestore(v.mapValue?.fields);
  if ("arrayValue" in v) return (v.arrayValue?.values ?? []).map(valorFirestore);
  return null;
}

function camposFirestore(fields) {
  const salida = {};
  for (const [k, v] of Object.entries(fields || {})) salida[k] = valorFirestore(v);
  return salida;
}

/** Lee una colección entera, de página en página (Firestore no da todo de golpe). */
async function leerColeccion(nombre) {
  const documentos = [];
  let siguiente = "";
  do {
    const url =
      `${BASE}/${encodeURIComponent(nombre)}?pageSize=300` +
      (siguiente ? `&pageToken=${encodeURIComponent(siguiente)}` : "");
    const pagina = await pedirAFirestore(url);
    for (const d of pagina.documents || []) {
      // El "name" viene como la ruta completa; el id es el último trozo.
      const id = String(d.name || "").split("/").pop() || "";
      documentos.push({ id, datos: camposFirestore(d.fields) });
      if (LIMITE && documentos.length >= LIMITE) return documentos;
    }
    siguiente = pagina.nextPageToken || "";
  } while (siguiente);
  return documentos;
}

// ─────────────────────────────────────── de identificador a destino
const texto = (v) => (typeof v === "string" ? v.trim() : "");
const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
};

/**
 * De dónde salen el ciclo, la persona y la lección de un avance.
 *
 * Lo que diga el documento manda; el identificador es solo el respaldo para los
 * registros antiguos que no traen los campos. El identificador es
 * `{uid}_{n}` en el ciclo 2026 y `{ciclo}_{uid}_{n}` a partir del siguiente
 * (así se decidió para no tener que reescribir el avance que la gente ya tenía:
 * ver src/lib/ciclo.ts). El año se reconoce porque son cuatro cifras.
 */
function partesDeAvance(id, datos) {
  let ciclo = texto(datos.ciclo);
  let uid = texto(datos.userId);
  let n = numero(datos.lessonNumber);

  const trozos = String(id).split("_");
  const llevaCiclo = trozos.length >= 3 && /^[0-9]{4}$/.test(trozos[0]);
  if (!ciclo) ciclo = llevaCiclo ? trozos[0] : CICLO_POR_DEFECTO;
  if (!uid) uid = trozos.slice(llevaCiclo ? 1 : 0, -1).join("_");
  if (!n) n = numero(trozos[trozos.length - 1]);
  return { ciclo, uid, n };
}

/**
 * Lo mismo para el ranking del día, donde el identificador va al revés:
 * `{n}_{uid}` en 2026 y `{ciclo}_{n}_{uid}` después.
 */
function partesDeRanking(id, datos) {
  let ciclo = texto(datos.ciclo);
  let uid = texto(datos.uid);
  let n = numero(datos.lessonNumber);

  const trozos = String(id).split("_");
  const llevaCiclo = trozos.length >= 3 && /^[0-9]{4}$/.test(trozos[0]);
  if (!ciclo) ciclo = llevaCiclo ? trozos[0] : CICLO_POR_DEFECTO;
  if (!n) n = numero(trozos[llevaCiclo ? 1 : 0]);
  if (!uid) uid = trozos.slice(llevaCiclo ? 2 : 1).join("_");
  return { ciclo, uid, n };
}

/**
 * Las seis colecciones y a qué tabla, partición y fila va cada una.
 * Las particiones son EXACTAMENTE las del contrato (api/CONTRATO.md).
 *
 * Cada regla devuelve `{particion, fila, datos}` o `{omitir: "motivo"}` cuando
 * el documento no se puede colocar (por ejemplo, un avance sin número de
 * lección). Nada se descarta en silencio: todo lo omitido sale en el recuento.
 */
const COLECCIONES = [
  {
    nombre: "users",
    tabla: "users",
    destino: 'partición "u", fila = uid',
    colocar(id, datos) {
      if (!id) return { omitir: "sin identificador" };
      return { particion: P.users(), fila: id, datos };
    },
  },
  {
    nombre: "progress",
    tabla: "progress",
    destino: 'partición "{ciclo}|{uid}", fila = "001".."365"',
    colocar(id, datos) {
      const { ciclo, uid, n } = partesDeAvance(id, datos);
      if (!uid) return { omitir: "no se pudo saber de quién es" };
      if (!n || n > 365) return { omitir: `número de lección raro (${n || "vacío"})` };
      return {
        particion: P.progress(ciclo, uid),
        fila: nLeccion(n),
        // Se completan los campos que los registros viejos no traían, para que
        // todas las filas se vean iguales a las que escribirá la API nueva.
        datos: { ...datos, userId: uid, ciclo, lessonNumber: n },
      };
    },
  },
  {
    nombre: "dailyDone",
    tabla: "dailyDone",
    destino: 'partición "{ciclo}|L042", fila = uid',
    /**
     * El nombre propio NO se copia (salvo que se pida con `--con-nombres`).
     * Por qué: estos registros son de antes, cuando el puesto guardaba el
     * nombre de la persona. Se quitó a propósito, porque cualquiera con sesión
     * podía leerlo; el nombre para mostrar vive ahora en `directorio`, que solo
     * ven los Portadores de Luz. Copiarlo sería volver atrás en esa decisión.
     * No se pierde nada: sigue en Firebase y en la ficha de cada persona.
     */
    camposSensibles: ["name"],
    colocar(id, datos) {
      // Ranking de la primera época: el identificador era la FECHA, porque el
      // puesto se daba por día. Hoy el puesto es por lección y la tabla nueva
      // se organiza por lección, así que estos registros no tienen dónde ir.
      // No se inventa un número de lección: se dejan fuera y se avisa.
      if (/^\d{4}-\d{2}-\d{2}_/.test(String(id))) {
        return { omitir: "es del ranking viejo por DÍA (no dice a qué lección corresponde)" };
      }
      const { ciclo, uid, n } = partesDeRanking(id, datos);
      if (!uid) return { omitir: "no se pudo saber de quién es" };
      if (!n || n > 365) return { omitir: `número de lección raro (${n || "vacío"})` };
      return {
        particion: P.dailyDone(ciclo, n),
        fila: uid,
        datos: { ...datos, uid, ciclo, lessonNumber: n },
      };
    },
  },
  {
    nombre: "forumPosts",
    tabla: "forumPosts",
    destino: 'partición "L042", fila = id del mensaje',
    colocar(id, datos) {
      const n = numero(datos.lessonNumber);
      if (!id) return { omitir: "sin identificador" };
      if (!n || n > 365) return { omitir: "mensaje sin lección a la que pertenecer" };
      return { particion: P.forum(n), fila: id, datos: { ...datos, lessonNumber: n } };
    },
  },
  {
    nombre: "lessons",
    tabla: "lessons",
    destino: 'partición "l", fila = "042"',
    colocar(id, datos) {
      // El identificador ya viene con ceros ("042"); si faltara, se usa el campo.
      const n = numero(datos.number) || numero(id);
      if (!n || n > 365) return { omitir: `no se pudo saber qué lección es (id "${id}")` };
      return { particion: P.lessons(), fila: nLeccion(n), datos: { ...datos, number: n } };
    },
  },
  {
    nombre: "directorio",
    tabla: "directorio",
    destino: 'partición "d", fila = uid',
    colocar(id, datos) {
      if (!id) return { omitir: "sin identificador" };
      return { particion: P.directorio(), fila: id, datos };
    },
  },
];

// ───────────────────────────────────────── revisiones antes de escribir
/**
 * Nombres que Azure se reserva para sí mismo. Si un documento traía un campo
 * llamado así, se quita (y se avisa): dejarlo pasar haría fallar el guardado.
 */
const RESERVADOS = new Set(["partitionkey", "rowkey", "timestamp", "etag", "odata.metadata"]);

/** Máximo de caracteres que admite un campo de texto en Table Storage. */
const MAX_CARACTERES = 32000;

/**
 * Deja los datos listos: quita lo que Azure no admite y avisa de los textos
 * demasiado largos (que harían fallar toda la tanda de escritura).
 */
function revisarDatos(datos) {
  const limpios = {};
  const avisos = [];
  for (const [campo, valor] of Object.entries(datos || {})) {
    if (RESERVADOS.has(campo.toLowerCase())) {
      avisos.push(`campo reservado quitado: ${campo}`);
      continue;
    }
    if (valor === undefined) continue;
    const largo =
      typeof valor === "string"
        ? valor.length
        : valor && typeof valor === "object"
          ? JSON.stringify(valor).length
          : 0;
    if (largo > MAX_CARACTERES) {
      avisos.push(`campo demasiado largo: ${campo} (${largo} caracteres)`);
    }
    limpios[campo] = valor;
  }
  return { limpios, avisos };
}

/**
 * Parte una lista de filas en tandas que Azure acepte de una sola vez:
 * como mucho 100 filas y sin pasarse de peso (el límite real es 4 MB, se deja
 * la mitad de margen para no jugársela con las lecciones, que son largas).
 */
function enTandas(filas, maxFilas = 100, maxCaracteres = 1500000) {
  const salida = [];
  let actual = [];
  let peso = 0;
  for (const f of filas) {
    const suyo = JSON.stringify(f.datos).length;
    if (actual.length && (actual.length >= maxFilas || peso + suyo > maxCaracteres)) {
      salida.push(actual);
      actual = [];
      peso = 0;
    }
    actual.push(f);
    peso += suyo;
  }
  if (actual.length) salida.push(actual);
  return salida;
}

// ────────────────────────────────────────────────────────── el trabajo
async function migrarColeccion(regla) {
  const informe = {
    nombre: regla.nombre,
    tabla: regla.tabla,
    leidos: 0,
    preparadas: 0,
    escritas: 0,
    omitidas: [],
    avisos: [],
    fallos: [],
    sensibles: 0,
    particiones: new Set(),
  };

  process.stdout.write(`\n▸ ${regla.nombre}  →  tabla ${regla.tabla} (${regla.destino})\n`);

  const documentos = await leerColeccion(regla.nombre);
  informe.leidos = documentos.length;

  // Se agrupan por partición porque Azure solo escribe de golpe filas que
  // vivan en la misma partición. Y de paso permite detectar duplicados.
  const porParticion = new Map();
  const vistas = new Set();

  for (const doc of documentos) {
    const sitio = regla.colocar(doc.id, doc.datos);
    if (sitio.omitir) {
      informe.omitidas.push(`${doc.id}: ${sitio.omitir}`);
      continue;
    }
    const { limpios, avisos } = revisarDatos(sitio.datos);
    for (const a of avisos) informe.avisos.push(`${doc.id}: ${a}`);

    // Datos personales que el proyecto decidió dejar de guardar (ver la regla).
    if (regla.camposSensibles && !CON_NOMBRES) {
      for (const campo of regla.camposSensibles) {
        if (campo in limpios) {
          delete limpios[campo];
          informe.sensibles++;
        }
      }
    }

    const llave = `${sitio.particion} ${sitio.fila}`;
    if (vistas.has(llave)) {
      // Dos documentos de origen que caerían en la misma fila: el segundo
      // pisaría al primero. Hay que verlo, no taparlo.
      informe.avisos.push(`${doc.id}: cae en una fila ya ocupada (${sitio.particion} / ${sitio.fila})`);
    }
    vistas.add(llave);

    if (!porParticion.has(sitio.particion)) porParticion.set(sitio.particion, []);
    porParticion.get(sitio.particion).push({ fila: sitio.fila, datos: limpios });
    informe.particiones.add(sitio.particion);
    informe.preparadas++;
  }

  // Ejemplos, para poder mirar con los ojos que la cuenta cuadra.
  const cuantos = DETALLE ? 10 : 3;
  let mostrados = 0;
  for (const [particion, filas] of porParticion) {
    for (const f of filas) {
      if (mostrados >= cuantos) break;
      const campos = Object.keys(f.datos).slice(0, 8).join(", ");
      console.log(`   ejemplo → partición "${particion}"  fila "${f.fila}"  campos: ${campos}`);
      mostrados++;
    }
    if (mostrados >= cuantos) break;
  }
  if (informe.preparadas > mostrados) {
    console.log(`   … y ${informe.preparadas - mostrados} filas más`);
  }

  if (!ESCRIBIR) {
    console.log(`   (simulacro: no se escribió nada)`);
    return informe;
  }

  for (const [particion, filas] of porParticion) {
    for (const tanda of enTandas(filas)) {
      try {
        await guardarLote(regla.tabla, particion, tanda);
        informe.escritas += tanda.length;
      } catch (e) {
        // Una tanda que falla no detiene la mudanza: se anota y se sigue, para
        // que un solo registro raro no deje todo a medias.
        informe.fallos.push(`partición "${particion}" (${tanda.length} filas): ${e?.message ?? e}`);
      }
    }
  }
  console.log(`   escritas ${informe.escritas} de ${informe.preparadas} filas`);
  return informe;
}

/**
 * Cuenta lo que hay AHORA en el destino, partición por partición. Es la prueba
 * de verdad de que la mudanza llegó: no se cree lo que dijo la escritura, va y
 * lo mira. Puede incluir filas que ya estuvieran de antes (por eso se avisa).
 */
async function contarEnDestino(informe) {
  let total = 0;
  for (const particion of informe.particiones) {
    total += await contarParticion(informe.tabla, particion);
  }
  return total;
}

// ──────────────────────────────────────────────────────────── arranque
async function principal() {
  const reglas = COLECCIONES.filter((c) => SOLO.length === 0 || SOLO.includes(c.nombre));
  if (reglas.length === 0) {
    console.error(`No hay ninguna colección que se llame así. Disponibles: ${COLECCIONES.map((c) => c.nombre).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log("═".repeat(72));
  console.log("  MUDANZA Firestore → Azure Table Storage");
  console.log(`  origen : Firebase ${PROYECTO} (leyendo como ${CUENTA})`);
  console.log(`  modo   : ${ESCRIBIR ? "ESCRIBIR DE VERDAD" : "SIMULACRO (no se escribe nada)"}`);
  if (LIMITE) console.log(`  límite : ${LIMITE} documentos por colección (prueba)`);
  console.log("═".repeat(72));

  if (ESCRIBIR && !process.env.TABLES_CONNECTION_STRING) {
    console.error(
      "\nFalta TABLES_CONNECTION_STRING: es la llave de la cuenta de almacenamiento\n" +
        "de Azure (stgembcurso). Ponla en la terminal o en .env.local y vuelve a intentarlo.",
    );
    process.exitCode = 1;
    return;
  }

  const informes = [];
  for (const regla of reglas) {
    try {
      informes.push(await migrarColeccion(regla));
    } catch (e) {
      console.error(`\n✖ ${regla.nombre}: ${e?.message ?? e}`);
      informes.push({
        nombre: regla.nombre,
        tabla: regla.tabla,
        leidos: 0,
        preparadas: 0,
        escritas: 0,
        omitidas: [],
        avisos: [],
        fallos: [String(e?.message ?? e)],
        sensibles: 0,
        particiones: new Set(),
      });
    }
  }

  // ───────────────────────────── recuento final (origen contra destino)
  console.log("\n" + "═".repeat(72));
  console.log("  RECUENTO — para comprobar que no se perdió nada");
  console.log("═".repeat(72));

  const columnas = ESCRIBIR
    ? ["colección", "leídos", "preparadas", "escritas", "en destino", "fuera"]
    : ["colección", "leídos", "preparadas", "se escribirían", "fuera"];
  const anchos = [14, 8, 11, 15, 12, 7];
  console.log(columnas.map((c, i) => c.padEnd(anchos[i])).join(""));
  console.log("─".repeat(72));

  const suma = { leidos: 0, preparadas: 0, escritas: 0, destino: 0, fuera: 0 };
  const dudas = [];

  for (const inf of informes) {
    const fuera = inf.omitidas.length;
    let enDestino = 0;
    if (ESCRIBIR) {
      try {
        enDestino = await contarEnDestino(inf);
      } catch {
        enDestino = -1; // no se pudo contar; se marca y no se inventa un número
      }
    }

    const fila = ESCRIBIR
      ? [inf.nombre, inf.leidos, inf.preparadas, inf.escritas, enDestino < 0 ? "?" : enDestino, fuera]
      : [inf.nombre, inf.leidos, inf.preparadas, inf.preparadas, fuera];
    console.log(fila.map((c, i) => String(c).padEnd(anchos[i])).join(""));

    suma.leidos += inf.leidos;
    suma.preparadas += inf.preparadas;
    suma.escritas += inf.escritas;
    if (enDestino > 0) suma.destino += enDestino;
    suma.fuera += fuera;

    if (inf.leidos !== inf.preparadas + fuera) {
      dudas.push(`${inf.nombre}: las cuentas no cuadran (leídos ${inf.leidos}, preparadas ${inf.preparadas}, fuera ${fuera})`);
    }
    if (ESCRIBIR && inf.escritas !== inf.preparadas) {
      dudas.push(`${inf.nombre}: se prepararon ${inf.preparadas} filas y se escribieron ${inf.escritas}`);
    }
    if (ESCRIBIR && enDestino >= 0 && enDestino < inf.escritas) {
      dudas.push(`${inf.nombre}: en el destino hay ${enDestino} filas y se escribieron ${inf.escritas} (¿dos documentos en la misma fila?)`);
    }
  }

  console.log("─".repeat(72));
  const totales = ESCRIBIR
    ? ["TOTAL", suma.leidos, suma.preparadas, suma.escritas, suma.destino, suma.fuera]
    : ["TOTAL", suma.leidos, suma.preparadas, suma.preparadas, suma.fuera];
  console.log(totales.map((c, i) => String(c).padEnd(anchos[i])).join(""));

  if (ESCRIBIR) {
    console.log(
      '\n("en destino" es lo que hay AHORA en esas particiones de Azure; puede incluir\n' +
        " filas que ya estuvieran de antes, así que igual o mayor que 'escritas' está bien).",
    );
  }

  // Todo lo que quedó fuera o dio problemas, con nombre y apellido.
  for (const inf of informes) {
    if (inf.sensibles) {
      console.log(
        `\n🔒 ${inf.nombre} — en ${inf.sensibles} fila(s) NO se copió el nombre propio.\n` +
          "   Es a propósito: el proyecto dejó de guardar ese dato en el ranking (lo veía\n" +
          "   cualquiera con sesión) y el nombre para mostrar vive en el directorio.\n" +
          "   El dato sigue intacto en Firebase. Si aun así lo quieres: --con-nombres",
      );
    }
    if (inf.omitidas.length) {
      console.log(`\n✱ ${inf.nombre} — ${inf.omitidas.length} documento(s) que NO se copian:`);
      for (const o of inf.omitidas.slice(0, DETALLE ? 200 : 20)) console.log(`   · ${o}`);
      if (inf.omitidas.length > (DETALLE ? 200 : 20)) console.log("   · … (usa --detalle para verlos todos)");
    }
    if (inf.avisos.length) {
      console.log(`\n⚠ ${inf.nombre} — ${inf.avisos.length} aviso(s):`);
      for (const a of inf.avisos.slice(0, DETALLE ? 200 : 20)) console.log(`   · ${a}`);
      if (inf.avisos.length > (DETALLE ? 200 : 20)) console.log("   · … (usa --detalle para verlos todos)");
    }
    if (inf.fallos.length) {
      console.log(`\n✖ ${inf.nombre} — ${inf.fallos.length} fallo(s) al escribir:`);
      for (const f of inf.fallos) console.log(`   · ${f}`);
    }
  }

  const huboFallos = informes.some((i) => i.fallos.length > 0);
  if (dudas.length || huboFallos) {
    console.log("\n" + "!".repeat(72));
    console.log("  REVISAR ANTES DE DAR LA MUDANZA POR BUENA:");
    for (const d of dudas) console.log(`   · ${d}`);
    if (huboFallos) console.log("   · hubo fallos al escribir (arriba, con su motivo)");
    console.log("!".repeat(72));
    process.exitCode = 1;
  } else {
    console.log(
      ESCRIBIR
        ? "\n✔ Todo cuadra: lo leído de Firebase está copiado en Azure."
        : "\n✔ Simulacro terminado. Nada se tocó. Para copiar de verdad: node scripts/migrar-a-azure.mjs --escribir",
    );
  }
}

principal().catch((e) => {
  console.error(`\n✖ La mudanza se detuvo: ${e?.message ?? e}`);
  process.exitCode = 1;
});
