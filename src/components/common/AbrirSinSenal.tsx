"use client";

import { useEffect } from "react";

/**
 * Pone el trabajador de fondo que deja abrir la app aunque la conexión falle o
 * tarde justo al abrirla (ver public/OneSignalSDKWorker.js). Es el MISMO
 * archivo de las notificaciones de OneSignal: si ya está puesto (porque la
 * persona activó los avisos), no se toca y el navegador lo actualiza solo; si
 * no, se pone aquí, para que lo tengan también quienes no activaron avisos.
 *
 * Solo en la versión publicada: en desarrollo guardaría piezas que cambian a
 * cada rato y la pantalla dejaría de actualizarse.
 */
export function AbrirSinSenal() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Sin apuro: después de que la página ya se mostró.
    const t = window.setTimeout(() => {
      navigator.serviceWorker
        .getRegistration("/")
        .then((r) => (r ? undefined : navigator.serviceWorker.register("/OneSignalSDKWorker.js", { scope: "/" })))
        .catch(() => {
          /* sin trabajador de fondo, la app funciona igual que siempre */
        });
    }, 3000);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
