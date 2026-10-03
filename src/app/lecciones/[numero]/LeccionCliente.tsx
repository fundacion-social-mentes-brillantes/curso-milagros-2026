"use client";

// ────────────────────────────────────────────────────────────────────────────
// Este archivo es TODO lo que antes estaba en `page.tsx`. No se cambió nada de
// lo que se ve ni de cómo funciona: solo se mudó de sitio.
//
// ¿Por qué la mudanza? Porque el sitio ahora se exporta como archivos estáticos
// (ver `next.config.mjs`). Para eso, Next necesita que la página le diga de
// antemano la lista de las 365 lecciones que debe generar, y esa lista solo la
// puede dar una página "de servidor" (una que se calcula al compilar). Pero
// esta pantalla es "de cliente" (usa el usuario que inició sesión, botones,
// desplegables...), y una página de cliente no puede dar esa lista.
//
// Solución: `page.tsx` se quedó como una cáscara mínima de servidor que entrega
// la lista, y todo el contenido de verdad vive aquí, en el cliente.
// ────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { getLessonByNumber } from "@/lib/lessons";
import { getLessonProgress } from "@/lib/progress";
import { touchActivity } from "@/lib/users";
import { formatDate } from "@/lib/utils";
import { VideoPlayer } from "@/components/lesson/VideoPlayer";
import { PracticeToggle } from "@/components/lesson/PracticeToggle";
import { OriginalText } from "@/components/lesson/OriginalText";
import { Repaso } from "@/components/lesson/Repaso";
import { LessonReader } from "@/components/lesson/LessonReader";
import { CommentarySections } from "@/components/lesson/CommentarySections";
import { MarkDoneButton } from "@/components/lesson/MarkDoneButton";
import { SoloPro } from "@/components/lesson/SoloPro";
import { Cuaderno } from "@/components/lesson/Cuaderno";
import { ICONO_COMPARTE, ICONO_ESCUCHA, ICONO_VIDEO, TituloSeccion } from "@/components/lesson/TituloSeccion";
import { Forum } from "@/components/forum/Forum";
import { useEncender } from "@/components/marca/Revela";
import { EmptyState } from "@/components/common/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { SITE } from "@/config/site";
import type { Lesson, Progress } from "@/types";

/**
 * Parte de la práctica del día: comentar las meditaciones en Facebook. Es el
 * único lugar con azul en toda la app, y su tarjeta va rodeada de luz azul (el
 * video, en cambio, de luz dorada).
 */
function FacebookReminder() {
  return (
    <div className="vidrio halo-azul rounded-[1.8rem] px-5 py-7 text-center sm:px-8">
      <p className="etiqueta !text-[rgb(170_205_255)]">Parte de tu práctica de hoy</p>
      <p className="frase-luz mx-auto mt-4 max-w-[24rem] text-[1.2rem] font-semibold leading-snug">
        “Lo que hoy aprendiste puede ser una guía y una luz para otra persona.”
      </p>
      <p className="mx-auto mt-3 max-w-[22rem] text-[0.95rem] leading-relaxed text-fg/70">
        Deja tus comentarios en la meditación de hoy.
      </p>
      <a
        href={SITE.facebookUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-gradient-to-b from-[#2a86ff] to-[#1877F2] px-5 py-3.5 text-[1rem] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.35),0_16px_34px_-16px_rgb(24_119_242_/_0.9)] transition hover:brightness-110 active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden>
          <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.9h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z" />
        </svg>
        Dejar mis comentarios
      </a>
    </div>
  );
}

function LessonInner({ n }: { n: number }) {
  const { appUser } = useAuth();
  // Plan Pro: ve el video, la lección narrada y sus logros. Los admin siempre.
  const esPro = appUser?.plan !== "ordinario" || appUser?.role === "admin";
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    let active = true;
    getLessonByNumber(n)
      .then((l) => active && setLesson(l))
      .catch(() => active && setLesson(null));
    if (appUser) {
      getLessonProgress(appUser.uid, n).then((p) => active && setProgress(p));
      void touchActivity(appUser.uid);
    }
    return () => {
      active = false;
    };
  }, [n, appUser?.uid]);

  useEncender(lesson);

  if (!Number.isInteger(n) || n < 1 || n > SITE.totalLessons) {
    return (
      <div className="container-page py-12">
        <EmptyState
          icon="🧭"
          title="Esa lección no existe"
          description={`El proceso tiene ${SITE.totalLessons} lecciones (de la 1 a la ${SITE.totalLessons}).`}
          action={
            <Link href="/lecciones" className="btn-primary mt-2">
              Ver lecciones
            </Link>
          }
        />
      </div>
    );
  }

  if (lesson === undefined) return <PageLoader label={`Cargando lección ${n}...`} />;

  if (lesson === null) {
    return (
      <div className="container-page py-12">
        <EmptyState
          icon="🌱"
          title={`La lección ${n} todavía no está creada`}
          description="Aún no se ha cargado en la base de datos. Vuelve pronto."
          action={
            <Link href="/lecciones" className="btn-ghost mt-2">
              Volver a las lecciones
            </Link>
          }
        />
      </div>
    );
  }

  const prev = n > 1 ? n - 1 : null;
  const next = n < SITE.totalLessons ? n + 1 : null;
  const hasGuide =
    lesson.commentaryReady && Boolean(lesson.commentary.teachingExplanation);

  const completada = Boolean(progress?.completed);

  return (
    <div className="container-page pb-10 pt-1 sm:pt-3">
      {/* La lección es una sola página: se lee de arriba a abajo, sin entrar a otras
          pantallas. Todo va en UNA columna del mismo ancho (audio, texto, video y
          Facebook), centrada, para que haya simetría. */}
      <div className="mx-auto max-w-[40rem]">
        <Link href="/lecciones" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-fg">
          <span aria-hidden>←</span> Todas las lecciones
        </Link>

        {/* 01 · Encabezado, como la imagen de Sebastián: «Lección» en la letra
            moderna y el número grande en una serif fina, los dos en dorado, con una
            luz que se mueve detrás; luego el título en blanco y el estado. */}
        <header className="relative isolate mt-6 text-center">
          <span className="orbe -z-10 left-1/2 top-[5.6rem] h-[18rem] w-[24rem] md:w-[30rem]" aria-hidden />
          <p className="titular oro-brillo aparece mx-auto w-fit text-[2.3rem] md:text-[2.8rem]">Lección</p>
          <p className="letra-display oro-brillo aparece mt-3 text-[7.2rem] [animation-delay:.06s] md:text-[9rem]">{lesson.number}</p>
          <p className="etiqueta aparece mt-3 [animation-delay:.1s]">de {SITE.totalLessons}</p>
          <h1
            className={`titular aparece mx-auto mt-5 max-w-[34rem] [animation-delay:.14s] ${
              (lesson.title || "").length > 70 ? "text-[1.6rem] md:text-[2rem]" : "text-[2rem] md:text-[2.6rem]"
            }`}
          >
            {lesson.title || `Lección ${lesson.number}`}
          </h1>
          <p className="aparece mt-6 [animation-delay:.22s]">
            {completada ? (
              <span className="estado encendida">
                <i aria-hidden />
                Encendida{progress?.completedAt ? ` · ${formatDate(progress.completedAt)}` : ""}
              </span>
            ) : (
              <span className="estado">
                <i aria-hidden />
                Pendiente · enciéndela al terminar
              </span>
            )}
          </p>
        </header>

        <div className="mt-20 space-y-24">
          {/* Los días de repaso, lo primero es saber QUÉ se repasa. Sin esto,
              el título ("El repaso de hoy abarca las siguientes ideas") deja a
              la persona sin saber por dónde empezar. */}
          <Repaso lessonNumber={lesson.number} />

          {/* 02 · Escucha la lección: a la vista, no detrás de otro botón. Es del
              plan Pro, pero se respeta la activación de accesibilidad (voiceReader). */}
          {(esPro || appUser?.voiceReader) && (
            <section id="escucha" className="scroll-mt-6">
              <TituloSeccion icono={ICONO_ESCUCHA} primera="Escucha" acento="la lección" />
              <div className="flota">
                <LessonReader lesson={lesson} />
              </div>
            </section>
          )}

          {/* 03 · Texto original (intocable) */}
          <div id="lee" className="scroll-mt-6">
            <OriginalText lesson={lesson} />
          </div>

          {/* 04 · Video, embebido: solo hay que tocar Play. */}
          <section id="video" className="scroll-mt-6">
            <TituloSeccion icono={ICONO_VIDEO} primera="Video" acento="de la lección" />
            {esPro ? (
              <div className="flota lenta">
                <VideoPlayer video={lesson.video} title={lesson.title} numero={lesson.number} />
              </div>
            ) : (
              <SoloPro
                icono="🎬"
                titulo="El video de hoy es del plan Pro"
                descripcion="Cada lección tiene su video explicado. Tu texto y tu guía completa siguen aquí, siempre."
              />
            )}
          </section>

          {/* 05 · Facebook: parte de la práctica de hoy */}
          <section id="comenta" className="scroll-mt-6">
            <TituloSeccion icono={ICONO_COMPARTE} primera="Comparte" acento="tu experiencia" />
            <div className="flota calma">
              <FacebookReminder />
            </div>
          </section>

          {/* 06 · Marcar como lección leída */}
          {appUser && (
            <MarkDoneButton
              uid={appUser.uid}
              lessonNumber={lesson.number}
              lessonTitle={lesson.title}
              completed={completada}
              completedAt={progress?.completedAt ?? null}
              currentLesson={appUser.currentLesson || 1}
              hechasHoy={appUser.hechasHoy ?? 0}
              mostrarPuesto={esPro}
            />
          )}

          {/* Mi cuaderno: la línea del día, privada. Al final del año es su libro. */}
          {appUser && esPro && <Cuaderno uid={appUser.uid} lessonNumber={lesson.number} />}

          {/* Cómo practicarla (texto corto, desplegable) */}
          <PracticeToggle steps={lesson.commentary.practicalInstructions} />

          {/* Guía completa (opcional, para quien quiera profundizar) */}
          {hasGuide && (
            <div>
              <button
                onClick={() => setShowGuide((v) => !v)}
                aria-expanded={showGuide}
                className="btn-ghost w-full justify-center py-3"
              >
                {showGuide ? "Ocultar la guía completa" : "Ver la guía completa de la lección"}
              </button>
              {showGuide && (
                <div className="mt-5 animate-fade-in">
                  <CommentarySections commentary={lesson.commentary} ready={lesson.commentaryReady} />
                </div>
              )}
            </div>
          )}

          {/* Navegación */}
          <nav className="flex items-center justify-between gap-2" aria-label="Otras lecciones">
            {prev ? (
              <Link href={`/lecciones/${prev}`} className="btn-ghost flex-1 py-3 text-sm">
                ← Lección {prev}
              </Link>
            ) : (
              <span className="flex-1" />
            )}
            {next ? (
              <Link href={`/lecciones/${next}`} className="btn-ghost flex-1 py-3 text-sm">
                Lección {next} →
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </nav>

          <Forum lessonNumber={lesson.number} />
        </div>
      </div>
    </div>
  );
}

/**
 * Pantalla de una lección. Recibe el número tal cual viene de la dirección web
 * (`/lecciones/42` → "42"), exactamente igual que antes.
 */
export default function LeccionCliente({ numero }: { numero: string }) {
  const n = Number(numero);
  return (
    <RouteGuard>
      <LessonInner n={n} />
    </RouteGuard>
  );
}
