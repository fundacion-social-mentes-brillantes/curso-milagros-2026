"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { getLessonByNumber } from "@/lib/lessons";
import { getLessonProgress } from "@/lib/progress";
import { touchActivity } from "@/lib/users";
import { LessonHeader } from "@/components/lesson/LessonHeader";
import { LessonImage } from "@/components/lesson/LessonImage";
import { VideoPlayer } from "@/components/lesson/VideoPlayer";
import { PracticeToggle } from "@/components/lesson/PracticeToggle";
import { OriginalText } from "@/components/lesson/OriginalText";
import { CommentarySections } from "@/components/lesson/CommentarySections";
import { MarkDoneButton } from "@/components/lesson/MarkDoneButton";
import { Forum } from "@/components/forum/Forum";
import { EmptyState } from "@/components/common/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { SITE } from "@/config/site";
import type { Lesson, Progress } from "@/types";

function LessonInner({ n }: { n: number }) {
  const { appUser } = useAuth();
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

  return (
    <div className="container-page py-8 sm:py-10">
      {/* Lección centrada y cómoda de leer (en PC no se ve ancha ni pesada). */}
      <div className="mx-auto max-w-3xl">
        <LessonHeader
          number={lesson.number}
          title={lesson.title}
          completed={Boolean(progress?.completed)}
          completedAt={progress?.completedAt}
        />
        {/* acento dorado sutil */}
        <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

        <div className="mt-6 space-y-6">
          <LessonImage number={lesson.number} title={lesson.title} />

          <OriginalText lesson={lesson} />

          {/* Video de la lección */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span aria-hidden>🎬</span>
              <h2 className="font-display text-xl font-bold">Video de la lección</h2>
            </div>
            <VideoPlayer video={lesson.video} title={lesson.title} />
          </div>

          {/* Cómo practicarla (texto corto, desplegable) */}
          <PracticeToggle steps={lesson.commentary.practicalInstructions} />

          {/* Marcar como hecha */}
          {appUser && (
            <MarkDoneButton
              uid={appUser.uid}
              lessonNumber={lesson.number}
              completed={Boolean(progress?.completed)}
              completedAt={progress?.completedAt ?? null}
            />
          )}

          {/* Guía completa (opcional, para quien quiera profundizar) */}
          {hasGuide && (
            <div>
              <button
                onClick={() => setShowGuide((v) => !v)}
                aria-expanded={showGuide}
                className="btn-ghost w-full justify-center"
              >
                {showGuide ? "Ocultar la guía completa" : "📖 Ver la guía completa de la lección"}
              </button>
              {showGuide && (
                <div className="mt-5 animate-fade-in">
                  <CommentarySections
                    commentary={lesson.commentary}
                    ready={lesson.commentaryReady}
                  />
                </div>
              )}
            </div>
          )}

          {/* Navegación */}
          <div className="card flex items-center justify-between gap-2 p-3">
            {prev ? (
              <Link href={`/lecciones/${prev}`} className="btn-ghost flex-1 text-sm">
                ← {prev}
              </Link>
            ) : (
              <span className="flex-1" />
            )}
            <Link href="/lecciones" className="btn-ghost text-sm" title="Todas">
              ☰
            </Link>
            {next ? (
              <Link href={`/lecciones/${next}`} className="btn-ghost flex-1 text-sm">
                {next} →
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </div>

          <Forum lessonNumber={lesson.number} />
        </div>
      </div>
    </div>
  );
}

export default function LessonPage({ params }: { params: { numero: string } }) {
  const n = Number(params.numero);
  return (
    <RouteGuard>
      <LessonInner n={n} />
    </RouteGuard>
  );
}
