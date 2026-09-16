"use strict";

/**
 * NOTIFICACIÓN DE PRUEBA (POST /api/probar-notificacion).
 *
 * Por qué existe: mirando la pantalla de Ajustes uno puede ver "activadas" y
 * aun así no recibir nada. Entre el permiso del navegador y el celular sonando
 * hay varias piezas más —la suscripción de OneSignal, que esté enlazada con el
 * uid correcto, que el aparato siga registrado— y ninguna se ve desde fuera.
 * La única comprobación que no miente es mandar una de verdad.
 *
 * Solo se la puede mandar a SÍ MISMA: el destinatario sale de la sesión, nunca
 * de lo que venga en la petición. Así esta ruta no sirve para molestar a nadie
 * más, ni siquiera equivocándose.
 *
 * Y devuelve `destinatarios`, que es el dato de oro: si OneSignal dice 0, el
 * problema no es la red ni el permiso, es que esta persona no tiene NINGÚN
 * aparato suscrito a su nombre. Eso explica en un segundo lo que de otro modo
 * son horas de "a mí no me llega nada".
 */

const { app } = require("@azure/functions");
const { manejar, json } = require("../shared/http");
const { P, guardar } = require("../shared/tablas");

const ONESIGNAL_APP_ID = "7959aae1-aace-4889-b89f-d307ad2ad95c";
const SITIO = process.env.SITIO_URL || "https://cursodemilagros.gimnasioemocionalmb.com";

/** Un respiro entre pruebas: ni spam a uno mismo, ni gastar envíos de balde. */
const ESPERA_MS = 30_000;

app.http("probarNotificacion", {
  route: "probar-notificacion",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: manejar("sesion", async (_req, context, { persona, perfil }) => {
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!apiKey) return json({ error: "sin-onesignal" }, 503);

    const ahora = Date.now();
    const ultima = Number(perfil?.ultimaPrueba || 0);
    if (ahora - ultima < ESPERA_MS) {
      return json(
        {
          error: "muy-seguido",
          esperaSegundos: Math.ceil((ESPERA_MS - (ahora - ultima)) / 1000),
        },
        429,
      );
    }

    const cuerpo = {
      app_id: ONESIGNAL_APP_ID,
      // El destinatario sale de la sesión. Nunca del cuerpo de la petición.
      include_aliases: { external_id: [persona.uid] },
      target_channel: "push",
      headings: { en: "Prueba ✓", es: "Prueba ✓" },
      contents: {
        en: "Así se verá tu recordatorio diario. Todo funciona.",
        es: "Así se verá tu recordatorio diario. Todo funciona.",
      },
      url: `${SITIO}/ajustes`,
    };

    let respuesta;
    try {
      const res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${apiKey}` },
        body: JSON.stringify(cuerpo),
      });
      respuesta = await res.json().catch(() => ({}));
      if (!res.ok) {
        context.warn("OneSignal rechazó la prueba:", res.status, respuesta);
        return json({ error: "onesignal-rechazo", detalle: respuesta?.errors ?? null }, 502);
      }
    } catch (err) {
      context.error("no se pudo hablar con OneSignal:", err);
      return json({ error: "sin-conexion" }, 502);
    }

    // Se apunta el intento aunque no haya llegado a nadie: el freno es contra
    // repetir la llamada, no contra que salga bien.
    await guardar("users", P.users(), persona.uid, { ultimaPrueba: ahora });

    const destinatarios = Number(respuesta?.recipients ?? 0);

    // OneSignal responde 200 con "recipients: 0" cuando la persona no tiene
    // ningún aparato suscrito. Eso NO es un éxito, y decirlo así evita que se
    // quede esperando una notificación que nunca se envió.
    if (destinatarios === 0) {
      return json({
        ok: false,
        motivo: "sin-aparatos",
        destinatarios: 0,
        detalle: respuesta?.errors ?? null,
      });
    }

    return json({ ok: true, destinatarios, id: respuesta?.id ?? null });
  }),
});
