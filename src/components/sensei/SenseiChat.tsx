"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { getClientAuth } from "@/lib/firebase";
import {
  SENSEI_EMOJI,
  SENSEI_NAME,
  SENSEI_SUGGESTIONS,
  SENSEI_TAGLINE,
  SENSEI_WELCOME,
} from "@/lib/sensei-prompt";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/** Resalta **negritas** sin permitir HTML (seguro). */
function Formatted({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.length > 4 && p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

export function SenseiChat() {
  const { firebaseUser } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Si está en una lección, le pasamos el número como contexto.
  const lessonMatch = pathname?.match(/\/lecciones\/(\d+)/);
  const lessonNumber = lessonMatch ? Number(lessonMatch[1]) : undefined;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Solo para usuarios con sesión (protege el saldo y mantiene la portada limpia).
  if (!firebaseUser) return null;

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setError(null);

    const user = getClientAuth().currentUser;
    let idToken: string | null = null;
    try {
      idToken = user ? await user.getIdToken() : null;
    } catch {
      idToken = null;
    }
    if (!idToken) {
      setError("Tu sesión expiró. Vuelve a entrar para conversar con Lumi.");
      return;
    }

    const outgoing: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages([...outgoing, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/sensei", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outgoing, idToken, lessonNumber }),
      });

      if (!res.ok || !res.body) {
        const code = res.status;
        const msg =
          code === 503
            ? "El guía aún no está activado. (Falta configurar la clave.)"
            : code === 401
              ? "Tu sesión expiró. Vuelve a entrar para conversar."
              : "No pude conectar en este momento. Intenta de nuevo en un ratito. 🌿";
        setMessages((prev) => prev.slice(0, -1));
        setError(msg);
        setBusy(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              role: "assistant",
              content: last.content + chunk,
            };
          }
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && last.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
      setError("Se interrumpió la conexión. Intenta de nuevo. 🌿");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Hablar con ${SENSEI_NAME}, tu guía del Curso`}
          className="group fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-gold p-px shadow-glow transition active:scale-95 sm:bottom-6 sm:right-6"
        >
          <span className="flex items-center gap-2 rounded-full bg-surface/95 px-3 py-2 backdrop-blur">
            <span className="grid h-9 w-9 animate-breathe place-items-center rounded-full bg-gradient-to-br from-primary to-gold text-lg shadow-glow">
              {SENSEI_EMOJI}
            </span>
            <span className="hidden pr-1 text-sm font-semibold text-fg sm:block">
              Pregúntale a {SENSEI_NAME}
            </span>
          </span>
        </button>
      )}

      {/* Panel de chat */}
      {open && (
        <div className="fixed inset-x-3 bottom-3 z-50 animate-fade-up sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[384px]">
          <div className="card flex h-[72vh] max-h-[600px] flex-col overflow-hidden sm:h-[560px]">
            {/* Cabecera */}
            <div className="bg-gradient-to-r from-primary to-primary-soft text-primary-fg">
              <div className="h-1 w-full bg-gradient-to-r from-gold via-gold-soft to-aqua" />
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-10 w-10 animate-breathe place-items-center rounded-full bg-white/15 text-xl">
                  {SENSEI_EMOJI}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold leading-tight">
                    {SENSEI_NAME}
                  </p>
                  <p className="text-xs text-primary-fg/80">{SENSEI_TAGLINE}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="grid h-8 w-8 place-items-center rounded-full text-primary-fg/90 transition hover:bg-white/15"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mensajes */}
            <div
              ref={scrollRef}
              className="scrollbar-soft flex-1 space-y-3 overflow-y-auto bg-bg/40 px-3 py-4"
            >
              {/* Bienvenida */}
              <div className="flex gap-2">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-gold text-sm">
                  {SENSEI_EMOJI}
                </span>
                <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-surface px-3.5 py-2.5 text-sm text-fg shadow-soft">
                  {SENSEI_WELCOME}
                </div>
              </div>

              {/* Sugerencias (solo al inicio) */}
              {messages.length === 0 && !busy && (
                <div className="flex flex-wrap gap-2 pl-9 pt-1">
                  {SENSEI_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs font-medium text-primary transition hover:bg-surface-2"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm text-primary-fg shadow-soft">
                      <Formatted text={m.content} />
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-2">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-gold text-sm">
                      {SENSEI_EMOJI}
                    </span>
                    <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-surface px-3.5 py-2.5 text-sm text-fg shadow-soft">
                      {m.content ? (
                        <Formatted text={m.content} />
                      ) : (
                        <span className="inline-flex gap-1 py-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )}

              {error && (
                <p className="px-2 text-center text-xs text-warning">{error}</p>
              )}
            </div>

            {/* Caja de texto */}
            <div className="border-t border-border bg-surface px-3 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  placeholder={`Escríbele a ${SENSEI_NAME}…`}
                  className="max-h-28 flex-1 resize-none rounded-xl border border-border bg-bg/50 px-3 py-2 text-sm text-fg placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={() => void send(input)}
                  disabled={busy || !input.trim()}
                  aria-label="Enviar"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-fg shadow-glow transition active:scale-95 disabled:opacity-50"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted">
                Lumi es una guía con IA; puede equivocarse. El texto original del
                Curso es siempre la fuente.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
