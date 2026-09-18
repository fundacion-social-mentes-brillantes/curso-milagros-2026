"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { armarMensaje, useMensajeGrupo } from "@/lib/mensaje-grupo";

/**
 * "Cuéntaselo al grupo": al terminar la lección, ofrece un mensaje ya escrito
 * para compartir por WhatsApp.
 *
 * Por qué el mensaje se puede editar: lo que cada quien quiere contarle a su
 * grupo no es siempre lo mismo. Unos días basta con "lección hecha" y otros
 * apetece decir algo propio. Obligar a mandar un texto idéntico cada día
 * convierte el gesto en spam; poder tocarlo lo devuelve a ser algo personal.
 *
 * OJO con una limitación de WhatsApp, por si alguien pregunta: ninguna página
 * web puede mandar un mensaje a un grupo concreto por su cuenta —WhatsApp no lo
 * permite, y está bien que sea así—. Lo que sí se puede es abrir WhatsApp con
 * el mensaje ya escrito para que la persona elija a quién se lo manda. Por eso
 * el botón dice "elige tu grupo".
 */

export function CompartirWhatsApp({
  lessonNumber,
  title,
}: {
  lessonNumber: number;
  title: string;
}) {
  const { plantilla } = useMensajeGrupo();
  const [texto, setTexto] = useState("");
  const [tocado, setTocado] = useState(false);
  const [abierto, setAbierto] = useState(false);

  /*
   * El mensaje se arma con la plantilla que la persona tenga puesta en Ajustes.
   * Esa plantilla llega del almacenamiento del navegador, o sea DESPUÉS del
   * primer dibujo: por eso se rehace aquí en vez de fijarlo con useState.
   *
   * `tocado` existe para no pisar lo que esté escribiendo: en cuanto cambia el
   * texto a mano, la plantilla deja de mandar.
   */
  useEffect(() => {
    if (tocado) return;
    setTexto(armarMensaje(plantilla, { numero: lessonNumber, titulo: title }));
  }, [plantilla, lessonNumber, title, tocado]);

  const limpio = texto.trim();
  const enlace = `https://wa.me/?text=${encodeURIComponent(limpio)}`;

  return (
    <div className="mt-4 w-full max-w-md text-left">
      {!abierto ? (
        <button
          onClick={() => setAbierto(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#25D366]/50 bg-[#25D366]/10 px-5 py-3 text-sm font-bold text-[#25D366] transition hover:bg-[#25D366]/20 active:scale-[0.98]"
        >
          <IconoWhatsApp />
          Contarle al grupo
        </button>
      ) : (
        <div className="animate-fade-in rounded-2xl border border-border bg-bg/40 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-sm font-bold">Tu mensaje</p>
            <span className="text-xs text-muted">puedes cambiarlo</span>
          </div>

          <label htmlFor="mensaje-grupo" className="sr-only">
            Mensaje para el grupo
          </label>
          <textarea
            id="mensaje-grupo"
            value={texto}
            onChange={(e) => {
              setTocado(true);
              setTexto(e.target.value);
            }}
            rows={4}
            maxLength={900}
            className="mt-2 w-full resize-y rounded-xl border border-border bg-bg/60 p-3 text-sm leading-relaxed text-fg outline-none transition focus:border-aqua/60"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={limpio ? enlace : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!limpio}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold text-[rgb(6_40_24)] shadow-glow transition hover:brightness-110 active:scale-[0.98] ${
                limpio ? "" : "pointer-events-none opacity-50"
              }`}
            >
              <IconoWhatsApp />
              Abrir WhatsApp
            </a>
            <button
              onClick={() => {
                setTocado(false);
                setTexto(armarMensaje(plantilla, { numero: lessonNumber, titulo: title }));
              }}
              className="btn-ghost px-4 py-3 text-sm"
            >
              Restaurar
            </button>
          </div>

          <p className="mt-2 text-center text-xs text-muted">
            Se abre WhatsApp con el mensaje listo y ahí eliges tu grupo.{" "}
            <Link href="/ajustes" className="text-aqua underline-offset-2 hover:underline">
              Cambiar el mensaje de siempre
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function IconoWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.14-.14.3-.36.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.02h-.01c-1.52 0-3.01-.41-4.31-1.18l-.31-.18-3.2.84.85-3.12-.2-.32a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.83 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.24 8.22z" />
    </svg>
  );
}
