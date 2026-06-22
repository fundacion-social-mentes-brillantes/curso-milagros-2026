// Módulo PURO (sin Firebase): extrae el texto original del Curso desde el HTML
// del blog. Lo usan la ruta /api/import-lesson y el script build:data.
//
// El blog mezcla menús, el texto del Curso y el comentario propio. Estrategia:
// recortar SOLO desde el encabezado "LECCIÓN N" hasta el inicio del comentario,
// y marcar como fiable únicamente cuando ese corte fue claro.

export function htmlToText(html: string): string {
  let t = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");

  // Entidades nombradas frecuentes.
  t = t
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&rsquo;|&lsquo;|&apos;/gi, "'")
    .replace(/&ldquo;|&rdquo;|&laquo;|&raquo;/gi, '"')
    .replace(/&hellip;/gi, "…");

  // Entidades numéricas (hex y decimal), p.ej. &#191; = ¿, &#173; = guion suave.
  t = t
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return " ";
      }
    })
    .replace(/&#(\d+);/g, (_, d) => {
      try {
        return String.fromCodePoint(parseInt(d, 10));
      } catch {
        return " ";
      }
    });

  // Quita el guion suave invisible (artefacto del PDF/blog).
  t = t.replace(/­/g, "");

  // Entidades restantes y espacios.
  t = t
    .replace(/&[a-zA-Z]+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return t;
}

const COMMENTARY_CUT =
  /(¿?\s*Qu[eé]\s+(me|nos)\s+ense[ñn]a)|(&#191;?\s*Qu[eé]\s+(me|nos))|(Prop[oó]sito\s+y\s+sentido)|(Instrucciones\s+pr[aá]cticas)|(Aspectos\s+psicol[oó]gicos)|(Relaci[oó]n\s+con\s+el\s+resto)|(Consejos\s+para\s+la\s+pr[aá]ctica)|(Ejemplo[\s-]*[Gg]u[ií]a)|(\bComentario\b)|(\bAn[aá]lisis\b)/;

export interface ParsedLesson {
  title: string;
  originalText: string;
  found: boolean;
}

export function parseLessonHtml(html: string, n: number): ParsedLesson {
  // Recorre TODAS las apariciones de "LECCIÓN N" (acepta acentos/mayus/minus)
  // y elige la primera que, recortada hasta el comentario, dé un texto de
  // tamaño razonable. Así evita anclar en el meta-título de la página.
  const headRe = new RegExp("LECCI[OÓ]N\\s*0*" + n + "\\b", "gi");
  let fallback: ParsedLesson | null = null;
  let m: RegExpExecArray | null;

  while ((m = headRe.exec(html)) !== null) {
    const after = html.slice(m.index);
    const cut = COMMENTARY_CUT.exec(after);
    if (!cut || cut.index <= 0) continue;
    const region = after.slice(0, cut.index);

    let text = htmlToText(region)
      .replace(new RegExp("^(\\s*LECCI[OÓ]N\\s*0*" + n + "\\s*)+", "i"), "")
      .trim();

    let title = "";
    let originalText = "";
    const firstPara = text.match(/(^|\n)\s*1[.°)]\s+\S/);
    if (firstPara && typeof firstPara.index === "number") {
      const idx = firstPara.index + (firstPara[1] ? firstPara[1].length : 0);
      title = text.slice(0, idx).replace(/\s*\n\s*/g, " ").trim();
      originalText = text.slice(idx).trim();
    } else {
      title = (text.split("\n")[0] ?? "").trim();
      originalText = text.trim();
    }
    originalText = originalText.replace(/\s*¿\s*$/, "").trim();
    title = title.replace(/\s*¿\s*$/, "").trim();

    if (originalText.length > 30 && originalText.length < 9000) {
      return { title, originalText, found: true };
    }
    if (!fallback) fallback = { title, originalText, found: false };
  }

  return fallback ?? { title: "", originalText: "", found: false };
}
