"use client";

import { useEffect, useRef } from "react";

/**
 * Un texto que se enciende palabra por palabra, del gris tenue al blanco, cuando
 * llega a la pantalla (como el párrafo del video). El texto es el mismo: solo
 * cambia el color de cada palabra. Con «menos movimiento» aparece completo.
 */
export function Revela({
  texto,
  como: Etiqueta = "p",
  className = "",
  retraso = 0,
  ritmo = 70,
}: {
  texto: string;
  como?: "p" | "h1" | "h2" | "span";
  className?: string;
  /** Milisegundos antes de empezar. */
  retraso?: number;
  /** Milisegundos entre una palabra y la siguiente. */
  ritmo?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const palabras = Array.from(el.querySelectorAll<HTMLElement>(".p"));
    const quieto =
      document.documentElement.dataset.movimiento === "poco" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto) {
      palabras.forEach((p) => p.classList.add("on"));
      return;
    }
    const tiempos: ReturnType<typeof setTimeout>[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        palabras.forEach((p, i) => tiempos.push(setTimeout(() => p.classList.add("on"), retraso + i * ritmo)));
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      tiempos.forEach(clearTimeout);
    };
  }, [texto, retraso, ritmo]);

  const partes = texto.split(/(\s+)/);
  return (
    <Etiqueta ref={ref as never} className={`revela ${className}`}>
      <span className="sr-only">{texto}</span>
      <span aria-hidden>
        {partes.map((parte, i) =>
          /^\s+$/.test(parte) ? (
            parte
          ) : (
            <span key={i} className="p">
              {parte}
            </span>
          ),
        )}
      </span>
    </Etiqueta>
  );
}

/**
 * Hace que los hijos con la clase `.enciende` pasen de tenues a plenos al llegar
 * a ellos al bajar por la página (el texto original se va iluminando al leerlo).
 */
export function useEncender(dep: unknown) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".enciende:not(.on)"));
    const quieto =
      document.documentElement.dataset.movimiento === "poco" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto || !("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("on"));
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("on");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [dep]);
}
