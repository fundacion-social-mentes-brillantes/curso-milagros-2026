"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { cargarSdk, conOneSignal } from "@/lib/notificaciones";

/**
 * Inicializa OneSignal SOLO para personas con sesión iniciada (así no se le
 * pide el permiso de notificaciones a quien solo pasa por la portada).
 *
 * Lo importante es el `login(uid)`: sin eso OneSignal sabe que hay "un
 * navegador" suscrito, pero no QUIÉN es, y entonces el recordatorio diario solo
 * podría mandar un mensaje igual para todos. Enlazándolo, el servidor puede
 * mandarle a cada quien la idea de la lección en la que va.
 *
 * El aviso que sale la primera vez es el de OneSignal, no el del navegador: si
 * lo cierran no se gasta nada y se puede volver a ofrecer después desde
 * Ajustes. El del navegador (el que cuando dice "no" ya no vuelve a preguntar
 * nunca) solo aparece si la persona acepta el primero.
 */
export function OneSignalInit() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  useEffect(() => {
    if (!uid) return;
    cargarSdk();

    // La cola de OneSignal acepta tareas aunque el script ya esté iniciado, así
    // que esto se encola igual y no depende del orden de carga.
    void conOneSignal(async (os) => {
      await os.login(uid);
      // Si todavía no ha decidido, se le muestra el aviso amable de OneSignal.
      // Si ya dijo que sí (o que no), esto no vuelve a molestar.
      if (!os.Notifications.permission) {
        await os.Slidedown.promptPush();
      }
    });
  }, [uid]);

  return null;
}
