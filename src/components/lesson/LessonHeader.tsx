import Link from "next/link";
import { formatDate } from "@/lib/utils";

export function LessonHeader({
  number,
  title,
  completed,
  completedAt,
}: {
  number: number;
  title: string;
  completed: boolean;
  completedAt?: number | null;
}) {
  return (
    <div className="animate-fade-up">
      <Link
        href="/lecciones"
        className="text-sm font-semibold text-muted transition hover:text-fg"
      >
        ← Todas las lecciones
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">Lección {number} de 365</p>
          <h1 className="mt-1 max-w-3xl font-display text-3xl font-bold leading-tight sm:text-4xl">
            {title || `Lección ${number}`}
          </h1>
        </div>
        {completed ? (
          <span className="badge bg-success/15 text-success">
            ✓ Realizada {completedAt ? `· ${formatDate(completedAt)}` : ""}
          </span>
        ) : (
          <span className="badge bg-gold/15 text-gold">Pendiente</span>
        )}
      </div>
    </div>
  );
}
