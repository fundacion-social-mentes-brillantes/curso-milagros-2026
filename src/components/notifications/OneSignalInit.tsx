"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

const ONESIGNAL_APP_ID = "7959aae1-aace-4889-b89f-d307ad2ad95c";

interface OneSignalApi {
  init: (opts: {
    appId: string;
    allowLocalhostAsSecureOrigin?: boolean;
  }) => Promise<void>;
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: OneSignalApi) => void | Promise<void>>;
  }
}

/**
 * Inicializa OneSignal SOLO para personas con sesión iniciada (así no se le pide
 * el permiso de notificaciones a los visitantes de la portada). Una vez iniciado,
 * aparece el aviso para activar el "recordatorio diario".
 */
export function OneSignalInit() {
  const { firebaseUser } = useAuth();

  useEffect(() => {
    if (!firebaseUser) return;
    if (document.getElementById("onesignal-sdk")) return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
      });
    });

    const script = document.createElement("script");
    script.id = "onesignal-sdk";
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    document.head.appendChild(script);
  }, [firebaseUser]);

  return null;
}
