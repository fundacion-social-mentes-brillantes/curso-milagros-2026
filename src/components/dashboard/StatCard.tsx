export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: string;
  tone?: "default" | "gold" | "aqua" | "warn";
}) {
  const toneRing: Record<string, string> = {
    default: "from-primary/15 to-primary/5 text-primary",
    gold: "from-gold/20 to-gold/5 text-gold",
    aqua: "from-aqua/20 to-aqua/5 text-aqua",
    warn: "from-warning/20 to-warning/5 text-warning",
  };
  return (
    <div className="card p-5">
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
    </div>
  );
}
