"use client";

import { useState } from "react";

/**
 * Logo de la marca. Muestra /images/logo.png (claro) y /images/logo-white.png
 * (oscuro). Si aún no existen, cae a un texto/símbolo para no romper la barra.
 */
export function Logo({ className = "" }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">
          ✦
        </span>
        <span className="font-display text-lg font-bold">Un Curso de Milagros</span>
      </span>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.png"
        alt="Gimnasio Emocional Mentes Brillantes"
        onError={() => setFailed(true)}
        className={`block h-10 w-auto dark:hidden ${className}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo-white.png"
        alt="Gimnasio Emocional Mentes Brillantes"
        onError={(e) => {
          const t = e.currentTarget;
          t.onerror = null;
          t.src = "/images/logo.png";
        }}
        className={`hidden h-10 w-auto dark:block ${className}`}
      />
    </>
  );
}
