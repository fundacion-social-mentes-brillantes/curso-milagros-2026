"use client";

import { useCallback, useEffect, useState } from "react";
import { repasoDe } from "@/lib/repasos";
import { ideaDeLeccion } from "@/lib/idea-leccion";
import { SITE } from "@/config/site";

/**
 * EL MENSAJE QUE SE LE CUENTA AL GRUPO al terminar una lección.
 *
 * Corto por defecto, y a propósito: "Lección 115 hecha ✨". Antes iba con la
 * idea entrecomillada y el lema al final, tres párrafos. Eso está muy bien una
 * vez, pero esto se manda TODOS LOS DÍAS al mismo grupo: repetido, un texto
 * largo deja de leerse y empieza a estorbar. Una línea se lee siempre.
 *
 * Quien quiera más lo tiene a un toque: los comodines de abajo dejan armar
 * desde "Lección 115 hecha ✨" hasta el mensaje completo con la idea del día.
 */

export const CLAVE_MENSAJE = "gemb.mensaje-grupo";

export const PLANTILLA_POR_DEFECTO = "Lección {leccion} hecha {emoji}";

/** El único obligatorio: el mensaje siempre tiene que decir qué lección fue. */
export const COMODIN_OBLIGATORIO = "{leccion}";

export const COMODINES: { clave: string; que: string }[] = [
  { clave: "{leccion}", que: "el número de la lección" },
  { clave: "{emoji}", que: "un emoji que cambia con la lección" },
  { clave: "{total}", que: "las 365 del proceso" },
  { clave: "{idea}", que: "la idea del día (alarga bastante)" },
];

/**
 * Emojis serenos para el día a día. Se elige POR EL NÚMERO de la lección, no al
 * azar: así la misma lección tiene siempre el mismo, pero dos días seguidos no
 * salen iguales. Un emoji fijo cansa; uno aleatorio descoloca.
 */
const DEL_DIA = ["🌅", "🕊️", "💛", "🌻", "🌙", "⭐", "🍃", "🤍", "🌤️", "🫶"];

/**
 * Los días que marcan algo se lo merecen.
 *
 * Ojo: los emojis de aquí NO están en la lista de arriba, y es a propósito. Si
 * el 🌿 de los repasos saliera también un martes cualquiera, dejaría de querer
 * decir nada.
 */
function emojiDeLeccion(n: number): string {
  if (n === 1) return "🌱";
  if (n === SITE.totalLessons) return "🌟";
  if (n % 100 === 0) return "💫";
  if (n % 50 === 0) return "✨";
  // Los días de repaso no traen idea nueva: se vuelve sobre lo andado.
  if (repasoDe(n)) return "🌿";
  return DEL_DIA[n % DEL_DIA.length] ?? "✨";
}

/** Cambia los comodines por lo que toca en esa lección. */
export function armarMensaje(
  plantilla: string,
  datos: { numero: number; titulo: string },
): string {
  const { idea } = ideaDeLeccion(datos.titulo, datos.numero);
  return plantilla
    .replace(/\{leccion\}/gi, String(datos.numero))
    .replace(/\{emoji\}/gi, emojiDeLeccion(datos.numero))
    .replace(/\{total\}/gi, String(SITE.totalLessons))
    .replace(/\{idea\}/gi, idea || "")
    // Si alguien quita {idea} de en medio pueden quedar renglones vacíos.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** ¿Esta plantilla dice de qué lección se trata? */
export function llevaLaLeccion(plantilla: string): boolean {
  return /\{leccion\}/i.test(plantilla);
}

function leerGuardada(): string {
  try {
    const v = window.localStorage.getItem(CLAVE_MENSAJE);
    // Se ignora una plantilla guardada que haya perdido el número de lección:
    // es el único dato que el grupo necesita para entender el mensaje.
    if (v && llevaLaLeccion(v)) return v;
  } catch {
    /* navegador sin almacenamiento: se usa la de siempre */
  }
  return PLANTILLA_POR_DEFECTO;
}

/**
 * La plantilla guardada, lista para una pantalla.
 *
 * Se guarda en ESTE aparato, como el tema o el tamaño de la letra. Es una nota
 * personal de quien escribe, no un dato del curso.
 */
export function useMensajeGrupo() {
  const [plantilla, setPlantilla] = useState(PLANTILLA_POR_DEFECTO);

  // Se lee tras montar: si se leyera durante el render, lo que dibuja el
  // servidor y lo que dibuja el navegador no coincidirían.
  useEffect(() => {
    setPlantilla(leerGuardada());
  }, []);

  const guardar = useCallback((texto: string) => {
    setPlantilla(texto);
    try {
      window.localStorage.setItem(CLAVE_MENSAJE, texto);
    } catch {
      /* si no deja guardar, al menos vale mientras dure la visita */
    }
  }, []);

  return { plantilla, guardar };
}
