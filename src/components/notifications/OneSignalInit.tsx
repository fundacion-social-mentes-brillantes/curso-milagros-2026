"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

const ONESIGNAL_APP_ID = "7959aae1-aace-4889-b89f-d307ad2ad95c";

interface OneSignalApi {
  init: (opts: {
    appId: string;
    allowLocalhostAsSecureOrigin?: boolean;
  }) => Promise<void>;
  /** Enlaza ESTE navegador con la persona (su uid de Firebase). */
  login: (externalId: string) => Promise<void>;
  Notifications: {
    permission: boolean;
  };
  Slidedown: {
    promptPush: () => Promise<void>;
  };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: OneSignalApi) => void | Promise<void>>;
  }
}

/**
 * Inicializa OneSignal SOLO para personas con sesión iniciada (así no se le pide
 * el permiso de notificaciones a los visitantes de la portada).
 *
 * Lo importante es el `login(uid)`: sin eso OneSignal sabe que hay "un
 * navegador" suscrito, pero no QUIÉN es, y entonces el recordatorio diario solo
 * podría mandar un mensaje igual para todos. Enlazándolo, el servidor puede
 * mandarle a cada quien la idea de la lección en la que va.
 */
export function OneSignalInit() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  useEffect(() => {
    if (!uid) return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];

    // La librería se carga una sola vez; la cola (OneSignalDeferred) acepta
    // tareas nuevas aunque ya esté iniciada, así que el login se encola igual.
    if (!document.getElementById("onesignal-sdk")) {
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
    }

    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.login(uid);
        // Si todavía no ha decidido, se le muestra el aviso amable de OneSignal.
        // Si ya dijo que sí (o que no), esto no vuelve a molestar.
        if (!OneSignal.Notifications.permission) {
          await OneSignal.Slidedown.promptPush();
        }
      } catch {
        /* sin notificaciones la app sigue funcionando igual */
      }
    });
  }, [uid]);

  return null;
}
