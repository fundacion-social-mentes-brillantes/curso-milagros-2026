// Módulo PURO (sin "use client", sin Firebase): lo usan la app y los scripts.
// Por eso usa imports relativos, para funcionar también al correr con tsx.
import { lessonDocId, lessonSourceUrl } from "../config/lessons.links";
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
  return {
    id: lessonDocId(number),
    number,
    title: "",
    originalText: "",
    originalTextLoaded: false,
    sourceUrl: lessonSourceUrl(number),
    commentary: emptyCommentary(),
    commentaryReady: false,
    // El video lo pone el mapa automático (public/videos.json, vía Make).
    video: { type: "none", url: "", status: "soon" },
    commonImageUrl: null,
    createdAt: now,
    updatedAt: now,
  };
}
