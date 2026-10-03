"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { getLessonByNumber } from "@/lib/lessons";
import { getLessonProgress } from "@/lib/progress";
import { ideaDeLeccion } from "@/lib/idea-leccion";
import { PageLoader } from "@/components/ui/Spinner";
import { SITE } from "@/config/site";

/** «Hoy · viernes 2 de octubre», con la fecha de Colombia. */
function fechaDeHoy(): string {
  const f = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  }).format(new Date());
  return `Hoy · ${f.replace(",", "")}`;
}

const ATAJOS = [
  { id: "escucha", label: "Escucha", d: "M4.5 14.5v-2a7.5 7.5 0 0 1 15 0v2M3.6 13.6h3.6v5.6H3.6zM16.8 13.6h3.6v5.6h-3.6z" },
  { id: "lee", label: "Lee", d: "M12 7.2C10 5.7 7 5.3 3.4 5.7v12c3.6-.4 6.6.1 8.6 1.5 2-1.4 5-1.9 8.6-1.5v-12C17 5.3 14 5.7 12 7.2ZM12 7.2v12" },
  { id: "video", label: "Video", d: "M6.8 5.6h10.4a3.6 3.6 0 0 1 3.6 3.6v5.6a3.6 3.6 0 0 1-3.6 3.6H6.8a3.6 3.6 0 0 1-3.6-3.6V9.2a3.6 3.6 0 0 1 3.6-3.6ZM10.4 9.5v5l4.3-2.5-4.3-2.5Z" },
  { id: "comenta", label: "Comentarios", d: "M20 11.6c0 4-3.6 7-8 7-1.2 0-2.3-.2-3.3-.6L4.4 19.4l1.2-3.4C4.6 14.8 4 13.3 4 11.6c0-4 3.6-7 8-7s8 3 8 7Z" },
];

/**
 * HOY: la lección en la que va la persona es la protagonista. El número en un
 * disco de vidrio con su halo que respira, la frase del día y un solo botón para
 * empezar. Los atajos llevan directo a cada parte de la lección (que es una
 * sola página).
 */
function HoyInner() {
  const { appUser } = useAuth();
  const n = Math.min(Math.max(appUser?.currentLesson || 1, 1), SITE.totalLessons);
  const [titulo, setTitulo] = useState<string | null>(null);
  const [hecha, setHecha] = useState(false);

  useEffect(() => {
    let vivo = true;
    getLessonByNumber(n)
      .then((l) => vivo && setTitulo(l?.title ?? ""))
      .catch(() => vivo && setTitulo(""));
    if (appUser) getLessonProgress(appUser.uid, n).then((p) => vivo && setHecha(Boolean(p?.completed)));
    return () => {
      vivo = false;
    };
  }, [n, appUser?.uid]);

  if (!appUser || titulo === null) return <PageLoader label="Preparando tu lección de hoy…" />;
  const { idea } = ideaDeLeccion(titulo, n);

  return (
    <div className="container-page pb-10 pt-2 text-center md:pt-4">
      <p className="etiqueta aparece">{fechaDeHoy()}</p>

      <div className="disco-hoy vidrio aparece mx-auto mt-7 w-[15rem] [animation-delay:.1s] md:w-[17rem]">
        <div>
          <span className="etiqueta block text-fg/70">Lección</span>
          <span className="numero-luz my-1 block text-[6.2rem] md:text-[7.2rem]">{n}</span>
          <span className="block text-sm text-muted">de {SITE.totalLessons}</span>
        </div>
      </div>

      {idea && (
        <h1 className="frase-luz aparece mx-auto mt-9 max-w-[22rem] text-[1.75rem] leading-[1.25] [animation-delay:.25s] md:max-w-[36rem] md:text-[2.35rem]">
          {idea}
        </h1>
      )}
      {hecha && (
        <p className="aparece mt-4 inline-flex items-center gap-2 text-sm font-medium text-gold [animation-delay:.3s]">
          <span aria-hidden>✓</span> Lección completada
        </p>
      )}

      <div className="aparece mt-8 [animation-delay:.35s]">
        <Link href={`/lecciones/${n}`} className="boton-cristal">
          {hecha ? "Volver a la lección" : "Empezar la lección"}
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
            <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />
          </svg>
        </Link>
      </div>

      <div className="aparece mx-auto mt-6 flex max-w-sm flex-wrap justify-center gap-2 [animation-delay:.45s] md:max-w-none">
        {ATAJOS.map((a) => (
          <Link
            key={a.id}
            href={`/lecciones/${n}#${a.id}`}
            className="vidrio inline-flex items-center gap-2 rounded-full py-2 pl-3 pr-4 text-sm font-medium text-muted hover:text-fg"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-gold" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={a.d} />
            </svg>
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function HoyPage() {
  return (
    <RouteGuard>
      <HoyInner />
    </RouteGuard>
  );
}
