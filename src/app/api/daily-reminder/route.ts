import type { NextRequest } from "next/server";

/**
 * Tarea diaria: envía el recordatorio "¿Ya hiciste tu lección de hoy?" a todas
 * las personas suscritas, vía OneSignal. La dispara Vercel Cron una vez al día.
 *
 * Variables de entorno necesarias (en Vercel):
 * - ONESIGNAL_REST_API_KEY  (secreta, de OneSignal → Settings → Keys & IDs)
 * - CRON_SECRET             (secreta, protege esta ruta de disparos externos)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONESIGNAL_APP_ID = "7959aae1-aace-4889-b89f-d307ad2ad95c";
const TITLE = "Un Curso de Milagros";
const MESSAGE = "¿Ya hiciste tu lección de hoy? 🌅";
const OPEN_URL = "https://curso-milagros.vercel.app/lecciones";

export async function GET(req: NextRequest): Promise<Response> {
  // Solo Vercel Cron (que envía el secreto) puede dispararlo.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "no-config" }, { status: 503 });
  }

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["Subscribed Users"],
        headings: { en: TITLE },
        contents: { en: MESSAGE },
        url: OPEN_URL,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as unknown;
    return Response.json({ ok: res.ok, data }, { status: res.ok ? 200 : 502 });
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
