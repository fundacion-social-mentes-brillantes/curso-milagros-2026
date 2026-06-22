/**
 * Genera los archivos de datos de las 365 lecciones dentro de la app:
 *   public/lessons/{id}.json   (una por lección, con texto original fiel)
 *   public/lessons/index.json  (lista liviana: número + título)
 *
 * Así las lecciones viajan con el código y se publican solas en Vercel,
 * sin necesidad de credenciales de base de datos.
 *
 *   npm run build:data            (todas)
 *   npm run build:data -- 1 60    (solo un rango; conserva las demás)
 *
 * El comentario explicativo se rellena aparte (script de comentarios / panel).
 * La Lección 25 ya viene con su texto exacto y su guía modelo.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildStubLesson } from "../src/lib/lesson-template";
import { parseLessonHtml } from "../src/lib/blog-parse";
import {
  TOTAL_LESSONS,
  lessonDocId,
  lessonSourceUrl,
} from "../src/config/lessons.links";
import {
  LESSON_25_ORIGINAL,
  LESSON_25_TITLE,
  LESSON_25_COMMENTARY,
} from "../src/data/lesson-25";
import type { Lesson } from "../src/types";

const OUT_DIR = join(process.cwd(), "public", "lessons");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; UCDM-builder/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function readExisting(id: string): Lesson | null {
  const p = join(OUT_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Lesson;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
  // Mas de 2 numeros = lista explicita de lecciones; si no, rango from-to.
  let targets: number[];
  if (args.length > 2) {
    targets = args;
  } else {
    const from = args[0] ?? 1;
    const to = args[1] ?? TOTAL_LESSONS;
    targets = [];
    for (let n = from; n <= to; n++) targets.push(n);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const now = Date.now();
  let ok = 0;
  let review = 0;
  let failed = 0;

  for (const n of targets) {
    const id = lessonDocId(n);
    const lesson = buildStubLesson(n, now);

    // Conserva comentario ya escrito si existe.
    const prev = readExisting(id);
    if (prev?.commentary) {
      lesson.commentary = prev.commentary;
      lesson.commentaryReady = prev.commentaryReady;
    }

    if (n === 25) {
      lesson.title = LESSON_25_TITLE;
      lesson.originalText = LESSON_25_ORIGINAL;
      lesson.originalTextLoaded = true;
      lesson.commentary = LESSON_25_COMMENTARY;
      lesson.commentaryReady = true;
      ok++;
    } else if (n >= 361) {
      // Página combinada 361-365: se carga a mano luego.
      lesson.sourceUrl = lessonSourceUrl(n);
      review++;
      console.log(`⚠️  Lección ${n}: combinada 361-365, REVISAR a mano.`);
    } else {
      try {
        const html = await fetchHtml(lessonSourceUrl(n));
        const parsed = parseLessonHtml(html, n);
        if (parsed.title && parsed.title.length < 200) lesson.title = parsed.title;
        if (parsed.found) {
          // Solo guardamos el texto cuando el corte fue claro y fiable.
          lesson.originalText = parsed.originalText;
          lesson.originalTextLoaded = true;
          ok++;
          console.log(`✅ Lección ${n}: ${parsed.originalText.length} car.`);
        } else {
          // Pendiente: se mostrará "se cargará pronto" (nunca texto dudoso).
          lesson.originalText = "";
          lesson.originalTextLoaded = false;
          review++;
          console.log(`⚠️  Lección ${n}: pendiente (sin corte claro).`);
        }
        await sleep(400);
      } catch (e) {
        failed++;
        console.log(`❌ Lección ${n}: ${(e as Error).message}`);
      }
    }

    writeFileSync(join(OUT_DIR, `${id}.json`), JSON.stringify(lesson, null, 2), "utf8");
  }

  // Reconstruye el índice leyendo todos los archivos existentes.
  const index: { number: number; title: string; videoStatus: string }[] = [];
  for (let n = 1; n <= TOTAL_LESSONS; n++) {
    const l = readExisting(lessonDocId(n));
    if (l) {
      index.push({ number: n, title: l.title, videoStatus: l.video?.status ?? "soon" });
    }
  }
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2), "utf8");

  console.log(`\nResumen → ok: ${ok}, revisar: ${review}, fallidas: ${failed}. Índice: ${index.length} lecciones.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
