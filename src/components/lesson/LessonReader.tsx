"use client";

import { useEffect, useRef, useState } from "react";
import type { Lesson } from "@/types";

const RATES = [
  { label: "🐢 Lenta", value: 0.85 },
  { label: "Normal", value: 1 },
  { label: "Rápida", value: 1.15 },
] as const;

/**
 * Lector en voz alta de la lección (accesibilidad). Si existe un audio narrado
 * de alta calidad para la lección (public/audio/lecciones/{NNN}.mp3) lo reproduce;
 * si no, usa la voz del propio dispositivo como respaldo.
 */
export function LessonReader({ lesson }: { lesson: Lesson }) {
  const num = String(lesson.number).padStart(3, "0");
  const audioUrl = `/audio/lecciones/${num}.mp3`;
  const [hasFile, setHasFile] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch(audioUrl, { method: "HEAD" })
      .then((r) => active && setHasFile(r.ok))
      .catch(() => active && setHasFile(false));
    return () => {
      active = false;
    };
  }, [audioUrl]);

  if (hasFile === null) return null;
  if (hasFile) return <FilePlayer url={audioUrl} />;
  return <SpeechPlayer lesson={lesson} />;
}

/** Reproductor del audio narrado (MP3 de alta calidad). */
function FilePlayer({ url }: { url: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState(1);

  function setSpeed(v: number) {
    setRate(v);
    if (ref.current) ref.current.playbackRate = v;
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">🔊</span>
          <h2 className="font-display text-lg font-bold">Escuchar la lección</h2>
        </div>
        <audio
          ref={ref}
          src={url}
          controls
          preload="metadata"
          className="w-full"
          onLoadedMetadata={() => {
            if (ref.current) ref.current.playbackRate = rate;
          }}
        >
          Tu navegador no puede reproducir este audio.
        </audio>
        <div className="flex items-center gap-1.5" role="group" aria-label="Velocidad de lectura">
          <span className="mr-1 text-xs text-muted">Velocidad:</span>
          {RATES.map((r) => (
            <button
              key={r.value}
              onClick={() => setSpeed(r.value)}
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
    </div>
  );
}

/* ---------- Respaldo: voz del dispositivo (para lecciones sin audio aún) ---------- */

function speechText(lesson: Lesson): string {
  let t = lesson.originalText || "";
  t = t.replace(/^\s*\d+\.\s*/gm, "");
  t = t.replace(/([\s"“(¿¡])\d{1,2}\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“])/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  return `Lección ${lesson.number}. ${lesson.title} ${t}`;
}

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

function SpeechPlayer({ lesson }: { lesson: Lesson }) {
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
            <button onClick={play} className="btn-primary px-6 py-3 text-base">
              ▶ {state === "paused" ? "Continuar" : "Escuchar"}
            </button>
          ) : (
            <button onClick={pause} className="btn-primary px-6 py-3 text-base">
              ⏸ Pausa
            </button>
          )}
          {state !== "idle" && (
            <button onClick={stop} className="btn-ghost px-5 py-3 text-base">
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
