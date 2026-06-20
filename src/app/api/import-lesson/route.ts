import { NextResponse } from "next/server";
import { lessonSourceUrl } from "@/config/lessons.links";
import { parseLessonHtml } from "@/lib/blog-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga y extrae el TEXTO ORIGINAL de una lección desde el blog.
 * No usa credenciales: solo lee una página pública. El número se valida y la
 * URL la construye el servidor (no se acepta una URL arbitraria), evitando abusos.
 *
 *   GET /api/import-lesson?n=25
 */
export async function GET(req: Request) {
  const n = Number(new URL(req.url).searchParams.get("n"));

  // 361-365 están en una sola página combinada del blog: se cargan a mano.
  if (!Number.isInteger(n) || n < 1 || n > 360) {
    return NextResponse.json(
      { error: "Número inválido. Usa 1 a 360 (las 361-365 se cargan a mano)." },
      { status: 400 },
    );
  }

  const url = lessonSourceUrl(n);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; UCDM-importer/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `El blog respondió ${res.status}` }, { status: 502 });
    }
    const html = await res.text();
    const parsed = parseLessonHtml(html, n);
    return NextResponse.json({ number: n, sourceUrl: url, ...parsed });
  } catch (e) {
    return NextResponse.json(
      { error: `No se pudo leer la página (${(e as Error).message}).` },
      { status: 502 },
    );
  }
}
