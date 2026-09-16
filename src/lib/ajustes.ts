"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * LOS AJUSTES QUE VIVEN EN EL NAVEGADOR.
 *
 * Tema, tamaño de la lectura y animaciones. Los tres se guardan aquí y no en
 * el servidor, y es a propósito: son preferencias DEL APARATO, no de la
 * persona. Alguien puede querer el tema oscuro en el celular de noche y el
 * claro en el computador del trabajo; si se guardaran en su cuenta, cambiar
 * uno le cambiaría el otro.
 *
 * Lo que sí es de la persona (su nombre, su WhatsApp) va al servidor por la
 * ruta de siempre. Ver `src/app/ajustes/page.tsx`.
 */

export const CLAVES = {
  tema: "gemb.tema",
  texto: "gemb.texto",
  movimiento: "gemb.movimiento",
} as const;

export type Tema = "esmeralda" | "claro" | "rosa" | "auto";
export type Texto = "normal" | "grande" | "enorme";
export type Movimiento = "normal" | "poco";

export interface Ajustes {
  tema: Tema;
  texto: Texto;
  movimiento: Movimiento;
}

export const POR_DEFECTO: Ajustes = {
  tema: "esmeralda",
  texto: "normal",
  movimiento: "normal",
};

/** Los temas tal como se ven en la pantalla de ajustes. */
export const TEMAS: {
  id: Tema;
  nombre: string;
  descripcion: string;
  /** Tres colores para la bolita de muestra: fondo, tarjeta y acento. */
  muestra: [string, string, string];
  oscuro: boolean;
}[] = [
  {
    id: "esmeralda",
    nombre: "Esmeralda",
    descripcion: "El de siempre. Verde profundo y dorado.",
    muestra: ["#092622", "#0f3630", "#e2c67c"],
    oscuro: true,
  },
  {
    id: "claro",
    nombre: "Claro",
    descripcion: "Crema y verde, como un amanecer.",
    muestra: ["#f0f4ed", "#ffffff", "#166e60"],
    oscuro: false,
  },
  {
    id: "rosa",
    nombre: "Rosa pastel",
    descripcion: "Rosado suave que se abre a blanco.",
    muestra: ["#fdf6f9", "#ffffff", "#b04a7a"],
    oscuro: false,
  },
  {
    id: "auto",
    nombre: "Automático",
    descripcion: "Sigue lo que tenga puesto tu teléfono o computador.",
    muestra: ["#092622", "#f0f4ed", "#4fc4ae"],
    oscuro: true,
  },
];

const TEMAS_VALIDOS: Tema[] = ["esmeralda", "claro", "rosa", "auto"];
const TEXTOS_VALIDOS: Texto[] = ["normal", "grande", "enorme"];

/** "auto" no es un tema de verdad: aquí se traduce al que toca ahora mismo. */
export function temaEfectivo(tema: Tema): Exclude<Tema, "auto"> {
  if (tema !== "auto") return tema;
  const prefiereOscuro =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefiereOscuro ? "esmeralda" : "claro";
}

function leerClave<T extends string>(clave: string, validos: T[], respaldo: T): T {
  try {
    const v = window.localStorage.getItem(clave) as T | null;
    return v && validos.includes(v) ? v : respaldo;
  } catch {
    // Navegador en modo privado o con el almacenamiento bloqueado: se usa lo
    // de siempre en vez de reventar.
    return respaldo;
  }
}

export function leerAjustes(): Ajustes {
  if (typeof window === "undefined") return POR_DEFECTO;
  return {
    tema: leerClave(CLAVES.tema, TEMAS_VALIDOS, POR_DEFECTO.tema),
    texto: leerClave(CLAVES.texto, TEXTOS_VALIDOS, POR_DEFECTO.texto),
    movimiento: leerClave<Movimiento>(
      CLAVES.movimiento,
      ["normal", "poco"],
      POR_DEFECTO.movimiento,
    ),
  };
}

/** Deja el documento con la pinta que digan los ajustes. */
export function aplicar(a: Ajustes): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const efectivo = temaEfectivo(a.tema);

  html.setAttribute("data-tema", efectivo);
  // La clase `dark` la siguen necesitando las pocas utilidades `dark:` que
  // quedan (el logo tiene versión clara y oscura).
  html.classList.toggle("dark", efectivo === "esmeralda");
  html.setAttribute("data-texto", a.texto);
  html.setAttribute("data-movimiento", a.movimiento);

  // La barra del navegador en el celular, para que no quede un borde de otro
  // color encima de la página.
  const barra = getComputedStyle(html).getPropertyValue("--barra").trim();
  if (barra) {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = barra;
  }
}

/**
 * El guioncito que va en el <head>, ANTES de que se pinte nada.
 *
 * Sin esto la página aparecería un instante en esmeralda y saltaría al tema
 * elegido: ese parpadeo se ve feo y despista. Va en texto plano porque React
 * todavía no existe cuando corre.
 *
 * Se mantiene diminuto y envuelto en try: si falla, la página se queda con el
 * tema de siempre, que es justo lo que ya trae el HTML.
 */
export const GUION_ANTI_PARPADEO = `
(function(){try{
var t=localStorage.getItem('${CLAVES.tema}')||'${POR_DEFECTO.tema}';
if(t==='auto'){t=matchMedia('(prefers-color-scheme: dark)').matches?'esmeralda':'claro';}
if(['esmeralda','claro','rosa'].indexOf(t)<0){t='${POR_DEFECTO.tema}';}
var h=document.documentElement;
h.setAttribute('data-tema',t);
h.classList.toggle('dark',t==='esmeralda');
var x=localStorage.getItem('${CLAVES.texto}');
if(x)h.setAttribute('data-texto',x);
var m=localStorage.getItem('${CLAVES.movimiento}');
if(m)h.setAttribute('data-movimiento',m);
}catch(e){}})();
`.trim();

/**
 * Los ajustes, listos para una pantalla de React.
 *
 * Empieza siempre con los valores por defecto y lee el navegador después de
 * montar: si leyera durante el render, lo que dibuja el servidor y lo que
 * dibuja el navegador no coincidirían y React se quejaría.
 */
export function useAjustes() {
  const [ajustes, setAjustes] = useState<Ajustes>(POR_DEFECTO);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const a = leerAjustes();
    setAjustes(a);
    aplicar(a);
    setListo(true);
  }, []);

  // Con el tema en "automático", seguir al aparato cuando cambie de humor
  // (muchos teléfonos pasan solos a oscuro al anochecer).
  useEffect(() => {
    if (ajustes.tema !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => aplicar(ajustes);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, [ajustes]);

  const cambiar = useCallback(<K extends keyof Ajustes>(campo: K, valor: Ajustes[K]) => {
    setAjustes((previos) => {
      const nuevos = { ...previos, [campo]: valor };
      try {
        window.localStorage.setItem(CLAVES[campo], valor);
      } catch {
        // Si no deja guardar, al menos se aplica mientras dure la visita.
      }
      aplicar(nuevos);
      return nuevos;
    });
  }, []);

  return { ajustes, cambiar, listo };
}
