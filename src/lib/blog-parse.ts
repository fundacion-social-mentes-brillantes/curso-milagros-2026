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
  // 1) Encabezado de contenido: preferimos MAYÚSCULAS "LECCIÓN N".
  let start = new RegExp("LECCIÓN\\s*0*" + n + "\\b").exec(html);
  if (!start) start = new RegExp("LECCI[OÓ]N\\s*0*" + n + "\\b", "i").exec(html);
  if (!start) return { title: "", originalText: "", found: false };

  // 2) Recorta hasta el inicio del comentario.
  let region = html.slice(start.index);
  const cut = COMMENTARY_CUT.exec(region);
  const cutFound = Boolean(cut && cut.index > 0);
  if (cut && cut.index > 0) region = region.slice(0, cut.index);

  // 3) Texto plano (con entidades decodificadas).
  let text = htmlToText(region);

  // 4) Quita encabezados "LECCIÓN N" repetidos al inicio.
  text = text
    .replace(new RegExp("^(\\s*LECCI[OÓ]N\\s*0*" + n + "\\s*)+", "i"), "")
    .trim();

  // 5) Separa título (antes del primer párrafo "1.") y cuerpo del Curso.
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

  // 6) Limpieza final: quita un "¿" colgante al final (inicio del comentario).
  originalText = originalText.replace(/\s*¿\s*$/, "").trim();
  title = title.replace(/\s*¿\s*$/, "").trim();

  const ok = cutFound && originalText.length > 30 && originalText.length < 9000;
  return { title, originalText, found: ok };
}
