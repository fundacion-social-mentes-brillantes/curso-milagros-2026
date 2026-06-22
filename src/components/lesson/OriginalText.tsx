import type { Lesson } from "@/types";

/**
 * Texto ORIGINAL del Curso. Se renderiza tal cual, sin transformaciones.
 * Esta zona NUNCA debe mezclar comentario ni reescribir el contenido.
 */
export function OriginalText({ lesson }: { lesson: Lesson }) {
  const hasText = lesson.originalTextLoaded && lesson.originalText.trim().length > 0;

  return (
    <section className="card overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-gold via-gold-soft to-aqua" />
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-5 py-3 sm:px-7">
        <div className="flex items-center gap-2">
          <span aria-hidden>📖</span>
          <h2 className="font-display text-base font-semibold">Texto original de la lección</h2>
        </div>
        <span className="badge bg-aqua/15 text-aqua">Sin modificaciones</span>
      </header>

      <div className="px-5 py-6 sm:px-7 sm:py-8">
        {hasText ? (
          <article className="reading mx-auto max-w-prose">{lesson.originalText}</article>
        ) : (
          <div className="mx-auto max-w-prose rounded-xl border border-dashed border-border bg-surface-2/40 p-6 text-center">
            <p className="text-2xl" aria-hidden>
              🕯️
            </p>
            <p className="mt-2 font-semibold">El texto original se cargará pronto</p>
            <p className="mt-1 text-sm text-muted">
              Esta lección todavía no tiene su texto original importado.
            </p>
            {lesson.sourceUrl && (
              <a
                href={lesson.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                Ver la fuente del texto ↗
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
