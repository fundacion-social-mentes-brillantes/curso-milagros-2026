"use client";

import { useState } from "react";
import { updateLesson } from "@/lib/lessons";
import { Spinner } from "@/components/ui/Spinner";
import type { Lesson, LessonCommentary, VideoStatus, VideoType } from "@/types";

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="ml-2 text-xs text-muted">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function LessonEditor({
  lesson,
  onSaved,
}: {
  lesson: Lesson;
  onSaved: (l: Lesson) => void;
}) {
  const c = lesson.commentary;
  const [form, setForm] = useState({
    title: lesson.title,
    videoType: lesson.video.type,
    videoUrl: lesson.video.url,
    videoStatus: lesson.video.status,
    originalText: lesson.originalText,
    teachingExplanation: c.teachingExplanation,
    purpose: c.purpose,
    practicalInstructions: c.practicalInstructions.join("\n"),
    psychological: c.psychological,
    spiritual: c.spiritual,
    courseRelation: c.courseRelation,
    practiceTips: (c.practiceTips ?? []).join("\n"),
    conclusion: c.conclusion ?? "",
    dailyExamples: (c.dailyExamples ?? []).join("\n"),
    guideTitle: c.guideExample.title,
    guideSituation: c.guideExample.situation,
    guideShift: c.guideExample.shift,
    finalReflection: c.finalReflection,
    glossary: (c.glossary ?? []).map((g) => `${g.term} :: ${g.definition}`).join("\n"),
    commentaryReady: lesson.commentaryReady,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    const glossary = linesToArray(form.glossary)
      .map((line) => {
        const [term, ...rest] = line.split("::");
        return { term: (term ?? "").trim(), definition: rest.join("::").trim() };
      })
      .filter((g) => g.term && g.definition);

    const commentary: LessonCommentary = {
      teachingExplanation: form.teachingExplanation.trim(),
      purpose: form.purpose.trim(),
      practicalInstructions: linesToArray(form.practicalInstructions),
      psychological: form.psychological.trim(),
      spiritual: form.spiritual.trim(),
      courseRelation: form.courseRelation.trim(),
      practiceTips: linesToArray(form.practiceTips),
      conclusion: form.conclusion.trim(),
      dailyExamples: linesToArray(form.dailyExamples),
      guideExample: {
        title: form.guideTitle.trim(),
        situation: form.guideSituation.trim(),
        shift: form.guideShift.trim(),
      },
      finalReflection: form.finalReflection.trim(),
      glossary,
    };

    const originalText = form.originalText;
    const patch: Partial<Lesson> = {
      title: form.title.trim(),
      originalText,
      originalTextLoaded: originalText.trim().length > 0,
      commentary,
      commentaryReady: form.commentaryReady,
      video: {
        type: form.videoType as VideoType,
        url: form.videoUrl.trim(),
        status: form.videoStatus as VideoStatus,
      },
    };

    try {
      await updateLesson(lesson.number, patch);
      onSaved({ ...lesson, ...patch, commentary, updatedAt: Date.now() } as Lesson);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h3 className="font-display text-lg font-semibold">Lección {lesson.number}</h3>
        <div className="mt-4 space-y-4">
          <Field label="Título">
            <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tipo de video">
              <select
                className="input"
                value={form.videoType}
                onChange={(e) => set("videoType", e.target.value as VideoType)}
              >
                <option value="none">Sin video</option>
                <option value="drive">Google Drive</option>
                <option value="youtube">YouTube</option>
                <option value="direct">URL directa (.mp4)</option>
              </select>
            </Field>
            <Field label="Estado">
              <select
                className="input"
                value={form.videoStatus}
                onChange={(e) => set("videoStatus", e.target.value as VideoStatus)}
              >
                <option value="soon">Disponible pronto</option>
                <option value="available">Disponible</option>
              </select>
            </Field>
            <Field label="Enlace del video" hint="pega el link completo">
              <input
                className="input"
                placeholder="https://drive.google.com/file/d/..."
                value={form.videoUrl}
                onChange={(e) => set("videoUrl", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Texto original protegido (solo lectura) */}
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <span aria-hidden>🔒</span>
          <h4 className="font-display font-semibold">Texto original (fijo, solo lectura)</h4>
        </div>
        <p className="mt-1 text-xs text-muted">
          Es la meditación fiel del Curso. No se edita desde aquí para proteger su fidelidad.
        </p>
        <textarea
          readOnly
          className="input mt-3 min-h-[160px] cursor-default bg-surface-2/40 font-serif"
          value={form.originalText}
        />
      </div>

      {/* Comentario mejorado */}
      <div className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h4 className="font-display font-semibold">Contenido explicativo (mejorado)</h4>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.commentaryReady}
              onChange={(e) => set("commentaryReady", e.target.checked)}
            />
            Listo / publicado
          </label>
        </div>

        <Field label="¿Qué me enseña esta lección?">
          <textarea className="input min-h-[120px]" value={form.teachingExplanation} onChange={(e) => set("teachingExplanation", e.target.value)} />
        </Field>
        <Field label="Propósito y sentido">
          <textarea className="input min-h-[90px]" value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
        </Field>
        <Field label="Instrucciones prácticas" hint="un paso por línea">
          <textarea className="input min-h-[110px]" value={form.practicalInstructions} onChange={(e) => set("practicalInstructions", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Aspecto psicológico">
            <textarea className="input min-h-[90px]" value={form.psychological} onChange={(e) => set("psychological", e.target.value)} />
          </Field>
          <Field label="Aspecto espiritual">
            <textarea className="input min-h-[90px]" value={form.spiritual} onChange={(e) => set("spiritual", e.target.value)} />
          </Field>
        </div>
        <Field label="Relación con el resto del Curso">
          <textarea className="input min-h-[80px]" value={form.courseRelation} onChange={(e) => set("courseRelation", e.target.value)} />
        </Field>
        <Field label="Consejos para la práctica" hint="un consejo por línea">
          <textarea className="input min-h-[110px]" value={form.practiceTips} onChange={(e) => set("practiceTips", e.target.value)} />
        </Field>
        <Field label="Conclusión final">
          <textarea className="input min-h-[90px]" value={form.conclusion} onChange={(e) => set("conclusion", e.target.value)} />
        </Field>
        <Field label="Ejemplos cotidianos (opcional)" hint="un ejemplo por línea">
          <textarea className="input min-h-[90px]" value={form.dailyExamples} onChange={(e) => set("dailyExamples", e.target.value)} />
        </Field>
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold">Ejemplo-guía</p>
          <div className="mt-2 space-y-3">
            <input className="input" placeholder="Título del caso" value={form.guideTitle} onChange={(e) => set("guideTitle", e.target.value)} />
            <textarea className="input min-h-[70px]" placeholder="La reacción de siempre..." value={form.guideSituation} onChange={(e) => set("guideSituation", e.target.value)} />
            <textarea className="input min-h-[70px]" placeholder="La nueva mirada..." value={form.guideShift} onChange={(e) => set("guideShift", e.target.value)} />
          </div>
        </div>
        <Field label="Reflexión final">
          <textarea className="input min-h-[70px]" value={form.finalReflection} onChange={(e) => set("finalReflection", e.target.value)} />
        </Field>
        <Field label="Palabras clave (glosario)" hint="formato: término :: definición (una por línea)">
          <textarea className="input min-h-[90px]" value={form.glossary} onChange={(e) => set("glossary", e.target.value)} />
        </Field>
      </div>

      <div className="sticky bottom-3 flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-semibold text-success">✓ Guardado</span>}
        <button onClick={() => void save()} disabled={saving} className="btn-primary shadow-glow">
          {saving ? <Spinner /> : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
