"use strict";

/**
 * LUMI — el guía que conversa (POST /api/sensei).
 *
 * Tres cuidados que ya estaban y se conservan:
 *
 * 1. La clave de DeepSeek vive SOLO aquí. Nunca llega al navegador.
 * 2. Solo responde a quien entró con Google Y es Portador de Luz (o admin):
 *    si no, cualquiera con una cuenta de Google podría gastarse el saldo de la
 *    fundación.
 * 3. Hay un tope de mensajes por persona, para frenar a quien mande cientos
 *    seguidos.
 *
 * Lo que cambió al salir de Firestore: el plan de la persona se lee ahora de la
 * tabla de personas en vez de consultarlo a Firestore, y el pase se comprueba
 * con las llaves públicas de Google en vez de con una llamada a su servidor
 * (es lo mismo, pero sin viaje de ida y vuelta en cada mensaje).
 */

const { app } = require("@azure/functions");
const { verificarToken } = require("../shared/auth");
const { esAdminPermanente } = require("../shared/http");
const { P, leerUno } = require("../shared/tablas");
const { SENSEI_SYSTEM_PROMPT } = require("../shared/lumi-prompt");

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODELO = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const PENSAR_NO = { type: "disabled" };
const PENSAR_SI = { type: "enabled" };

/** De dónde se lee el texto real de las lecciones (el propio sitio). */
const SITIO =
  process.env.SITIO_URL || "https://cursodemilagros.gimnasioemocionalmb.com";

function json(cuerpo, estado) {
  return { status: estado, jsonBody: cuerpo };
}

// --- Tope de uso por persona -------------------------------------------------
// Va en memoria: si Azure arranca otra instancia, el contador empieza de cero.
// No es un candado perfecto, pero frena el caso real (una persona mandando
// mensajes sin parar) sin montar nada más.
const MAX_POR_MINUTO = 15;
const MAX_POR_HORA = 120;
const golpes = new Map();

function pasaDelTope(uid) {
  const ahora = Date.now();
  const haceUnMinuto = ahora - 60_000;
  const haceUnaHora = ahora - 3_600_000;
  const recientes = (golpes.get(uid) ?? []).filter((t) => t > haceUnaHora);
  const enElMinuto = recientes.filter((t) => t > haceUnMinuto).length;
  if (enElMinuto >= MAX_POR_MINUTO || recientes.length >= MAX_POR_HORA) {
    golpes.set(uid, recientes);
    return true;
  }
  recientes.push(ahora);
  golpes.set(uid, recientes);
  return false;
}

/**
 * El texto REAL de la lección, leído aquí en el servidor.
 * Sin esto el modelo la recita de memoria y se equivoca en títulos y contenidos.
 */
async function textoDeLaLeccion(n) {
  try {
    const id = String(n).padStart(3, "0");
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${SITIO}/lessons/${id}.json`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    const datos = await res.json();
    const texto = String(datos.originalText ?? "")
      .replace(/^\s*#{1,2}\s*/gm, "")
      .trim();
    if (!texto) return null;
    return { titulo: String(datos.title ?? ""), texto: texto.slice(0, 6000) };
  } catch {
    return null; // si falla, Lumi sigue conversando sin el texto
  }
}

/** Deja solo mensajes con forma válida, y no más de los últimos 16. */
function limpiarMensajes(entrada) {
  if (!Array.isArray(entrada)) return [];
  return entrada
    .filter(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

app.http("lumi", {
  route: "sensei",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) return json({ error: "no-config" }, 503);

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "bad-request" }, 400);
      }

      const mensajes = limpiarMensajes(body?.messages);
      if (mensajes.length === 0) return json({ error: "bad-request" }, 400);

      // El pase puede venir en la cabecera (lo nuevo) o en el cuerpo (como lo
      // manda hoy la pantalla del chat). Se aceptan los dos.
      const cabecera = request.headers.get("authorization") || "";
      const token = cabecera.startsWith("Bearer ")
        ? cabecera.slice(7).trim()
        : body?.idToken;

      const persona = await verificarToken(token);
      if (!persona) return json({ error: "unauthorized" }, 401);
      if (pasaDelTope(persona.uid)) return json({ error: "rate-limit" }, 429);

      // Lumi es para quien sostiene el proceso. Los perfiles antiguos sin el
      // campo cuentan como Portadores, igual que antes.
      const perfil = await leerUno("users", P.users(), persona.uid);
      const esAdmin =
        esAdminPermanente(persona.email) || perfil?.role === "admin";
      if (!esAdmin && perfil?.plan === "ordinario") {
        return json({ error: "solo-portador" }, 403);
      }

      let sistema = SENSEI_SYSTEM_PROMPT;
      const leccion = Number(body?.lessonNumber);
      if (Number.isInteger(leccion) && leccion >= 1 && leccion <= 365) {
        sistema += `\n\nCONTEXTO ACTUAL: la persona está leyendo la lección ${leccion} del Curso. Si su pregunta se relaciona, ten presente esa lección.`;
        const real = await textoDeLaLeccion(leccion);
        if (real) {
          sistema +=
            `\n\nTEXTO REAL DE LA LECCIÓN ${leccion} (título: «${real.titulo}»). Es la fuente de verdad:\n---\n${real.texto}\n---\n` +
            `Usa SIEMPRE este texto para hablar de esta lección: su título, su idea y su práctica. ` +
            `Nunca lo cambies por lo que recuerdes, y si la persona pregunta por otra lección que no está aquí, ` +
            `dile con humildad que la abra en la app para leerla juntos en vez de citarla de memoria.`;
        }
      }

      const pensarAFondo = body?.pensar === true;

      let arriba;
      try {
        arriba = await fetch(DEEPSEEK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: MODELO,
            thinking: pensarAFondo ? PENSAR_SI : PENSAR_NO,
            messages: [{ role: "system", content: sistema }, ...mensajes],
            stream: true,
            temperature: 0.7,
            // Pensando necesita margen extra (parte se va en su razonamiento).
            max_tokens: pensarAFondo ? 1600 : 800,
          }),
        });
      } catch {
        return json({ error: "upstream" }, 502);
      }

      if (!arriba.ok || !arriba.body) return json({ error: "upstream" }, 502);

      // Se va soltando el texto según llega, para que la respuesta aparezca
      // palabra a palabra. Si Azure lo junta todo, la pantalla del chat lo
      // muestra igual de golpe: está preparada para las dos cosas.
      const codificador = new TextEncoder();
      const decodificador = new TextDecoder();
      const lector = arriba.body.getReader();

      const flujo = new ReadableStream({
        async start(controlador) {
          let resto = "";
          try {
            for (;;) {
              const { done, value } = await lector.read();
              if (done) break;
              resto += decodificador.decode(value, { stream: true });
              const lineas = resto.split("\n");
              resto = lineas.pop() ?? "";
              for (const linea of lineas) {
                const l = linea.trim();
                if (!l.startsWith("data:")) continue;
                const carga = l.slice(5).trim();
                if (carga === "[DONE]") {
                  controlador.close();
                  return;
                }
                try {
                  const p = JSON.parse(carga);
                  const trozo = p?.choices?.[0]?.delta?.content;
                  if (trozo) controlador.enqueue(codificador.encode(trozo));
                } catch {
                  /* fragmento partido: se completa en la vuelta siguiente */
                }
              }
            }
            controlador.close();
          } catch (e) {
            controlador.error(e);
          }
        },
      });

      return {
        status: 200,
        body: flujo,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      };
    } catch (err) {
      context.error("fallo en Lumi:", err);
      return json({ error: "fallo-servidor" }, 500);
    }
  },
});
