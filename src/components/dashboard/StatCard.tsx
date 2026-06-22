export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: string;
  tone?: "default" | "gold" | "aqua" | "warn";
  /** Si se pasa, la tarjeta se vuelve un botón que abre la lista. */
  onClick?: () => void;
}) {
  const toneRing: Record<string, string> = {
    default: "from-primary/15 to-primary/5 text-primary",
    gold: "from-gold/20 to-gold/5 text-gold",
    aqua: "from-aqua/20 to-aqua/5 text-aqua",
    warn: "from-warning/20 to-warning/5 text-warning",
  };

  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        {icon && (
          <span
            className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br ${toneRing[tone]}`}
            aria-hidden
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {onClick && (
        <p className="mt-2 text-xs font-semibold text-primary">Ver lista →</p>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="card w-full p-5 text-left transition hover:border-primary/50 hover:shadow-glow active:scale-[0.99]"
      >
        {body}
      </button>
    );
  }

  return <div className="card p-5">{body}</div>;
}
