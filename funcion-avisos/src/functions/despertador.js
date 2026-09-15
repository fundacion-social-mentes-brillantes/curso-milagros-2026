"use strict";

/**
 * EL DESPERTADOR — lo único que hace es mirar el reloj.
 *
 * A las 3 de la mañana de Colombia llama a la ruta del recordatorio, que es
 * quien de verdad prepara los avisos del día. Aquí no hay lógica ninguna: si
 * algún día cambia cómo se arman los mensajes, este archivo no se toca.
 *
 * Por qué existe separado: Azure Static Web Apps solo admite funciones que
 * respondan a peticiones web, no a relojes. Así que el reloj vive aquí, en una
 * aplicación de funciones aparte, y el trabajo sigue viviendo con el resto de
 * la API.
 *
 * El horario va en UTC: las 08:00 UTC son las 3:00 de la mañana en Colombia
 * (siempre UTC-5, allí no se cambia la hora en todo el año).
 */

const { app } = require("@azure/functions");

const DESTINO =
  process.env.URL_RECORDATORIO ||
  "https://cursodemilagros.gimnasioemocionalmb.com/api/recordatorio-diario";

app.timer("despertadorDiario", {
  schedule: "0 0 8 * * *",
  handler: async (_temporizador, context) => {
    const secreto = process.env.CRON_SECRET;
    if (!secreto) {
      context.error("Falta CRON_SECRET: no se disparó el recordatorio.");
      return;
    }

    try {
      // Se manda en una cabecera PROPIA, no en `Authorization`: Azure Static
      // Web Apps sustituye esa última por su testigo interno antes de entregar
      // la petición, y el secreto nunca llegaría.
      const res = await fetch(DESTINO, {
        method: "POST",
        headers: { "x-clave-cron": secreto },
      });
      const texto = await res.text();
      // Queda registrado para poder mirar mañana si algo no llegó.
      context.log(`recordatorio disparado: HTTP ${res.status} — ${texto.slice(0, 400)}`);
    } catch (err) {
      context.error("no pude disparar el recordatorio:", err);
    }
  },
});
