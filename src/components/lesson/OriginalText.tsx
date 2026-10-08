import Link from "next/link";
import { ICONO_LEE, TituloSeccion } from "@/components/lesson/TituloSeccion";
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
  // | ᵃ ᵇ = media frase: el libro parte algunas oraciones con una letra
  // diminuta en alto. Escrita como "a" normal parecía una palabra de más.
  const re = /\((\d{1,3})\)|(?<=^|[\s.;:,—(«"¿])(\d{1,2})(?=\s?[A-ZÁÉÍÓÚÑ¡¿«"])|([ᵃᵇ])/g;
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
          {m[3] ? (m[3] === "ᵃ" ? "a" : "b") : (m[2] ?? "")}
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
  | { kind: "plain"; text: string }
  | { kind: "nota"; text: string };

function classify(raw: string): Block {
  const flat = raw.replace(/\s*\n\s*/g, " ").trim(); // une cortes a media frase
  // Nota del traductor al pie ("¹ N.T. …", lección 83): va aparte y en pequeño.
  if (/^[¹²³⁴]\s?N\.\s?T\./.test(flat)) return { kind: "nota", text: flat };
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
            className="titulo-seccion mt-8 text-center text-[1.5rem] first:mt-0 sm:text-[1.8rem]"
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
        <p key={bi} className={`${PARA_CLASS} enciende`}>
          <span className="num-parrafo mr-2">{b.num}.</span>
          {renderInline(b.text, `p${bi}`)}
        </p>,
      );
    } else if (b.kind === "nota") {
      out.push(
        <p key={bi} className="!mt-8 border-t border-fg/10 pt-4 text-sm leading-relaxed text-muted">
          {b.text}
        </p>,
      );
    } else {
      out.push(
        <p key={bi} className={`${PARA_CLASS} enciende`}>
          {renderInline(b.text, `t${bi}`)}
        </p>,
      );
    }
  });
  flush("gend");

  return <div className="space-y-3.5">{out}</div>;
}

/** El primer párrafo del texto original, tal cual (para la entrada de «Hoy»). */
export function PrimerParrafo({ text }: { text: string }) {
  const primero = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map(classify)
    .find((b) => b.kind === "para" || b.kind === "plain");
  if (!primero || (primero.kind !== "para" && primero.kind !== "plain")) return null;
  return (
    <p className={PARA_CLASS}>
      {primero.kind === "para" && <span className="num-parrafo mr-2">{primero.num}.</span>}
      {renderInline(primero.text, "pp")}
    </p>
  );
}

export function OriginalText({ lesson }: { lesson: Lesson }) {
  const hasText = lesson.originalTextLoaded && lesson.originalText.trim().length > 0;

  return (
    <section>
      <TituloSeccion icono={ICONO_LEE} primera="Texto" acento="original" nota="Sin modificaciones · Libro de ejercicios" />
      <div>
        {hasText ? (
          <article>
            <BookText text={lesson.originalText} />
          </article>
        ) : (
          <div className="mx-auto max-w-prose p-2 text-center">
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
