"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { bogotaDateStr } from "@/lib/utils";

/** Tanto tiempo fuera de la app (el mismo día) y al volver se relee el perfil. */
const AUSENCIA_LARGA = 15 * 60 * 1000;

/**
 * QUE LA APP NUNCA MUESTRE EL DÍA DE AYER COMO SI FUERA HOY.
 *
 * Lo que pasaba (Sebastián, 29-oct, 1, 3, 4 y 7-nov de 2026): marcaba su
 * lección, se iba a WhatsApp y dejaba la app abierta. Al día siguiente tocaba
 * el ícono y Android traía al frente LA MISMA pantalla, sin recargarla: la
 * lección de ayer con el botón dorado «Lección completada», o «Hoy» con la
 * fecha de ayer y «Encendida · Ya la hiciste hoy». Creía que ya había marcado
 * la de hoy, no salía ninguna marca, y al otro día el curso le decía que le
 * faltaba una. Cada día perdido venía justo después de un día en que marcó.
 *
 * Ahora, al volver a la app (o si se queda abierta pasada la medianoche):
 *  - Si cambió el día en Colombia, se carga todo de nuevo. Desde una lección o
 *    desde «Hoy» se va a «Hoy», que con datos frescos dice cuál toca.
 *  - Si es el mismo día pero estuvo fuera un buen rato, se relee el perfil.
 * No se recarga mientras suena un audio o un video (la lección narrada sigue
 * con la pantalla apagada) ni mientras se escribe: se espera a que termine.
 * Recargar no pierde marcas pendientes: viven en el celular y se reenvían
 * solas al cargar (ver marcas-pendientes.ts).
 */
export function AlDiaConElReloj() {
  const { firebaseUser, refrescarPerfil } = useAuth();
  // El día en que se cargó la página: se fija UNA vez, aunque el efecto de
  // abajo se vuelva a montar (por ejemplo, cuando termina de entrar la sesión).
  const diaDeCarga = useRef(bogotaDateStr(Date.now()));
  const releer = useRef(refrescarPerfil);
  releer.current = firebaseUser ? refrescarPerfil : async () => {};

  useEffect(() => {
    let ocultaDesde = document.visibilityState === "hidden" ? Date.now() : 0;

    const algoSuena = () =>
      [...document.querySelectorAll<HTMLMediaElement>("audio, video")].some((m) => !m.paused && !m.ended);
    const escribiendo = () => {
      const a = document.activeElement;
      return a instanceof HTMLTextAreaElement || (a instanceof HTMLInputElement && a.type !== "button");
    };

    const ponerAlDia = () => {
      const ruta = location.pathname;
      if (ruta.startsWith("/lecciones/") || ruta.startsWith("/hoy")) location.replace("/hoy/");
      else location.reload();
    };

    let yendo = false;
    /** `alVolver`: la persona acaba de regresar a la app (no es el reloj de cada minuto). */
    const revisar = (alVolver = true) => {
      if (document.visibilityState !== "visible" || yendo) return;
      if (bogotaDateStr(Date.now()) !== diaDeCarga.current) {
        if (algoSuena()) return; // se revisa otra vez en un minuto
        if (escribiendo()) {
          // Escribiendo en este instante (la app quedó a la vista a medianoche): no se interrumpe.
          if (!alVolver) return;
          // Volvió con el Cuaderno todavía activo desde ayer: al soltarlo se guarda
          // (el Cuaderno guarda al perder el foco) y luego se pone al día.
          (document.activeElement as HTMLElement | null)?.blur();
          yendo = true;
          window.setTimeout(ponerAlDia, 1500);
          return;
        }
        yendo = true;
        ponerAlDia();
        return;
      }
      if (ocultaDesde && Date.now() - ocultaDesde > AUSENCIA_LARGA) void releer.current().catch(() => {});
      ocultaDesde = 0;
    };

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "hidden") ocultaDesde = Date.now();
      else revisar();
    };
    // Chrome puede devolver la página guardada entera (bfcache) sin recargarla.
    const alMostrar = (e: PageTransitionEvent) => {
      if (e.persisted) revisar();
    };
    const alEnfocar = () => revisar();

    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("pageshow", alMostrar);
    window.addEventListener("focus", alEnfocar);
    // Por si se queda abierta y a la vista pasada la medianoche.
    const cadaMinuto = window.setInterval(() => revisar(false), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.removeEventListener("pageshow", alMostrar);
      window.removeEventListener("focus", alEnfocar);
      window.clearInterval(cadaMinuto);
    };
  }, []);

  return null;
}
