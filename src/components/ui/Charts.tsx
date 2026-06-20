import { pct } from "@/lib/utils";

/** Barra horizontal etiquetada (progreso individual). */
export function BarRow({
  label,
  value,
  max,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  hint?: string;
}) {
  const p = pct(value, max);
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-sm" title={label}>
        {label}
      </div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-all"
          style={{ width: `${p}%` }}
        />
      </div>
      <div className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
        {hint ?? `${p}%`}
      </div>
    </div>
  );
}

/** Histograma vertical simple a partir de buckets. */
export function Histogram({
  buckets,
}: {
  buckets: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return (
    <div className="flex items-end gap-2" style={{ height: 160 }}>
      {buckets.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-primary/70 to-gold/80 transition-all"
              style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value > 0 ? 6 : 0 }}
              title={`${b.value}`}
            />
          </div>
          <span className="text-[10px] font-semibold tabular-nums text-muted">{b.value}</span>
          <span className="text-[10px] text-muted">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Agrupa números de lección (1..365) en tramos para el histograma. */
export function bucketLessons(lessonNumbers: number[]): {
  label: string;
  value: number;
}[] {
  const ranges = [
    [1, 60],
    [61, 120],
    [121, 180],
    [181, 240],
    [241, 300],
    [301, 365],
  ] as const;
  return ranges.map(([from, to]) => ({
    label: `${from}-${to}`,
    value: lessonNumbers.filter((n) => n >= from && n <= to).length,
  }));
}
