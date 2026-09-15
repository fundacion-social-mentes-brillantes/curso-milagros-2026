"use client";

import { useEffect, useState } from "react";

/**
 * EL MENSAJE QUE EL ADMIN LE ESCRIBE A LA GENTE por WhatsApp.
 *
 * Por qué existe: escribir a mano "Hola Ana, ¿cómo vas con tu lección 42?" a
 * quince personas, una por una, no lo hace nadie dos semanas seguidas. Con una
 * plantilla, acompañar al grupo pasa a ser cuestión de un par de minutos.
 *
 * Por qué se puede editar y se recuerda: el tono lo pone quien acompaña, no la
 * app. Y como el mensaje que funciona suele repetirse, se guarda EN ESTE
 * NAVEGADOR (no en el servidor: es una nota personal de quien escribe, no un
 * dato del curso).
 *
 * Lo que NO hace, y conviene tener claro: no envía nada solo. Abre WhatsApp con
 * el texto puesto y la persona decide si lo manda. Mandar mensajes en masa sin
 * mirar es justo lo que convierte un acompañamiento en spam.
 */

export const PLANTILLA_POR_DEFECTO =
  "Hola {nombre} 🌅 ¿Cómo vas con tu lección {leccion}? Si necesitas algo, aquí estoy. 💛";

const CLAVE = "gemb.mensaje-acompanamiento";

/** Cambia {nombre} y {leccion} por los datos de cada persona. */
export function personalizar(
  plantilla: string,
  datos: { nombre: string; leccion: number },
): string {
  const soloNombre = datos.nombre.trim().split(/\s+/)[0] || datos.nombre.trim();
  return plantilla
    .replace(/\{nombre\}/gi, soloNombre)
    .replace(/\{leccion\}/gi, String(datos.leccion))
    .trim();
}

export function useMensajeGuardado() {
  const [mensaje, setMensaje] = useState(PLANTILLA_POR_DEFECTO);

  // Se lee después de montar: en el servidor no hay navegador donde guardar.
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE);
      if (guardado) setMensaje(guardado);
    } catch {
      /* si el navegador no deja guardar, se usa la plantilla de siempre */
    }
  }, []);

  const guardar = (texto: string) => {
    setMensaje(texto);
    try {
      window.localStorage.setItem(CLAVE, texto);
    } catch {
      /* no pasa nada: seguirá funcionando, solo que no se recordará */
    }
  };

  return { mensaje, guardar };
}

export function MensajeParaEscribir({
  mensaje,
  onCambiar,
}: {
  mensaje: string;
  onCambiar: (texto: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="border-b border-border bg-bg/30 px-4 py-3">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">
            Mensaje que vas a escribir
          </span>
          <span className="mt-0.5 block truncate text-sm text-fg">{mensaje}</span>
        </span>
        <span className="shrink-0 text-xs text-aqua">{abierto ? "Cerrar" : "Cambiar"}</span>
      </button>

      {abierto && (
        <div className="mt-3 animate-fade-in">
          <label htmlFor="plantilla-mensaje" className="sr-only">
            Mensaje para escribirle a cada persona
          </label>
          <textarea
            id="plantilla-mensaje"
            value={mensaje}
            onChange={(e) => onCambiar(e.target.value)}
            rows={3}
            maxLength={600}
            className="w-full resize-y rounded-xl border border-border bg-bg/60 p-3 text-sm leading-relaxed text-fg outline-none transition focus:border-aqua/60"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              <code className="rounded bg-surface-2 px-1">{"{nombre}"}</code> y{" "}
              <code className="rounded bg-surface-2 px-1">{"{leccion}"}</code> se cambian
              por los de cada persona.
            </p>
            <button
              onClick={() => onCambiar(PLANTILLA_POR_DEFECTO)}
              className="text-xs text-muted underline hover:text-fg"
            >
              Volver al de siempre
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Se abre WhatsApp con el texto escrito; tú decides si lo envías.
          </p>
        </div>
      )}
    </div>
  );
}
