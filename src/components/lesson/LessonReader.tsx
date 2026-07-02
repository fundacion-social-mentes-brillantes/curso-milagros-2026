"use client";

import { useEffect, useRef, useState } from "react";
import type { Lesson } from "@/types";

/**
 * Texto para ESCUCHAR: quita los números de párrafo ("1.") y de oración ("2 ")
 * para que la voz no los lea. Solo afecta el audio; el texto visible queda
 * intacto (el texto del Curso no se modifica).
 */
function speechText(lesson: Lesson): string {
  let t = lesson.originalText || "";
  t = t.replace(/^\s*\d+\.\s*/gm, "");
  t = t.replace(/([\s"“(¿¡])\d{1,2}\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“])/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  return `Lección ${lesson.number}. ${lesson.title} ${t}`;
}

/** Divide en frases cortas: evita que el navegador corte lecturas largas. */
function toChunks(text: string): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length > 200) {
      out.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Elige la voz en español MÁS NATURAL disponible en el dispositivo. */
function bestSpanishVoice(): SpeechSynthesisVoice | null {
  const es = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("es"));
  if (es.length === 0) return null;
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    const lang = v.lang.toLowerCase().replace("_", "-");
    let s = 0;
    if (n.includes("natural")) s += 100;
    if (n.includes("neural")) s += 80;
    if (n.includes("google")) s += 60;
    if (n.includes("premium") || n.includes("enhanced") || n.includes("mejorada")) s += 50;
    if (lang === "es-us" || lang === "es-mx" || lang === "es-co" || lang === "es-419") s += 12;
    return s;
  };
  return [...es].sort((a, b) => score(b) - score(a))[0] ?? null;
}

type ReaderState = "idle" | "playing" | "paused";

const RATES = [
  { label: "🐢 Lenta", value: 0.8 },
  { label: "Normal", value: 0.95 },
  { label: "Rápida", value: 1.15 },
] as const;

/**
 * Lector en voz alta de la lección (accesibilidad). Usa la voz del propio
 * dispositivo (gratis, sin internet extra). Solo se muestra a las personas a
 * las que un admin les activó la opción.
 */
export function LessonReader({ lesson }: { lesson: Lesson }) {
  const [state, setState] = useState<ReaderState>("idle");
  const [rate, setRate] = useState<number>(0.95);
  const [progress, setProgress] = useState(0);
  const [supported, setSupported] = useState(true);
  const chunksRef = useRef<string[]>([]);
  const stopRef = useRef(false);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    // Algunos navegadores llenan la lista de voces tarde: precargar.
    window.speechSynthesis.getVoices();
    return () => {
      stopRef.current = true;
      window.speechSynthesis.cancel();
    };
  }, []);

  function speakFrom(i: number) {
    const chunks = chunksRef.current;
    const chunk = chunks[i];
    if (chunk === undefined) {
      setState("idle");
      setProgress(0);
      return;
    }
    setProgress(Math.round((i / chunks.length) * 100));
    const u = new SpeechSynthesisUtterance(chunk);
    const voice = bestSpanishVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "es-US";
    u.rate = rateRef.current;
    u.onend = () => {
      if (!stopRef.current) speakFrom(i + 1);
    };
    u.onerror = () => {
      if (!stopRef.current) speakFrom(i + 1);
    };
    window.speechSynthesis.speak(u);
  }

  function play() {
    if (!supported) return;
    if (state === "paused") {
      window.speechSynthesis.resume();
      setState("playing");
      return;
    }
    window.speechSynthesis.cancel();
    stopRef.current = false;
    chunksRef.current = toChunks(speechText(lesson));
    setState("playing");
    speakFrom(0);
  }

  function pause() {
    window.speechSynthesis.pause();
    setState("paused");
  }

  function stop() {
    stopRef.current = true;
    window.speechSynthesis.cancel();
    setState("idle");
    setProgress(0);
  }

  if (!supported) {
    return (
      <div className="card p-4 text-sm text-muted">
        🔇 Este navegador no permite la lectura en voz alta. Prueba con Chrome o Safari
        actualizados.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">🔊</span>
          <h2 className="font-display text-lg font-bold">Escuchar la lección</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {state !== "playing" ? (
            <button
              onClick={play}
              className="btn-primary px-6 py-3 text-base"
              aria-label={state === "paused" ? "Continuar la lectura" : "Escuchar la lección en voz alta"}
            >
              ▶ {state === "paused" ? "Continuar" : "Escuchar"}
            </button>
          ) : (
            <button
              onClick={pause}
              className="btn-primary px-6 py-3 text-base"
              aria-label="Pausar la lectura"
            >
              ⏸ Pausa
            </button>
          )}
          {state !== "idle" && (
            <button
              onClick={stop}
              className="btn-ghost px-5 py-3 text-base"
              aria-label="Detener la lectura"
            >
              ⏹ Detener
            </button>
          )}

          <div className="ml-auto flex items-center gap-1.5" role="group" aria-label="Velocidad de lectura">
            {RATES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRate(r.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  rate === r.value
                    ? "bg-primary text-primary-fg"
                    : "border border-border bg-surface text-muted hover:text-fg"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {state !== "idle" && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gold transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
