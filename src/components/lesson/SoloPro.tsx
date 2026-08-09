"use client";

import { BENEFICIOS_PORTADOR, PLAN_INFO } from "@/config/planes";

/**
 * Tarjeta que aparece en lugar del contenido reservado a quien sostiene el
 * proceso (Portador de Luz). No esconde: MUESTRA lo que hay, con cariño y sin
 * hacer sentir menos a nadie —el texto del Curso y su guía siguen siendo
 * gratis para todo el mundo, siempre.
 */
export function SoloPro({
  titulo,
  descripcion,
  icono = "✨",
}: {
  titulo: string;
  descripcion: string;
  icono?: string;
}) {
  const portador = PLAN_INFO.pro;

  return (
    <div className="card relative overflow-hidden border-gold/30 bg-gradient-to-br from-gold/10 via-surface to-primary/10 text-center">
      {/* La imagen que identifica al Portador de Luz */}
      <div className="relative h-32 w-full overflow-hidden sm:h-40">
        <img
          src={portador.imagen}
          alt=""
          aria-hidden
          className="h-full w-full object-cover object-center"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
      </div>

      <div className="relative -mt-6 px-6 pb-6">
        <span className="badge bg-gold/20 text-gold">
          {portador.emoji} {portador.nombre}
        </span>

        <p className="mt-3 text-2xl" aria-hidden>
          {icono}
        </p>
        <h3 className="mt-1 font-display text-lg font-bold">{titulo}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{descripcion}</p>

        <div className="mx-auto mt-4 max-w-sm rounded-xl border border-border bg-surface-2/60 p-3 text-left">
          <p className="text-xs font-semibold text-fg/80">
            Quien sostiene el proceso también recibe:
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-muted">
            {BENEFICIOS_PORTADOR.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-xs text-muted">
          Tu aporte no compra el Curso: sostiene el camino de quienes no pueden
          aportar. Si ya aportaste y aún lo ves así, avísale a quien te inscribió 💚
        </p>
      </div>
    </div>
  );
}
