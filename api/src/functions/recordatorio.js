"use strict";

/**
 * EL RECORDATORIO DIARIO, personal (GET /api/recordatorio-diario).
 *
 * Corre UNA vez de madrugada y deja el día entero preparado para cada persona:
 * el aviso de las 3 a.m. más tres recordatorios repartidos al azar, TODOS con
 * la misma idea —la de la lección en la que va— y un enlace que la lleva justo
 * a esa lección.
 *
 * Que los tres del día se dejen programados de una vez, con el texto YA FIJADO,
 * no es un capricho: es lo que garantiza que si marcas la lección a las 10 a.m.,
 * los de la tarde te sigan recordando LA MISMA idea y no la de mañana. El Curso
 * pide repetir la idea del día durante todo el día.
 *
 * Quién lo dispara: una función con temporizador aparte (Azure Static Web Apps
 * solo admite funciones que respondan a peticiones web, no a relojes). Esa
 * función solo llama a esta ruta con el secreto; toda la lógica vive aquí.
 */

const { app } = require("@azure/functions");
const { P, leerUno, leerTodo, guardar } = require("../shared/tablas");
const { cicloActivo } = require("../shared/ciclo");

const ONESIGNAL_APP_ID = "7959aae1-aace-4889-b89f-d307ad2ad95c";
const SITIO =
  process.env.SITIO_URL || "https://cursodemilagros.gimnasioemocionalmb.com";

/** Los tres recordatorios caen al azar en esta franja (hora de Colombia). */
const FRANJA_INICIO = 8 * 60; // 8:00 a. m.
const FRANJA_FIN = 21 * 60; // 9:00 p. m.
const RECORDATORIOS = 3;
const SEPARACION_MINIMA = 150; // 2 h 30 min entre uno y otro

/**
 * LOS DÍAS DE REPASO (69 de los 365).
 *
 * Esos días el Curso no trae idea nueva: manda repasar ideas anteriores, y la
 * lección se titula "El repaso de hoy abarca las siguientes ideas:". Mandar eso
 * en un aviso no le dice nada a nadie.
 *
 * La estructura de repasos es fija, así que se calcula y el aviso dice QUÉ se
 * repasa. Es la misma tabla que `src/lib/repasos.ts` en la app: si se cambia
 * una, cambiar la otra.
 */
const BLOQUES_DE_REPASO = [
  { desde: 51, hasta: 60, repasaDesde: 1, porDia: 5 },
  { desde: 81, hasta: 90, repasaDesde: 61, porDia: 2 },
  { desde: 111, hasta: 120, repasaDesde: 91, porDia: 2 },
  { desde: 141, hasta: 150, repasaDesde: 121, porDia: 2 },
  { desde: 171, hasta: 180, repasaDesde: 151, porDia: 2 },
  { desde: 201, hasta: 220, repasaDesde: 181, porDia: 1 },
];

function repasoDe(n) {
  for (const b of BLOQUES_DE_REPASO) {
    if (n >= b.desde && n <= b.hasta) {
      const primera = b.repasaDesde + (n - b.desde) * b.porDia;
      return Array.from({ length: b.porDia }, (_, i) => primera + i);
    }
  }
  return null;
}

/** "11, 12, 13, 14 y 15" */
function enumerar(nums) {
  if (nums.length === 1) return String(nums[0]);
  return `${nums.slice(0, -1).join(", ")} y ${nums[nums.length - 1]}`;
}

/** Respaldo por si alguna lección se quedara sin título. */
const FRASE_DE_REPASO = /^(el\s+)?repaso\b|abarca las siguientes ideas/i;
const RESPALDO = "Tu lección de hoy te espera. Entra y hazla con calma. 🌿";

/** Las ideas se leen del propio sitio, así nunca se desfasan del contenido. */
let ideas = null;
async function cargarIdeas() {
  if (ideas) return ideas;
  const res = await fetch(`${SITIO}/lessons/index.json`);
  if (!res.ok) throw new Error("no pude leer el índice de lecciones");
  const lista = await res.json();
  ideas = new Map(lista.map((l) => [Number(l.number), String(l.title ?? "").trim()]));
  return ideas;
}

function ideaDe(mapa, leccion) {
  // El repaso se decide por la ESTRUCTURA del Curso, no por cómo esté escrito
  // el título: así sigue funcionando aunque cambie la traducción.
  const repasa = repasoDe(leccion);
  if (repasa) {
    const cuales = enumerar(repasa);
    const idea =
      repasa.length === 1
        ? `Hoy vuelves sobre la idea de la lección ${cuales}.`
        : `Hoy vuelves sobre las ideas de las lecciones ${cuales}.`;
    return { idea, esRepaso: true };
  }

  const t = (mapa.get(leccion) ?? "").trim();
  if (!t || FRASE_DE_REPASO.test(t)) return { idea: RESPALDO, esRepaso: true };
  return { idea: t, esRepaso: false };
}

/** Fecha de hoy en Colombia (YYYY-MM-DD). Colombia es siempre UTC-5. */
function fechaBogota(ms) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function instanteBogota(fecha, minutoDelDia) {
  const h = String(Math.floor(minutoDelDia / 60)).padStart(2, "0");
  const m = String(minutoDelDia % 60).padStart(2, "0");
  return Date.parse(`${fecha}T${h}:${m}:00-05:00`);
}

function horaBogota(ms) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

/**
 * Tres momentos al azar, siempre separados y en orden: la franja se parte en
 * tres tramos y se sortea un minuto dentro de cada uno. Así cambian cada día
 * pero nunca se amontonan.
 */
function horariosDelDia() {
  const tramo = Math.floor((FRANJA_FIN - FRANJA_INICIO) / RECORDATORIOS);
  const minutos = [];
  for (let i = 0; i < RECORDATORIOS; i++) {
    const desde = FRANJA_INICIO + i * tramo;
    const margen = Math.max(1, Math.min(tramo, tramo - 20));
    let minuto = desde + Math.floor(Math.random() * margen);
    const anterior = minutos[minutos.length - 1];
    if (anterior !== undefined && minuto - anterior < SEPARACION_MINIMA) {
      minuto = anterior + SEPARACION_MINIMA;
    }
    minutos.push(Math.min(minuto, FRANJA_FIN));
  }
  return minutos;
}

async function enviar(envio, apiKey) {
  const cuerpo = {
    app_id: ONESIGNAL_APP_ID,
    // Cada persona quedó enlazada con su uid desde el navegador (OneSignal.login).
    include_aliases: { external_id: envio.uids },
    target_channel: "push",
    headings: { en: envio.titulo, es: envio.titulo },
    contents: { en: envio.idea, es: envio.idea },
    url: `${SITIO}/lecciones/${envio.leccion}`,
  };
  if (envio.cuando !== null) cuerpo.send_after = new Date(envio.cuando).toISOString();

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${apiKey}` },
      body: JSON.stringify(cuerpo),
    });
    return res.ok;
  } catch {
    return false;
  }
}

app.http("recordatorioDiario", {
  route: "recordatorio-diario",
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    // Solo quien tenga el secreto puede dispararlo: si no, cualquiera podría
    // mandarle notificaciones a toda la comunidad.
    const secreto = process.env.CRON_SECRET;
    // Los dos rechazos se distinguen a proposito: "sin-secreto" avisa de que
    // falta configurar la variable en Azure, y "clave-incorrecta" de que quien
    // llama no tiene la buena. Ninguno revela el secreto.
    if (!secreto) return { status: 401, body: "sin-secreto-configurado" };
    /*
     * La clave puede venir por cabecera o por parámetro, y se aceptan LAS DOS.
     *
     * Ojo con la cabecera: Azure Static Web Apps mete su propio testigo interno
     * en `Authorization` antes de entregarnos la petición (llega con ~365
     * caracteres que no son nuestros). Por eso no vale con "si hay cabecera,
     * usa la cabecera": hay que mirar las dos y quedarse con la que coincida.
     * Esto costó una tarde de depuración; no volver a la versión de antes.
     */
    const deCabecera = (request.headers.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    const deParametro = (request.query.get("clave") || "").trim();
    const deCabeceraPropia = (request.headers.get("x-clave-cron") || "").trim();
    const dado = [deCabecera, deParametro, deCabeceraPropia].find((v) => v === secreto) || "";
    if (dado !== secreto) return { status: 401, body: "clave-incorrecta" };

    // Diagnostico: dice si Azure entrego las variables, con LONGITUDES y nunca
    // valores. Va DESPUES de comprobar la clave: si estuviera antes, cualquiera
    // podria sondear la configuracion del servidor sin permiso.
    if (request.query.get("diag") === "1") {
      return {
        jsonBody: {
          secretoConfigurado: Boolean(secreto),
          longitudSecreto: secreto ? secreto.length : 0,
          longitudCabecera: deCabecera.length,
          longitudParametro: deParametro.length,
          coinciden: dado === secreto,
          tablas: Boolean(process.env.TABLES_CONNECTION_STRING),
          onesignal: Boolean(process.env.ONESIGNAL_REST_API_KEY),
          longitudOnesignal: (process.env.ONESIGNAL_REST_API_KEY || "").length,
          deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
          sitio: process.env.SITIO_URL || "(sin definir)",
        },
      };
    }


    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!apiKey) return { status: 503, jsonBody: { error: "falta-onesignal" } };

    const hoy = fechaBogota(Date.now());
    const forzar = request.query.get("forzar") === "1";
    const simular = request.query.get("simular") === "1";

    try {
      // Candado: si hoy ya se programó, no se repite. Evita que un disparo
      // doble le mande a la gente el día por partida doble.
      if (!forzar && !simular) {
        const marca = await leerUno("recordatorios", P.recordatorios(), hoy);
        if (marca) {
          return { jsonBody: { ok: true, omitido: "ya-programado-hoy", fecha: hoy } };
        }
      }

      const ciclo = await cicloActivo();
      const mapa = await cargarIdeas();

      const personas = (await leerTodo("users"))
        .filter((u) => u.enrolled !== false)
        .map((u) => ({
          uid: u._fila,
          leccion: Math.min(Math.max(Number(u.currentLesson ?? 1), 1), 365),
        }));

      if (personas.length === 0) {
        return { jsonBody: { ok: true, personas: 0, envios: 0, fecha: hoy } };
      }

      // Quienes van en la misma lección reciben el mismo mensaje: se agrupan
      // para mandar un envío por lección en vez de uno por persona.
      const porLeccion = new Map();
      for (const p of personas) {
        const g = porLeccion.get(p.leccion);
        if (g) g.push(p.uid);
        else porLeccion.set(p.leccion, [p.uid]);
      }

      const momentos = horariosDelDia();
      const ahora = Date.now();
      const lista = [];

      for (const [leccion, uids] of porLeccion) {
        const { idea, esRepaso } = ideaDe(mapa, leccion);

        // 1) El de la madrugada: sale ya y queda esperando en el teléfono.
        lista.push({
          uids,
          leccion,
          idea,
          titulo: esRepaso ? `Lección ${leccion} · Repaso` : `Lección ${leccion}`,
          cuando: null,
        });

        // 2) Los tres del día: misma idea, mismo enlace, a horas al azar.
        for (const minuto of momentos) {
          const cuando = instanteBogota(hoy, minuto);
          if (!Number.isFinite(cuando) || cuando <= ahora) continue;
          lista.push({
            uids,
            leccion,
            idea,
            titulo: esRepaso
              ? `Vuelve a tu repaso · Lección ${leccion}`
              : `Repite tu idea de hoy · Lección ${leccion}`,
            cuando,
          });
        }
      }

      if (simular) {
        return {
          jsonBody: {
            ok: true,
            simulacion: true,
            fecha: hoy,
            ciclo,
            personas: personas.length,
            lecciones: porLeccion.size,
            envios: lista.length,
            plan: lista.map((e) => ({
              leccion: e.leccion,
              personas: e.uids.length,
              cuando: e.cuando === null ? "ahora (3 a.m.)" : horaBogota(e.cuando),
              titulo: e.titulo,
              idea: e.idea,
              enlace: `${SITIO}/lecciones/${e.leccion}`,
            })),
          },
        };
      }

      // De a pocos, para no saturar ni pasarse del tiempo límite.
      let logrados = 0;
      for (let i = 0; i < lista.length; i += 6) {
        const tanda = lista.slice(i, i + 6);
        const r = await Promise.all(tanda.map((e) => enviar(e, apiKey)));
        logrados += r.filter(Boolean).length;
      }

      await guardar("recordatorios", P.recordatorios(), hoy, {
        fecha: hoy,
        personas: personas.length,
        lecciones: porLeccion.size,
        envios: lista.length,
        logrados,
        creadoEn: ahora,
      });

      return {
        jsonBody: {
          ok: true,
          fecha: hoy,
          personas: personas.length,
          lecciones: porLeccion.size,
          envios: lista.length,
          logrados,
        },
      };
    } catch (err) {
      context.error("fallo en el recordatorio:", err);
      return {
        status: 500,
        jsonBody: { error: "fallo", detalle: err instanceof Error ? err.message : String(err) },
      };
    }
  },
});
