/**
 * Importa el TEXTO ORIGINAL exacto de cada lección desde el blog y lo guarda
 * en Firestore (campo originalText). NO escribe ningún comentario del blog.
 *
 *   npm run import:textos            (todas)
 *   npm run import:textos -- 1 30    (solo lecciones 1 a 30)
 *
 * Importante: corre primero "npm run seed" para que existan las lecciones.
 * La extracción es heurística (el blog no es uniforme): revisa las lecciones
 * que el script marque como "REVISAR".
 */
import { db } from "./_admin";
import { allLessonLinks, lessonDocId } from "../src/config/lessons.links";

// Frases donde típicamente EMPIEZA el comentario del blog (todo lo anterior es
// el texto original del Curso).
const COMMENTARY_MARKERS = [
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

function htmlToText(html: string): string {
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

function extractPostBody(html: string): string {
  const m =
    html.match(/<div[^>]*class="[^"]*post-body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div/i) ||
    html.match(/<div[^>]*class="[^"]*post-body[^"]*"[^>]*>([\s\S]*)/i) ||
    html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*)/i);
  return m && m[1] ? m[1] : html;
}

function extractTitle(html: string): string {
  const m =
    html.match(/<h3[^>]*class="[^"]*post-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m || !m[1]) return "";
  return htmlToText(m[1]).split("\n")[0]?.trim() ?? "";
}

function cutAtCommentary(text: string): { original: string; found: boolean } {
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => {
    const low = l.toLowerCase().trim();
    return COMMENTARY_MARKERS.some((mk) => low.startsWith(mk) || low === mk);
  });
  if (idx > 1) return { original: lines.slice(0, idx).join("\n").trim(), found: true };
  return { original: text, found: false };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; UCDM-importer/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
  const from = args[0] ?? 1;
  const to = args[1] ?? 365;

  const firestore = db();
  const links = allLessonLinks().filter((l) => l.number >= from && l.number <= to);
  const cache = new Map<string, string>();
  let ok = 0;
  let review = 0;
  let failed = 0;

  for (const { number, url } of links) {
    // Las lecciones 361-365 comparten una sola página combinada: requieren
    // separación manual. Guardamos la fuente y las marcamos para revisar.
    if (number >= 361) {
      await firestore.doc(`lessons/${lessonDocId(number)}`).set(
        { number, sourceUrl: url, updatedAt: Date.now() },
        { merge: true },
      );
      console.log(`⚠️  Lección ${number}: página combinada 361-365, REVISAR a mano.`);
      review++;
      continue;
    }

    try {
      let html = cache.get(url);
      if (!html) {
        html = await fetchHtml(url);
        cache.set(url, html);
        await sleep(700); // amable con el servidor
      }
      const body = extractPostBody(html);
      const text = htmlToText(body);
      const { original, found } = cutAtCommentary(text);
      const title = extractTitle(html);

      const clean = original.trim();
      const looksOk = found && clean.length > 40 && clean.length < 8000;

      await firestore.doc(`lessons/${lessonDocId(number)}`).set(
        {
          number,
          sourceUrl: url,
          originalText: clean,
          originalTextLoaded: clean.length > 0,
          ...(title ? { title } : {}),
          updatedAt: Date.now(),
        },
        { merge: true },
      );

      if (looksOk) {
        console.log(`✅ Lección ${number}: ${clean.length} caracteres.`);
        ok++;
      } else {
        console.log(`⚠️  Lección ${number}: importada pero REVISAR (corte no claro / tamaño raro).`);
        review++;
      }
    } catch (err) {
      console.log(`❌ Lección ${number}: error (${(err as Error).message}).`);
      failed++;
    }
  }

  console.log(`\nResumen → ok: ${ok}, revisar: ${review}, fallidas: ${failed}.`);
  console.log("Las marcadas como REVISAR conviene ajustarlas desde /admin/lecciones.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error general:", err);
  process.exit(1);
});
