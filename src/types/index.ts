/**
 * Modelo de datos — Curso de Milagros 2026
 *
 * REGLA DE ORO: `originalText` es el texto del Curso y NO se modifica nunca.
 * Todo el contenido explicativo vive en campos separados (commentary).
 */

export type Role = "admin" | "user";

export type UserStatus = "active" | "paused" | "inactive";

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  role: Role;
  /** Datos de registro (los llena la persona al entrar por primera vez) */
  fullName: string;
  country: string;
  phone: string;
  /** true cuando ya completó sus datos de registro */
  profileComplete: boolean;
  /**
   * Inscrito en el proceso activo: cuenta en las estadísticas y aparece en la
   * lista activa. Los no inscritos siguen registrados y pueden ver todo, pero
   * no afectan las métricas del grupo que sí está haciendo el curso.
   */
  enrolled: boolean;
  /** Marca de tiempo en milisegundos (Date.now) */
  createdAt: number;
  lastLoginAt: number;
  lastActivityAt: number;
  /** Número de la última/actual lección en la que va la persona (1..365) */
  currentLesson: number;
  completedLessonsCount: number;
  /** Última vez (ms) que marcó una lección como hecha; 0 si nunca. */
  lastCompletedAt: number;
}

/** Estado del video asociado a una lección. */
export type VideoStatus = "available" | "soon";

/** De dónde se reproduce el video. */
export type VideoType = "drive" | "youtube" | "direct" | "none";

export interface LessonVideo {
  type: VideoType;
  /** URL o ID según el tipo (ver lib/video.ts) */
  url: string;
  status: VideoStatus;
}

/**
 * Contenido explicativo MEJORADO (editable). Separado por completo del texto
 * original. Cada campo corresponde a una sección de la página de lección.
 */
export interface LessonCommentary {
  /** "¿Qué me enseña esta lección?" */
  teachingExplanation: string;
  /** "Propósito y sentido de la lección" */
  purpose: string;
  /** "Instrucciones prácticas" — pasos */
  practicalInstructions: string[];
  /** "Aspectos psicológicos y espirituales" */
  psychological: string;
  spiritual: string;
  /** "Relación con el resto del Curso" */
  courseRelation: string;
  /** "Consejos para la práctica" — puntos breves */
  practiceTips: string[];
  /** "Conclusión final" */
  conclusion: string;
  /** "Ejemplos cotidianos" (opcional) */
  dailyExamples: string[];
  /** "Ejemplo-guía" — caso desarrollado */
  guideExample: {
    title: string;
    situation: string;
    shift: string;
  };
  /** "Reflexión final" — pregunta para observarse */
  finalReflection: string;
  /** Glosario opcional de términos difíciles que aparecen en la lección */
  glossary?: GlossaryTerm[];
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface Lesson {
  /** id del documento = número con ceros, p.ej. "025" */
  id: string;
  number: number;
  title: string;
  /** Texto canónico del Curso. INMUTABLE. */
  originalText: string;
  /** true cuando originalText ya fue cargado (importado o pegado) */
  originalTextLoaded: boolean;
  /** Link a la fuente del texto original (blog) */
  sourceUrl: string;
  /** Contenido explicativo mejorado */
  commentary: LessonCommentary;
  /** true cuando el comentario ya fue redactado (no es plantilla vacía) */
  commentaryReady: boolean;
  video: LessonVideo;
  commonImageUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Progreso de un usuario en una lección. doc id = `${uid}_${number}` */
export interface Progress {
  id: string;
  userId: string;
  lessonId: string;
  lessonNumber: number;
  completed: boolean;
  completedAt: number | null;
}

export type ForumStatus = "visible" | "hidden" | "deleted" | "reviewed";

export interface ForumPost {
  id: string;
  lessonNumber: number;
  userId: string;
  userName: string;
  userPhoto: string | null;
  message: string;
  createdAt: number;
  /** null si es post raíz; id del post padre si es respuesta */
  parentId: string | null;
  status: ForumStatus;
}

export interface AdminSettings {
  adminEmails: string[];
  activeCourseYear: number;
  currentGlobalLesson?: number;
}

/** Métricas calculadas para el panel admin. */
export interface GroupStats {
  totalUsers: number;
  activeToday: number;
  active7d: number;
  inactive7d: number;
  averageCurrentLesson: number;
  maxLesson: number;
  modeLesson: number;
  completionRate: number;
}
