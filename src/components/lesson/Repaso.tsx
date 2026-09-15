"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { repasoDe } from "@/lib/repasos";

/**
 * LO QUE SE REPASA HOY.
 *
 * Aparece solo los días de repaso (69 de los 365). El problema que resuelve:
 * esos días la lección se titula "El repaso de hoy abarca las siguientes
 * ideas:" y, tal cual, no dice nada —hay que ponerse a buscar cuáles eran—.
 *
 * Aquí se muestran las ideas que toca repasar, con su número y un enlace para
 * ir a cada una. Se enseña la FRASE, no solo el número: "lección 11" no
 * significa nada, pero "Mis pensamientos sin significado me están mostrando un
 * mundo sin significado" sí. El número queda al lado para quien quiera ir.
 */

interface EntradaIndice {
  number: number;
  title: string;
}

export function Repaso({ lessonNumber }: { lessonNumber: number }) {
  const repaso = repasoDe(lessonNumber);
  const [titulos, setTitulos] = useState<Map<number, string> | null>(null);

  useEffect(() => {
    if (!repaso) return;
    let vivo = true;
    fetch("/lessons/index.json", { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: EntradaIndice[]) => {
        if (!vivo || !Array.isArray(lista)) return;
        setTitulos(new Map(lista.map((l) => [Number(l.number), String(l.title ?? "")])));
      })
      .catch(() => {
        /* sin el índice se enseñan los números igual */
      });
    return () => {
      vivo = false;
    };
  }, [repaso]);

  if (!repaso) return null;

  const cuantas = repaso.lecciones.length;

  return (
    <section className="card animate-fade-in overflow-hidden p-0">
      <div className="h-1 w-full bg-gradient-to-r from-gold via-aqua to-gold" />
      <div className="p-5 sm:p-6">
        <p className="section-eyebrow">{repaso.nombre}</p>
        <h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">
          Hoy vuelves sobre {cuantas === 1 ? "esta idea" : `estas ${cuantas} ideas`}
        </h2>
        <p className="mt-1 text-sm text-muted">
          No hay idea nueva: hoy se trata de volver a lo que ya caminaste. Toca
          cualquiera para releerla entera.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {repaso.lecciones.map((n) => {
            const idea = titulos?.get(n) ?? "";
            return (
              <li key={n}>
                <Link
                  href={`/lecciones/${n}`}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-bg/40 p-3 transition hover:border-aqua/50 hover:bg-bg/70"
                >
                  <span className="mt-0.5 shrink-0 rounded-lg bg-aqua/15 px-2.5 py-1 text-xs font-bold tabular-nums text-aqua">
                    {n}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug text-fg">
                      {idea || `Lección ${n}`}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted opacity-0 transition group-hover:opacity-100">
                      Ir a la lección {n} →
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
