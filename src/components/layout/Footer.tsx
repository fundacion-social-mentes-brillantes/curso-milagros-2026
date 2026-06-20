import { SITE } from "@/config/site";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border/70">
      <div className="container-page flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
        <p className="font-display text-base text-fg">{SITE.org}</p>
        <p className="max-w-md">{SITE.tagline}</p>
        <p className="text-xs">
          Proceso {SITE.courseYear} · {SITE.totalLessons} lecciones · Hecho con calma 🌅
        </p>
      </div>
    </footer>
  );
}
