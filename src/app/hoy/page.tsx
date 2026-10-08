"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { getLessonByNumber } from "@/lib/lessons";
import { getLessonProgress, getUserProgress, leccionDelDia, marcoAlgoHoy } from "@/lib/progress";
import { ideaDeLeccion } from "@/lib/idea-leccion";
import { PrimerParrafo } from "@/components/lesson/OriginalText";
import { Revela } from "@/components/marca/Revela";
import { ICONO_COMPARTE, ICONO_ESCUCHA, ICONO_LEE, ICONO_VIDEO } from "@/components/lesson/TituloSeccion";
import { PageLoader } from "@/components/ui/Spinner";
import { MAX_LECCIONES_DIA, SITE } from "@/config/site";
import type { Lesson } from "@/types";

/** «Hoy · viernes 2 de octubre», con la fecha de Colombia. */
function fechaDeHoy(): string {
  const f = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  }).format(new Date());
  return `Hoy · ${f.replace(",", "")}`;
}

// En el computador, las cuatro tarjetas quedan sueltas alrededor de las líneas,
// como las del video; en el celular van en cuadrícula.
const SUELTAS = ["lg:left-[4%] lg:top-[6%]", "lg:right-[2%] lg:top-[16%]", "lg:left-[10%] lg:top-[54%]", "lg:right-[6%] lg:top-[64%]"];
const RITMOS = ["flota", "flota lenta", "flota calma", "flota lenta"];

/**
 * HOY, al estilo del video de referencia (Sebastián, 2 oct 2026) y con nuestros
 * colores: «Lección» y el número grande en una serif fina, los dos en dorado, la
 * idea del día que se enciende palabra por palabra, el estado y un botón blanco.
 * Luego las cuatro partes del día en tarjetas oscuras que flotan, y un banner
 * esmeralda con el comienzo del texto original.
 */
function HoyInner() {
  const { appUser } = useAuth();
  const actual = Math.min(Math.max(appUser?.currentLesson || 1, 1), SITE.totalLessons);
  // La del día: la que marcó hoy, o la que le toca (ver leccionDelDia).
  const [n, setN] = useState(actual);
  const [hechaHoy, setHechaHoy] = useState(false);
  const [leccion, setLeccion] = useState<Lesson | null | undefined>(undefined);
  const [hecha, setHecha] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    let vivo = true;
    void (async () => {
      // El avance entero solo se pide si hoy marcó algo; si no, la del día es la actual.
      const dia = marcoAlgoHoy(appUser.lastCompletedAt)
        ? leccionDelDia(actual, await getUserProgress(appUser.uid))
        : { numero: actual, hechaHoy: false };
      const [l, p] = await Promise.all([
        getLessonByNumber(dia.numero).catch(() => null),
        dia.hechaHoy ? null : getLessonProgress(appUser.uid, dia.numero).catch(() => null),
      ]);
      if (!vivo) return;
      setN(dia.numero);
      setHechaHoy(dia.hechaHoy);
      setHecha(dia.hechaHoy || Boolean(p?.completed));
      setLeccion(l);
    })();
    return () => {
      vivo = false;
    };
  }, [actual, appUser?.uid, appUser?.lastCompletedAt]);

  if (!appUser || leccion === undefined) return <PageLoader label="Preparando tu lección de hoy…" />;
  // Ya hizo la de hoy: puede adelantar la siguiente si el tope del día lo permite.
  const puedeSeguir = hechaHoy && actual !== n && (appUser.hechasHoy ?? 0) < MAX_LECCIONES_DIA;
  const titulo = leccion?.title ?? "";
  const { idea } = ideaDeLeccion(titulo, n);
  const conAudio = appUser.plan !== "ordinario" || appUser.role === "admin" || Boolean(appUser.voiceReader);
  const texto = leccion?.originalTextLoaded ? leccion.originalText : "";

  const pasos = [
    ...(conAudio ? [{ id: "escucha", titulo: "Escucha", d: "La lección narrada, a tu ritmo.", icono: ICONO_ESCUCHA }] : []),
    { id: "lee", titulo: "Lee", d: "El texto original, tal cual.", icono: ICONO_LEE },
    { id: "video", titulo: "Mira el video", d: "Una guía breve de la lección.", icono: ICONO_VIDEO },
    { id: "comenta", titulo: "Comparte", d: "Tu experiencia en Facebook.", icono: ICONO_COMPARTE },
  ];

  return (
    <div className="container-page pb-12 pt-2 md:pt-6">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-10">
        {/* El titular, la idea y el botón */}
        <section className="relative isolate">
          <span className="orbe -z-10 left-[78%] top-[12rem] h-[22rem] w-[22rem] lg:hidden" aria-hidden />
          <p className="etiqueta aparece">{fechaDeHoy()}</p>
          {/* Como la imagen de Sebastián: «Lección» en la letra moderna y el número,
              grande, en una serif fina de alto contraste; los dos en dorado. */}
          <h1 className="aparece mt-4 [animation-delay:.08s]">
            <span className="titular oro-brillo block w-fit text-[2.7rem] md:text-[3.4rem]">Lección</span>
            <span className="mt-3 flex items-end gap-3">
              <span className="letra-display oro-brillo text-[7.4rem] md:text-[9.2rem]">{n}</span>
              <span className="mb-[0.9rem] text-[1.05rem] font-medium tracking-[-0.02em] text-muted md:mb-[1.2rem]">
                de {SITE.totalLessons}
              </span>
            </span>
          </h1>

          {idea && (
            <div className="mt-8 max-w-[34rem]">
              <p className="etiqueta aparece [animation-delay:.2s]">La idea de hoy</p>
              <Revela
                texto={idea}
                retraso={500}
                className="mt-2 text-[1.55rem] font-medium leading-[1.3] tracking-[-0.03em] md:text-[1.9rem]"
              />
            </div>
          )}

          <div className="aparece mt-8 flex flex-wrap items-center gap-3 [animation-delay:.35s]">
            <Link href={`/lecciones/${n}`} className="boton-blanco">
              {hecha ? "Volver a la lección" : "Empezar la lección"}
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
                <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />
              </svg>
            </Link>
            {hecha ? (
              <span className="estado encendida">
                <i aria-hidden />
                Encendida
              </span>
            ) : (
              <span className="estado">
                <i aria-hidden />
                Pendiente · enciéndela al terminar
              </span>
            )}
          </div>
          {hechaHoy && actual !== n && (
            <p className="aparece mt-5 max-w-[34rem] text-[0.95rem] leading-relaxed text-muted [animation-delay:.42s]">
              Ya la hiciste hoy. Repite su idea durante el día; mañana sigues con la {actual}.
              {puedeSeguir && (
                <>
                  {" "}
                  <Link href={`/lecciones/${actual}`} className="font-medium text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-fg">
                    Seguir ya con la {actual}
                  </Link>
                </>
              )}
            </p>
          )}
        </section>

        {/* Las cuatro partes del día */}
        <section className="relative isolate mt-16 lg:mt-0 lg:h-[34rem]">
          <span className="orbe -z-10 left-1/2 top-1/2 hidden h-[30rem] w-[36rem] lg:block" aria-hidden />
          <h2 className="titulo-seccion text-[2rem] lg:hidden">
            Tu práctica <em>de hoy</em>
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:mt-0 lg:block">
            {pasos.map((p, i) => (
              <div
                key={p.id}
                className={`aparece lg:absolute lg:w-[15.5rem] ${SUELTAS[i] ?? ""}`}
                style={{ animationDelay: `${0.45 + i * 0.1}s` }}
              >
                <Link href={`/lecciones/${n}#${p.id}`} className={`tarjeta block h-full p-4 transition hover:border-fg/20 ${RITMOS[i]}`}>
                  <span className="circulo-icono">
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path d={p.icono} />
                    </svg>
                  </span>
                  <b className="mt-4 block text-[1rem] font-semibold tracking-[-0.02em]">{p.titulo}</b>
                  <small className="mt-1 block text-[0.82rem] leading-snug text-muted">{p.d}</small>
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* El comienzo del texto original, en un banner esmeralda */}
      <article className="banner aparece mt-16 grid gap-6 p-6 [animation-delay:.6s] md:mt-20 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:p-10">
        <div>
          <p className="text-[0.82rem] font-medium text-white/70">Texto original · Libro de ejercicios</p>
          <h2 className="titular mt-3 text-[2.1rem] text-white md:text-[2.8rem]">
            Empieza a <em>leer</em>
          </h2>
          {titulo && <p className="mt-3 text-[1.05rem] font-medium leading-snug text-white/85">{titulo}</p>}
          <Link href={`/lecciones/${n}#lee`} className="boton-blanco mt-6 hidden md:inline-flex">
            {hecha ? "Volver a la lección" : `Seguir leyendo la ${n}`}
          </Link>
        </div>
        {texto && (
          <div className="relative max-h-[15rem] overflow-hidden text-white/90 [mask-image:linear-gradient(180deg,#000_50%,transparent)]">
            <PrimerParrafo text={texto} />
          </div>
        )}
        <Link href={`/lecciones/${n}#lee`} className="boton-blanco md:hidden">
          {hecha ? "Volver a la lección" : `Seguir leyendo la ${n}`}
        </Link>
      </article>
    </div>
  );
}

export default function HoyPage() {
  return (
    <RouteGuard>
      <HoyInner />
    </RouteGuard>
  );
}
