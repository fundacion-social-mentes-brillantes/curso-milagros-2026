"use strict";

/**
 * CÓMO SE VE UNA NOTIFICACIÓN DEL CURSO EN EL CELULAR.
 *
 * Sin esto, OneSignal usa el ícono por defecto, que apunta a
 * `/images/icon.png`. Esa ruta se sirve con caché de un año («immutable»):
 * los celulares que la bajaron antes del cambio de logo (30-sep-2026) siguen
 * mostrando el VIEJO, aunque el archivo ya sea el nuevo (Sebastián, 28-oct).
 *
 * Por eso cada notificación lleva sus propias imágenes, con nombres que nunca
 * se usaron (si algún día cambia el logo, se le cambia también el nombre al
 * archivo; no se pisa):
 *  - ícono:    el logo UCDM, que Android muestra redondo a la derecha;
 *  - insignia: el libro en blanco para la barra de arriba (sin ella, Chrome
 *              pone una campanita genérica);
 *  - imagen:   la ilustración de la lección del día, grande al desplegarla.
 */

const SITIO = process.env.SITIO_URL || "https://cursodemilagros.gimnasioemocionalmb.com";
const IMAGENES = "https://stgembcurso.blob.core.windows.net/imagenes/lecciones";

function aspectoDelAviso(leccion) {
  const icono = `${SITIO}/icons/notificacion-ucdm.png`;
  const aspecto = {
    chrome_web_icon: icono,
    chrome_web_badge: `${SITIO}/icons/insignia-ucdm.png`,
    firefox_icon: icono,
  };
  const n = Number(leccion);
  if (Number.isInteger(n) && n >= 1 && n <= 365) {
    aspecto.chrome_web_image = `${IMAGENES}/${String(n).padStart(3, "0")}.webp`;
  }
  return aspecto;
}

module.exports = { aspectoDelAviso };
