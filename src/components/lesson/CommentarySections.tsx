import type { LessonCommentary } from "@/types";

function Paragraphs({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim().length > 0);
  return (
    <>
      {blocks.map((b, i) => (
        <p key={i} className="whitespace-pre-line leading-relaxed text-fg/90">
          {b}
        </p>
      ))}
    </>
  );
}

function Section({
  eyebrow,
  title,
  icon,
  children,
  highlight = false,
}: {
  eyebrow?: string;
  title: string;
  icon: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <section
      className={`card scroll-mt-20 p-6 sm:p-7 ${
        highlight ? "bg-gradient-to-br from-primary/10 to-gold/10" : ""
      }`}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/12 text-lg" aria-hidden>
          {icon}
        </span>
        <div>
          {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
          <h2 className="font-display text-xl font-bold">{title}</h2>
        </div>
      </div>
      <div className="space-y-3 text-[0.975rem]">{children}</div>
    </section>
  );
}

export function CommentarySections({
  commentary,
  ready,
}: {
  commentary: LessonCommentary;
  ready: boolean;
}) {
  const c = commentary;
  const hasAny =
    ready ||
    c.teachingExplanation ||
    c.purpose ||
    c.practicalInstructions.length > 0;

  if (!hasAny) {
    return (
      <div className="card flex flex-col items-center gap-2 p-8 text-center">
        <span className="text-3xl" aria-hidden>
          ✍️
        </span>
        <p className="font-display text-lg font-semibold">Contenido en preparación</p>
        <p className="max-w-md text-sm text-muted">
          La guía de esta lección se está escribiendo con cariño. Por ahora puedes ver el video y
          leer el texto original.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {c.teachingExplanation && (
        <Section eyebrow="La enseñanza" title="¿Qué me enseña esta lección?" icon="💡">
          <Paragraphs text={c.teachingExplanation} />
        </Section>
      )}

      {c.purpose && (
        <Section eyebrow="Hacia dónde apunta" title="Propósito y sentido" icon="🎯">
          <Paragraphs text={c.purpose} />
        </Section>
      )}

      {c.practicalInstructions.length > 0 && (
        <Section eyebrow="Cómo practicarla hoy" title="Instrucciones prácticas" icon="🧭">
          <ol className="space-y-3">
            {c.practicalInstructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/20 text-xs font-bold text-gold">
                  {i + 1}
                </span>
                <span className="whitespace-pre-line leading-relaxed text-fg/90">{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {(c.psychological || c.spiritual) && (
        <Section
          eyebrow="Dos miradas"
          title="Aspectos psicológicos y espirituales"
          icon="🌗"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {c.psychological && (
              <div className="rounded-xl bg-surface-2/60 p-4">
                <p className="mb-1 text-sm font-bold text-primary">🧠 Psicológico</p>
                <Paragraphs text={c.psychological} />
              </div>
            )}
            {c.spiritual && (
              <div className="rounded-xl bg-surface-2/60 p-4">
                <p className="mb-1 text-sm font-bold text-aqua">🕊️ Espiritual</p>
                <Paragraphs text={c.spiritual} />
              </div>
            )}
          </div>
        </Section>
      )}

      {c.courseRelation && (
        <Section eyebrow="El hilo del proceso" title="Relación con el resto del Curso" icon="🔗">
          <Paragraphs text={c.courseRelation} />
        </Section>
      )}

      {(c.practiceTips ?? []).length > 0 && (
        <Section eyebrow="Para que te fluya" title="Consejos para la práctica" icon="🌼">
          <ul className="space-y-2">
            {(c.practiceTips ?? []).map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 text-primary">•</span>
                <span className="leading-relaxed text-fg/90">{t}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(c.dailyExamples ?? []).length > 0 && (
        <Section eyebrow="En la vida real" title="Ejemplos cotidianos" icon="🌿">
          <ul className="grid gap-3 sm:grid-cols-2">
            {c.dailyExamples.map((ex, i) => (
              <li key={i} className="rounded-xl border border-border bg-surface-2/40 p-4 text-sm leading-relaxed text-fg/90">
                {ex}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {c.conclusion && (
        <Section eyebrow="En pocas palabras" title="Conclusión" icon="🌟">
          <Paragraphs text={c.conclusion} />
        </Section>
      )}

      {(c.guideExample.situation || c.guideExample.shift) && (
        <Section eyebrow="Un caso para acompañarte" title="Ejemplo-guía" icon="🧩">
          {c.guideExample.title && (
            <p className="font-display text-lg font-semibold text-primary">
              “{c.guideExample.title}”
            </p>
          )}
          {c.guideExample.situation && (
            <div>
              <p className="text-sm font-bold text-muted">La reacción de siempre</p>
              <Paragraphs text={c.guideExample.situation} />
            </div>
          )}
          {c.guideExample.shift && (
            <div className="rounded-xl bg-aqua/10 p-4">
              <p className="text-sm font-bold text-aqua">La nueva mirada</p>
              <Paragraphs text={c.guideExample.shift} />
            </div>
          )}
        </Section>
      )}

      {c.glossary && c.glossary.length > 0 && (
        <Section eyebrow="Para entender mejor" title="Palabras clave" icon="📚">
          <dl className="space-y-3">
            {c.glossary.map((g, i) => (
              <div key={i} className="rounded-xl bg-surface-2/50 p-4">
                <dt className="font-semibold text-primary">{g.term}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-fg/90">{g.definition}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {c.finalReflection && (
        <Section eyebrow="Para llevar contigo" title="Reflexión final" icon="🪞" highlight>
          <p className="font-display text-lg italic leading-relaxed">{c.finalReflection}</p>
        </Section>
      )}
    </div>
  );
}
