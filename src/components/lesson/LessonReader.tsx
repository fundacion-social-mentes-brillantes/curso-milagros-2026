"use client";

import { useEffect, useRef, useState } from "react";
import { audioLeccion, musicaDeFondo } from "@/config/assets";
import type { Lesson } from "@/types";

const RATES = [
  { label: "Lenta", value: 0.85 },
  { label: "Normal", value: 1 },
  { label: "Rápida", value: 1.15 },
] as const;

/**
 * Lector en voz alta de la lección (accesibilidad). Si existe un audio narrado
 * de alta calidad para la lección lo reproduce (ver src/config/assets.ts);
 * si no, usa la voz del propio dispositivo como respaldo.
 */
export function LessonReader({ lesson }: { lesson: Lesson }) {
  const num = String(lesson.number).padStart(3, "0");
  const audioUrl = audioLeccion(num);
  const [falloElAudio, setFalloElAudio] = useState(false);

  /*
   * SE INTENTA EL MP3 PRIMERO, Y SOLO SE CAE A LA VOZ DEL APARATO SI FALLA DE
   * VERDAD AL REPRODUCIR.
   *
   * Antes esto preguntaba por el archivo con `fetch(..., {method:"HEAD"})` y, si
   * la petición no salía bien, enseñaba el lector sintético. El problema: los
   * audios viven en otro dominio (Azure Blob) y ese `fetch` es una petición
   * entre dominios, así que el navegador la bloqueaba por CORS. La consecuencia
   * es que TODAS las lecciones caían al respaldo: durante semanas nadie oyó las
   * narraciones, solo la voz robótica del navegador.
   *
   * La etiqueta <audio> no necesita CORS para reproducir. Por eso ya no se
   * pregunta: se pone el reproductor y solo se cambia al respaldo si el propio
   * <audio> avisa de que no pudo cargar. Así, si mañana falla la configuración,
   * el fallo se ve —no suena— en vez de disfrazarse de voz de robot.
   */
  useEffect(() => {
    setFalloElAudio(false);
  }, [audioUrl]);

  if (falloElAudio) return <SpeechPlayer lesson={lesson} />;
  return <FilePlayer url={audioUrl} onFallo={() => setFalloElAudio(true)} />;
}

/** «1:23» a partir de segundos. */
function mmss(seg: number): string {
  if (!Number.isFinite(seg) || seg < 0) return "0:00";
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Reproductor del audio narrado (MP3 de alta calidad), a la vista y de vidrio:
 * play, barra de avance que se puede tocar, tiempo, duración y velocidad.
 * La etiqueta <audio> sigue siendo la que suena (sin CORS), solo que sin sus
 * controles de fábrica.
 */
function FilePlayer({ url, onFallo }: { url: string; onFallo: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const fondo = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState(1);
  const [conMusica, setConMusica] = useState(false);
  const [sonando, setSonando] = useState(false);
  const [actual, setActual] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const urlMusica = musicaDeFondo();

  function setSpeed(v: number) {
    setRate(v);
    if (ref.current) ref.current.playbackRate = v;
  }

  /*
   * LA MÚSICA SIGUE A LA VOZ, no va por libre.
   *
   * Arranca cuando arranca la lección, se detiene cuando se pausa y se rebobina
   * al terminar. Si fuera un reproductor aparte, quedaría sonando sola cuando
   * la persona para la lección para pensar —justo el momento en que estorba—.
   *
   * El volumen va bajo (0,14) y no se toca: es un fondo, y si compite con la
   * voz hay que subir el volumen general y entonces la música molesta más.
   */
  useEffect(() => {
    const m = fondo.current;
    if (!m) return;
    m.volume = 0.14;
    m.loop = true;
  }, [conMusica]);

  function conLaVoz(accion: "sonar" | "parar" | "volver") {
    const m = fondo.current;
    if (!m || !conMusica) return;
    if (accion === "sonar") void m.play().catch(() => {});
    if (accion === "parar") m.pause();
    if (accion === "volver") {
      m.pause();
      m.currentTime = 0;
    }
  }

  function alternar() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  }

  function buscar(e: React.PointerEvent<HTMLDivElement>) {
    const a = ref.current;
    if (!a || !duracion) return;
    const r = e.currentTarget.getBoundingClientRect();
    const k = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    a.currentTime = k * duracion;
    setActual(a.currentTime);
  }

  function teclas(e: React.KeyboardEvent<HTMLDivElement>) {
    const a = ref.current;
    if (!a || !duracion) return;
    if (e.key === "ArrowRight") a.currentTime = Math.min(duracion, a.currentTime + 5);
    if (e.key === "ArrowLeft") a.currentTime = Math.max(0, a.currentTime - 5);
  }

  const pct = duracion ? Math.min(100, (actual / duracion) * 100) : 0;

  return (
    <div className="tarjeta !rounded-[1.6rem] p-4 sm:p-5">
      <audio
        ref={ref}
        src={url}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={() => {
          if (ref.current) {
            ref.current.playbackRate = rate;
            setDuracion(ref.current.duration);
          }
        }}
        onTimeUpdate={() => {
          if (ref.current) setActual(ref.current.currentTime);
        }}
        onError={onFallo}
        onPlay={() => {
          setSonando(true);
          conLaVoz("sonar");
        }}
        onPause={() => {
          setSonando(false);
          conLaVoz("parar");
        }}
        onEnded={() => {
          setSonando(false);
          conLaVoz("volver");
        }}
      >
        Tu navegador no puede reproducir este audio.
      </audio>

      <div className="flex items-center gap-4">
        <button
          onClick={alternar}
          aria-label={sonando ? "Pausar" : "Escuchar la lección"}
          className="grid h-14 w-14 flex-none place-items-center rounded-full bg-[#f3eee2] shadow-[0_12px_30px_-12px_rgb(243_238_226_/_0.5)] transition hover:bg-white active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#102a24]" aria-hidden>
            {sonando ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />}
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div
            role="slider"
            aria-label="Avance del audio"
            aria-valuemin={0}
            aria-valuemax={Math.round(duracion)}
            aria-valuenow={Math.round(actual)}
            tabIndex={0}
            onPointerDown={buscar}
            onKeyDown={teclas}
            className="relative h-5 cursor-pointer"
          >
            <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-fg/10" />
            <span
              className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#c49a52] to-[#fbefcd]"
              style={{ width: `${pct}%` }}
            />
            <span
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgb(255_255_255_/_0.6)]"
              style={{ left: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs tabular-nums text-muted">
            <span>{mmss(actual)}</span>
            <span>{mmss(duracion)}</span>
          </div>
        </div>
      </div>

      <div
        className="mt-4 grid grid-cols-3 gap-1 rounded-full border border-fg/10 bg-fg/[0.03] p-1"
        role="group"
        aria-label="Velocidad de lectura"
      >
        {RATES.map((r) => (
          <button
            key={r.value}
            onClick={() => setSpeed(r.value)}
            aria-pressed={rate === r.value}
            className={`rounded-full py-2 text-sm font-semibold transition ${
              rate === r.value
                ? "bg-fg/10 text-fg"
                : "text-muted hover:text-fg"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* La música solo se ofrece si de verdad hay un archivo detrás. */}
      {urlMusica && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => {
              const nueva = !conMusica;
              setConMusica(nueva);
              const m = fondo.current;
              if (!m) return;
              if (nueva && ref.current && !ref.current.paused) void m.play().catch(() => {});
              if (!nueva) m.pause();
            }}
            aria-pressed={conMusica}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              conMusica ? "bg-aqua/20 text-aqua" : "text-muted shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.1)] hover:text-fg"
            }`}
          >
            {conMusica ? "Con música de fondo" : "Sin música de fondo"}
          </button>
          <span className="text-xs text-muted">Suena muy bajito, por debajo de la voz.</span>
          <audio ref={fondo} src={urlMusica} preload="none" loop className="hidden" />
        </div>
      )}
    </div>
  );
}

/* ---------- Respaldo: voz del dispositivo (para lecciones sin audio aún) ---------- */

function speechText(lesson: Lesson): string {
  let t = lesson.originalText || "";
  t = t.replace(/^[ \t]*[¹²³⁴][ \t]*N\.[ \t]?T\..*$/gm, ""); // la nota del traductor no se lee
  t = t.replace(/[¹²³⁴]/g, "");
  t = t.replace(/^\s*\d+\.\s*/gm, "");
  t = t.replace(/([\s"“(¿¡])\d{1,2}\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“])/g, "$1");
  t = t.replace(/[ᵃᵇ]\s*/g, ""); // marcas de media frase: no se leen
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
        Este navegador no permite la lectura en voz alta. Prueba con Chrome o Safari
        actualizados.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:p-5">
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
