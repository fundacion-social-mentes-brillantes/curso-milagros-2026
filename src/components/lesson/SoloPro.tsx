"use client";

/**
 * Tarjeta que aparece en lugar del contenido reservado al plan Pro.
 * No esconde: MUESTRA lo que se está perdiendo, con cariño y sin culpar
 * a nadie (mucha gente del proceso no puede pagar, y el texto del Curso
 * y su guía siguen siendo gratis para todos).
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
  return (
    <div className="card relative overflow-hidden border-gold/30 bg-gradient-to-br from-gold/10 via-surface to-primary/10 p-6 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-gold blur-2xl" />
        <div className="absolute -bottom-10 -left-6 h-40 w-40 rounded-full bg-primary blur-2xl" />
      </div>

      <div className="relative">
        <span className="badge bg-gold/20 text-gold">★ Plan Pro</span>

        <p className="mt-3 text-3xl" aria-hidden>
          {icono}
        </p>
        <h3 className="mt-1 font-display text-lg font-bold">{titulo}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{descripcion}</p>

        <div className="mx-auto mt-4 max-w-sm rounded-xl border border-border bg-surface-2/60 p-3 text-left">
          <p className="text-xs font-semibold text-fg/80">Con el plan Pro tienes:</p>
          <ul className="mt-1.5 space-y-1 text-xs text-muted">
            <li>🎬 El video de cada lección</li>
            <li>🎧 La lección narrada en voz alta</li>
            <li>🕊️ Lumi, tu acompañante del Curso</li>
            <li>🏆 Tu puesto y logros del día</li>
          </ul>
        </div>

        <p className="mt-4 text-xs text-muted">
          ¿Ya aportaste y aún lo ves así? Escríbele a quien te inscribió para que
          active tu acceso 💚
        </p>
      </div>
    </div>
  );
}
