"use client";

/**
 * SABER —DE VERDAD— SI LE VAN A LLEGAR LAS NOTIFICACIONES.
 *
 * Parece una sola pregunta y en realidad son tres. Hay que responder las tres
 * o la respuesta engaña:
 *
 *   1. ¿Este navegador puede recibirlas? Safari en iPhone no puede si la página
 *      no está instalada en la pantalla de inicio, y hay navegadores que
 *      sencillamente no admiten notificaciones.
 *   2. ¿Dio permiso? Y ojo: "denegado" NO se arregla desde la página. El
 *      navegador no vuelve a preguntar nunca más; hay que ir a sus ajustes.
 *   3. ¿Está suscrito CON SU NOMBRE? Se puede tener el permiso dado y aun así
 *      no recibir nada, porque el permiso es del navegador y la suscripción es
 *      de OneSignal: son cosas distintas y fallan por separado.
 *
 * Decir "activadas" mirando solo el permiso es el error clásico, y es justo el
 * que deja a alguien esperando un aviso que nunca va a llegar.
 *
 * Y algo que conviene tener presente: todo esto es POR APARATO. Activarlas en
 * el computador no las activa en el celular.
 */

export interface SuscripcionPush {
  optedIn?: boolean;
  id?: string | null;
  optIn?: () => Promise<void>;
  optOut?: () => Promise<void>;
}

export interface OneSignalApi {
  init: (opts: { appId: string; allowLocalhostAsSecureOrigin?: boolean }) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  Notifications: {
    permission: boolean;
    permissionNative?: NotificationPermission;
    isPushSupported?: () => boolean;
    requestPermission?: () => Promise<void>;
  };
  User?: { PushSubscription?: SuscripcionPush };
  Slidedown: { promptPush: () => Promise<void> };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: OneSignalApi) => void | Promise<void>>;
  }
}

export const ONESIGNAL_APP_ID = "7959aae1-aace-4889-b89f-d307ad2ad95c";

/**
 * Habla con OneSignal cuando esté listo, sin quedarse colgado para siempre.
 *
 * La cola `OneSignalDeferred` no se vacía nunca si el script no llega a cargar
 * —un bloqueador de anuncios basta—, así que sin plazo la pantalla se quedaría
 * diciendo "comprobando…" eternamente. Con plazo devuelve null y la pantalla
 * puede decir la verdad: "no pudimos comprobarlo".
 */
export function conOneSignal<T>(
  tarea: (os: OneSignalApi) => Promise<T> | T,
  msPlazo = 8000,
): Promise<T | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolver) => {
    let resuelto = false;
    const acabar = (valor: T | null) => {
      if (resuelto) return;
      resuelto = true;
      resolver(valor);
    };
    const reloj = setTimeout(() => acabar(null), msPlazo);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (os) => {
      try {
        acabar(await tarea(os));
      } catch {
        acabar(null);
      } finally {
        clearTimeout(reloj);
      }
    });
  });
}

/** Mete el script de OneSignal en la página (una sola vez). */
export function cargarSdk(): void {
  if (typeof document === "undefined") return;
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
}

export type ClaseEstado =
  /** El navegador no admite notificaciones. */
  | "no-se-puede"
  /** iPhone: sí se puede, pero hay que añadir la página a la pantalla de inicio. */
  | "iphone-sin-instalar"
  /** Todavía no se le ha preguntado. */
  | "sin-decidir"
  /** Dijo que no. Desde aquí ya no se puede arreglar. */
  | "bloqueado"
  /** Dio permiso, pero la suscripción está apagada. */
  | "permitido-apagado"
  /** Todo en orden. */
  | "activo"
  /** No se pudo hablar con OneSignal. */
  | "desconocido";

export interface EstadoNotificaciones {
  clase: ClaseEstado;
  /** Identificador de ESTE aparato en OneSignal, si lo hay. */
  idSuscripcion: string | null;
  /** Lo que dice el navegador por su cuenta, sin pasar por OneSignal. */
  permisoNavegador: NotificationPermission | "sin-soporte";
}

function esIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Los iPad modernos se hacen pasar por Mac; se distinguen porque tienen táctil.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  const comoApp = window.matchMedia?.("(display-mode: standalone)").matches;
  const safari = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(comoApp || safari);
}

/** El permiso tal cual lo ve el navegador, sin OneSignal de por medio. */
export function permisoDelNavegador(): NotificationPermission | "sin-soporte" {
  if (typeof window === "undefined" || !("Notification" in window)) return "sin-soporte";
  return Notification.permission;
}

export async function consultarEstado(): Promise<EstadoNotificaciones> {
  const permisoNavegador = permisoDelNavegador();

  // Lo que se puede saber sin OneSignal se responde ya: si el aparato no puede,
  // no tiene sentido esperar ocho segundos a un script para decir lo mismo.
  if (permisoNavegador === "sin-soporte") {
    const clase = esIphone() && !estaInstalada() ? "iphone-sin-instalar" : "no-se-puede";
    return { clase, idSuscripcion: null, permisoNavegador };
  }
  if (esIphone() && !estaInstalada() && permisoNavegador === "default") {
    return { clase: "iphone-sin-instalar", idSuscripcion: null, permisoNavegador };
  }
  if (permisoNavegador === "denied") {
    return { clase: "bloqueado", idSuscripcion: null, permisoNavegador };
  }

  const datos = await conOneSignal((os) => {
    const sub = os.User?.PushSubscription;
    return { optedIn: sub?.optedIn, id: sub?.id ?? null };
  });

  if (!datos) {
    // OneSignal no contestó. Se dice lo poco que se sabe con certeza, en vez de
    // inventarse un "todo bien".
    return { clase: "desconocido", idSuscripcion: null, permisoNavegador };
  }

  if (permisoNavegador === "default") {
    return { clase: "sin-decidir", idSuscripcion: null, permisoNavegador };
  }

  // Permiso concedido. Falta que la suscripción esté encendida Y registrada:
  // sin identificador, OneSignal no tiene a dónde mandar nada.
  const encendida = datos.optedIn !== false && Boolean(datos.id);
  return {
    clase: encendida ? "activo" : "permitido-apagado",
    idSuscripcion: datos.id,
    permisoNavegador,
  };
}

/** Pide el permiso. Solo sirve la primera vez; si ya dijo que no, no hace nada. */
export async function activar(): Promise<void> {
  // El plazo es largo a propósito: aquí la persona tiene que decidir en un
  // aviso del navegador, y puede tardar.
  await conOneSignal(async (os) => {
    if (os.Notifications.requestPermission) {
      await os.Notifications.requestPermission();
    } else {
      await os.Slidedown.promptPush();
    }
    await os.User?.PushSubscription?.optIn?.();
  }, 60000);
}

/** Vuelve a encender la suscripción cuando el permiso ya estaba dado. */
export async function encender(): Promise<void> {
  await conOneSignal((os) => os.User?.PushSubscription?.optIn?.());
}

/** Deja de recibirlas en ESTE aparato, sin tocar el permiso del navegador. */
export async function apagar(): Promise<void> {
  await conOneSignal((os) => os.User?.PushSubscription?.optOut?.());
}
