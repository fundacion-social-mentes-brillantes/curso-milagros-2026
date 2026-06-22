/**
 * Caso especial: las lecciones 361-365 viven en una sola pagina ("LECCIONES
 * FINALES") y comparten el cierre. Este script extrae ese texto y lo asigna a
 * las 5, conservando el comentario si ya existe.
 *
 *   npm run build:final
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildStubLesson } from "../src/lib/lesson-template";
import { htmlToText } from "../src/lib/blog-parse";
import { lessonDocId, lessonSourceUrl } from "../src/config/lessons.links";
import type { Lesson } from "../src/types";

const OUT_DIR = join(process.cwd(), "public", "lessons");

async function main() {
  const url = lessonSourceUrl(361);
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (UCDM)" } });
  const html = await res.text();

  const start = html.search(/LECCIONES\s+FINALES/i);
  if (start < 0) throw new Error("No se encontró 'LECCIONES FINALES'");
  const after = html.slice(start);
  const cut = after.search(/¿?\s*Qu[eé]\s+(me|nos)\s+ense[ñn]a|\bComentario\b/i);
  const region = cut > 0 ? after.slice(0, cut) : after.slice(0, 6000);
  const text = htmlToText(region).trim();

  // Separa la Introducción del cierre compartido "LECCIONES 361-365".
  const splitIdx = text.search(/LECCIONES\s*361\s*[-–]\s*365/i);
  const intro = splitIdx > 0 ? text.slice(0, splitIdx).trim() : text;
  const shared =
    splitIdx > 0
      ? text.slice(splitIdx).replace(/^LECCIONES\s*361\s*[-–]\s*365\s*/i, "").trim()
      : text;

  const titleLine = (shared.split("\n")[0] ?? "Lecciones finales").trim();
  const now = Date.now();

  for (let n = 361; n <= 365; n++) {
    const id = lessonDocId(n);
    const p = join(OUT_DIR, `${id}.json`);
    let lesson: Lesson = buildStubLesson(n, now);
    if (existsSync(p)) {
      try {
        lesson = JSON.parse(readFileSync(p, "utf8")) as Lesson;
      } catch {
        /* usa el stub */
      }
    }
    lesson.title = titleLine;
    lesson.originalText = n === 361 ? `${intro}\n\n${shared}` : shared;
    lesson.originalTextLoaded = true;
    lesson.sourceUrl = url;
    writeFileSync(p, JSON.stringify(lesson, null, 2), "utf8");
    console.log(`✅ Lección ${n}: ${lesson.originalText.length} car.`);
  }
  console.log("Listo: lecciones finales 361-365.");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
