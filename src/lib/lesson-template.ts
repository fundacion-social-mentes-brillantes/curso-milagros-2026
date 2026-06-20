// Módulo PURO (sin "use client", sin Firebase): lo usan la app y los scripts.
// Por eso usa imports relativos, para funcionar también al correr con tsx.
import { lessonDocId, lessonSourceUrl } from "../config/lessons.links";
import { videoFor } from "../config/videos.config";
import type { Lesson, LessonCommentary } from "../types";

export function emptyCommentary(): LessonCommentary {
  return {
    teachingExplanation: "",
    purpose: "",
    practicalInstructions: [],
    psychological: "",
    spiritual: "",
    courseRelation: "",
    practiceTips: [],
    conclusion: "",
    dailyExamples: [],
    guideExample: { title: "", situation: "", shift: "" },
    finalReflection: "",
    glossary: [],
  };
}

/** Construye una lección "plantilla" (estructura vacía lista para llenar). */
export function buildStubLesson(number: number, now: number): Lesson {
  const v = videoFor(number);
  return {
    id: lessonDocId(number),
    number,
    title: "",
    originalText: "",
    originalTextLoaded: false,
    sourceUrl: lessonSourceUrl(number),
    commentary: emptyCommentary(),
    commentaryReady: false,
    video: { type: v.type, url: v.url, status: v.status },
    commonImageUrl: null,
    createdAt: now,
    updatedAt: now,
  };
}
