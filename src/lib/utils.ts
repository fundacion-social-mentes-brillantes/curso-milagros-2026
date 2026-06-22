/** Une clases condicionales sin dependencias externas. */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

const DATE_FMT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—";
  return DATE_FMT.format(new Date(ms));
}

export function formatDateTime(ms: number | null | undefined): string {
  if (!ms) return "—";
  return DATETIME_FMT.format(new Date(ms));
}

const DAY = 1000 * 60 * 60 * 24;

export function daysSince(ms: number | null | undefined): number {
  if (!ms) return Infinity;
  return Math.floor((Date.now() - ms) / DAY);
}

/** "hoy", "ayer", "hace 3 días"... */
export function relativeTime(ms: number | null | undefined): string {
  if (!ms) return "sin actividad";
  const d = daysSince(ms);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  if (d < 30) return `hace ${Math.floor(d / 7)} sem.`;
  if (d < 365) return `hace ${Math.floor(d / 30)} meses`;
  return `hace ${Math.floor(d / 365)} año(s)`;
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function clampLesson(n: number, total = 365): number {
  if (Number.isNaN(n)) return 1;
  return Math.min(Math.max(Math.trunc(n), 1), total);
}

/** Fecha "YYYY-MM-DD" en horario de Colombia (para agrupar el día igual para todos). */
const BOGOTA_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function bogotaDateStr(ms: number): string {
  return BOGOTA_DATE_FMT.format(new Date(ms));
}

/** Hora "7:35 a. m." en horario de Colombia. */
const TIME_FMT = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  hour: "2-digit",
  minute: "2-digit",
});
export function formatTime(ms: number | null | undefined): string {
  if (!ms) return "—";
  return TIME_FMT.format(new Date(ms));
}
