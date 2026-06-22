import type { Lesson } from "@/types";

/**
 * Texto ORIGINAL del Curso, presentado como en el libro:
 * - número de PÁRRAFO destacado (dorado),
 * - números de ORACIÓN en superíndice,
 * - serif elegante, justificado y con buena respiración.
 * NO modifica el contenido: solo da estilo a la numeración ya existente.
 */

// Convierte los números de oración pegados (p. ej. "2La idea") en superíndices.
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // dígito (1-2) precedido de inicio/espacio/puntuación y seguido de mayúscula/«/¿
  const re = /(?<=^|[\s.;:,—(«"¿])(\d{1,2})(?=\s?[A-ZÁÉÍÓÚÑ¡¿«"])/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const num = m[1] ?? "";
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <sup key={`${keyBase}-s${i++}`} className="mr-px align-super text-[0.62em] font-semibold text-gold">
        {num}
      </sup>,
    );
    last = m.index + num.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: "para"; num: string; text: string }
  | { kind: "example"; num: string; text: string }
  | { kind: "plain"; text: string };

function classify(raw: string): Block {
  const flat = raw.replace(/\s*\n\s*/g, " ").trim(); // une cortes a media frase
  const para = flat.match(/^(\d{1,3})\.\s+([\s\S]*)$/);
  if (para) return { kind: "para", num: para[1] ?? "", text: para[2] ?? "" };
  const ex = flat.match(/^(\d{1,2})\s?([A-ZÁÉÍÓÚÑ¿«"][\s\S]*)$/);
  if (ex && flat.length <= 120) return { kind: "example", num: ex[1] ?? "", text: ex[2] ?? "" };
  return { kind: "plain", text: flat };
}

const PARA_CLASS =
  "text-justify font-serif text-[1.05rem] leading-[1.9] text-fg/90 [hyphens:auto] [text-wrap:pretty]";

function BookText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean).map(classify);

  // Agrupa frases de ejemplo consecutivas en un bloque indentado en cursiva.
  const out: React.ReactNode[] = [];
  let buffer: { num: string; text: string }[] = [];
  const flush = (key: string) => {
    if (buffer.length === 0) return;
    const items = buffer;
    buffer = [];
    out.push(
      <div key={key} className="my-3 space-y-1.5 border-l-2 border-gold/40 pl-5 sm:pl-7">
        {items.map((it, i) => (
          <p key={i} className="font-serif text-[1.02rem] italic leading-relaxed text-fg/80">
            <sup className="mr-px align-super text-[0.62em] font-semibold not-italic text-gold">
              {it.num}
            </sup>
            {renderInline(it.text, `ex-${key}-${i}`)}
          </p>
        ))}
      </div>,
    );
  };

  blocks.forEach((b, bi) => {
    if (b.kind === "example") {
      buffer.push({ num: b.num, text: b.text });
      return;
    }
    flush(`g${bi}`);
    if (b.kind === "para") {
      out.push(
        <p key={bi} className={PARA_CLASS}>
          <span className="mr-1 font-display font-bold text-gold">{b.num}.</span>
          {renderInline(b.text, `p${bi}`)}
        </p>,
      );
    } else {
      out.push(
        <p key={bi} className={PARA_CLASS}>
          {renderInline(b.text, `t${bi}`)}
        </p>,
      );
    }
  });
  flush("gend");

  return <div className="space-y-3.5">{out}</div>;
}

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

      <div className="px-5 py-6 sm:px-8 sm:py-8">
        {hasText ? (
          <article className="mx-auto max-w-[62ch]">
            <BookText text={lesson.originalText} />
          </article>
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
