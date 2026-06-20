// Módulo PURO (sin Firebase): extrae el texto original del Curso desde el HTML
// del blog. Lo usa la ruta /api/import-lesson (servidor, sin credenciales).

export const COMMENTARY_MARKERS = [
  "¿qué me enseña",
  "que me enseña",
  "¿qué nos enseña",
  "comentario",
  "reflexión",
  "reflexion",
  "explicación",
  "explicacion",
  "análisis",
  "analisis",
];

export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;|&laquo;|&raquo;/gi, '"')
    .replace(/&hellip;/gi, "…")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractPostBody(html: string): string {
  const m =
    html.match(/<div[^>]*class="[^"]*post-body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div/i) ||
    html.match(/<div[^>]*class="[^"]*post-body[^"]*"[^>]*>([\s\S]*)/i) ||
    html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*)/i);
  return m && m[1] ? m[1] : html;
}

export function extractTitle(html: string): string {
  const m =
    html.match(/<h3[^>]*class="[^"]*post-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m || !m[1]) return "";
  return htmlToText(m[1]).split("\n")[0]?.trim() ?? "";
}

export function cutAtCommentary(text: string): { original: string; found: boolean } {
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => {
    const low = l.toLowerCase().trim();
    return COMMENTARY_MARKERS.some((mk) => low.startsWith(mk) || low === mk);
  });
  if (idx > 1) return { original: lines.slice(0, idx).join("\n").trim(), found: true };
  return { original: text, found: false };
}

export interface ParsedLesson {
  title: string;
  originalText: string;
  found: boolean;
}

export function parseLessonHtml(html: string): ParsedLesson {
  const body = extractPostBody(html);
  const text = htmlToText(body);
  const { original, found } = cutAtCommentary(text);
  const clean = original.trim();
  const ok = found && clean.length > 40 && clean.length < 8000;
  return { title: extractTitle(html), originalText: clean, found: ok };
}
