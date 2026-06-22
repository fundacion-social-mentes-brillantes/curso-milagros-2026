import type { NextRequest } from "next/server";
import { SENSEI_SYSTEM_PROMPT } from "@/lib/sensei-prompt";
import { FIREBASE_PUBLIC } from "@/config/firebase-public";

/**
 * Endpoint del guía espiritual "Lumi".
 *
 * - La clave de DeepSeek vive SOLO en el servidor (variable DEEPSEEK_API_KEY).
 *   Nunca llega al navegador.
 * - Solo responde a usuarios con sesión iniciada en la app: verificamos el
 *   token de Firebase contra Google (sin necesidad de clave de servicio), así
 *   nadie de afuera puede gastar el saldo.
 * - Devuelve la respuesta en streaming (palabra por palabra).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || FIREBASE_PUBLIC.apiKey;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Verifica que el idToken sea de un usuario real de ESTE proyecto Firebase. */
async function verifyUser(idToken: unknown): Promise<boolean> {
  if (typeof idToken !== "string" || idToken.length < 20) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { users?: unknown[] };
    return Array.isArray(data.users) && data.users.length > 0;
  } catch {
    return false;
  }
}

function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m === "object" &&
        (m as ChatMessage).role !== undefined &&
        ((m as ChatMessage).role === "user" ||
          (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string",
    )
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

export async function POST(req: NextRequest): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return json({ error: "no-config" }, 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad-request" }, 400);
  }

  const { messages, idToken, lessonNumber } = (body ?? {}) as {
    messages?: unknown;
    idToken?: unknown;
    lessonNumber?: unknown;
  };

  const cleaned = sanitizeMessages(messages);
  if (cleaned.length === 0) {
    return json({ error: "bad-request" }, 400);
  }

  const authorized = await verifyUser(idToken);
  if (!authorized) {
    return json({ error: "unauthorized" }, 401);
  }

  let system = SENSEI_SYSTEM_PROMPT;
  const lesson = Number(lessonNumber);
  if (Number.isInteger(lesson) && lesson >= 1 && lesson <= 365) {
    system += `\n\nCONTEXTO ACTUAL: la persona está leyendo la lección ${lesson} del Curso. Si su pregunta se relaciona, ten presente esa lección.`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, ...cleaned],
        stream: true,
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });
  } catch {
    return json({ error: "upstream" }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    return json({ error: "upstream" }, 502);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const upstreamBody = upstream.body;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamBody.getReader();
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              /* fragmento incompleto: se completará en la siguiente vuelta */
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
