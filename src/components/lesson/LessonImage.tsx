"use client";

import { useState } from "react";
import { lessonDocId } from "@/config/lessons.links";

/**
 * Imagen de referencia de la lección. Busca /images/lecciones/{id}.png
 * (p. ej. 001.png). Si no existe todavía, no muestra nada (sin romper nada).
 */
export function LessonImage({ number, title }: { number: number; title: string }) {
  const [shown, setShown] = useState(true);
  if (!shown) return null;

  return (
    <figure className="overflow-hidden rounded-2xl border border-border shadow-soft animate-fade-in">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/images/lecciones/${lessonDocId(number)}.png`}
        alt={`Imagen de referencia de la lección ${number}: ${title}`}
        loading="lazy"
        onError={() => setShown(false)}
        className="aspect-[16/9] w-full object-cover"
      />
    </figure>
  );
}
