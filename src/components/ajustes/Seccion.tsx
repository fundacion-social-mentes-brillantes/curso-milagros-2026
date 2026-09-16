"use client";

/** Caja con título para cada bloque de ajustes. Solo para no repetir marcado. */
export function Seccion({
  icono,
  titulo,
  descripcion,
  children,
}: {
  icono: string;
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-border p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <span aria-hidden>{icono}</span>
          {titulo}
        </h2>
        {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Una fila con su etiqueta a la izquierda y el control a la derecha. */
export function Fila({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">{titulo}</p>
        {ayuda && <p className="mt-0.5 text-xs text-muted">{ayuda}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Grupo de botones donde solo uno queda marcado.
 *
 * Se usa `radiogroup` de verdad y no botones sueltos para que un lector de
 * pantalla anuncie "opción 2 de 3" en vez de leer tres botones sin relación.
 */
export function Opciones<T extends string>({
  valor,
  opciones,
  onCambiar,
  etiqueta,
}: {
  valor: T;
  opciones: { id: T; nombre: string }[];
  onCambiar: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex flex-wrap gap-1.5">
      {opciones.map((o) => {
        const activa = o.id === valor;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={activa}
            onClick={() => onCambiar(o.id)}
            className={
              activa
                ? "rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-fg"
                : "rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-fg"
            }
          >
            {o.nombre}
          </button>
        );
      })}
    </div>
  );
}
