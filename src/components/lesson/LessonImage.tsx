"use client";

import { useState } from "react";
import { lessonDocId } from "@/config/lessons.links";

/**
 * Imagen de referencia de la lección: /images/lecciones/{id}.webp
 *
 * WebP y 1280 px de ancho: las mismas 365 imágenes pasaron de 462 MB a 74 MB
 * (84% menos), que en celular con datos contados se nota muchísimo.
 * `decoding="async"` y las medidas fijas evitan que la página "salte" al cargar.
 */
export function LessonImage({ number, title }: { number: number; title: string }) {
  const [shown, setShown] = useState(true);
  if (!shown) return null;

  return (
    <figure className="overflow-hidden rounded-2xl border border-border shadow-soft animate-fade-in">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/images/lecciones/${lessonDocId(number)}.webp`}
        alt={`Imagen de referencia de la lección ${number}: ${title}`}
        width={1280}
        height={720}
        loading="lazy"
        decoding="async"
        onError={() => setShown(false)}
        className="aspect-[16/9] w-full object-cover"
      />
    </figure>
  );
}
