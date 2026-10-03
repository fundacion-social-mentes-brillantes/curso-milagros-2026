import Link from "next/link";
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
  // (NNN) = referencia a lección (enlace)  |  número de oración (superíndice)
  const re = /\((\d{1,3})\)|(?<=^|[\s.;:,—(«"¿])(\d{1,2})(?=\s?[A-ZÁÉÍÓÚÑ¡¿«"])/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const ref = Number(m[1]);
      if (ref >= 1 && ref <= 365) {
        nodes.push(
          <Link
            key={`${keyBase}-r${i++}`}
            href={`/lecciones/${ref}`}
            className="font-semibold text-primary decoration-dotted underline-offset-2 hover:underline"
            title={`Ir a la lección ${ref}`}
          >
            ({m[1]})
          </Link>,
        );
      } else {
        nodes.push(m[0]);
      }
    } else {
      nodes.push(
        <sup key={`${keyBase}-s${i++}`} className="mr-px align-super text-[0.62em] font-semibold text-gold">
          {m[2] ?? ""}
        </sup>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: "heading"; level: 1 | 2; text: string }
  | { kind: "para"; num: string; text: string }
  | { kind: "example"; num: string; text: string }
  | { kind: "plain"; text: string };

function classify(raw: string): Block {
  const flat = raw.replace(/\s*\n\s*/g, " ").trim(); // une cortes a media frase
  // Encabezados: "# Título" (grande) o "## Subtítulo" (mediano).
  const head = flat.match(/^(#{1,2})\s+(.+)$/);
  if (head) return { kind: "heading", level: head[1]?.length === 1 ? 1 : 2, text: head[2] ?? "" };
  const para = flat.match(/^(\d{1,3})\.\s+([\s\S]*)$/);
  if (para) return { kind: "para", num: para[1] ?? "", text: para[2] ?? "" };
  const ex = flat.match(/^(\d{1,2})\s?([A-ZÁÉÍÓÚÑ¿«"][\s\S]*)$/);
  if (ex && flat.length <= 120) return { kind: "example", num: ex[1] ?? "", text: ex[2] ?? "" };
  return { kind: "plain", text: flat };
}

// La lectura va en Glacial Indifference: clara, con aire y buen espaciado.
const PARA_CLASS =
  "font-[family-name:var(--font-leer)] text-[length:var(--lectura)] leading-[var(--lectura-alto)] tracking-[0.01em] text-fg/90 [text-wrap:pretty]";

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
          <p key={i} className="font-[family-name:var(--font-leer)] text-[length:var(--lectura)] leading-relaxed text-fg/80">
            <sup className="mr-px align-super text-[0.62em] font-semibold text-gold">
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
    if (b.kind === "heading") {
      out.push(
        b.level === 1 ? (
          <h3
            key={bi}
            className="titulo-seccion mt-8 text-center text-xl first:mt-0 sm:text-2xl"
          >
            {b.text}
          </h3>
        ) : (
          <p
            key={bi}
            className="-mt-1 mb-1 text-center text-base font-medium text-fg/75"
          >
            {b.text}
          </p>
        ),
      );
    } else if (b.kind === "para") {
      out.push(
        <p key={bi} className={PARA_CLASS}>
          <span className="numero-luz mr-2 text-[1.3em]">{b.num}.</span>
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
    <section>
      <header className="mb-1 flex items-center gap-2.5">
        <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none fill-none stroke-gold" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 7.2C10 5.7 7 5.3 3.4 5.7v12c3.6-.4 6.6.1 8.6 1.5 2-1.4 5-1.9 8.6-1.5v-12C17 5.3 14 5.7 12 7.2ZM12 7.2v12" />
        </svg>
        <h2 className="titulo-seccion text-[1.1rem] md:text-[1.35rem]">Texto original de la lección</h2>
      </header>
      <p className="mb-4 pl-[1.9rem] text-xs text-muted">Sin modificaciones</p>
      <div>
        {hasText ? (
          <article className="max-w-[62ch]">
            <BookText text={lesson.originalText} />
          </article>
        ) : (
          <div className="mx-auto max-w-prose rounded-xl border border-dashed border-border bg-surface-2/40 p-6 text-center">
            <p className="font-medium">El texto original se cargará pronto</p>
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
