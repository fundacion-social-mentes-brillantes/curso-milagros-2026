/**
 * MODO DE PRUEBA, SOLO PARA `npm run dev`.
 *
 * Sirve para revisar las pantallas de adentro (Hoy, la lección, Mi camino) en el
 * navegador del computador sin entrar con una cuenta de Google: se abre la app
 * con «?demo» y entra «Ana Prueba», que va en la lección 275 con 269 hechas.
 * Con «?demo=hecha» acaba de marcar la 275 HOY: sirve para ver cómo «Hoy» y
 * «Mi camino» se quedan en la lección del día en vez de saltar a la siguiente.
 *
 * En la app publicada esto NO existe: `esDemo()` mira NODE_ENV, que al
 * construir vale "production", y Next borra todo lo que cuelga de aquí.
 */
import type { AppUser, Progress } from "@/types";

export function esDemo(): boolean {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has("demo")) sessionStorage.setItem("ucdm.demo", q.get("demo") === "hecha" ? "hecha" : "1");
    const v = sessionStorage.getItem("ucdm.demo");
    return v === "1" || v === "hecha";
  } catch {
    return false;
  }
}

const AHORA = Date.now();

export const USUARIO_DEMO: AppUser = {
  uid: "demo",
  displayName: "Ana Prueba",
  email: "demo@prueba.local",
  photoURL: null,
  role: "user",
  fullName: "Ana Prueba",
  country: "Colombia",
  phone: "",
  profileComplete: true,
  enrolled: true,
  voiceReader: false,
  plan: "pro",
  grupo: "",
  createdAt: AHORA,
  lastLoginAt: AHORA,
  lastActivityAt: AHORA,
  currentLesson: 275,
  completedLessonsCount: 269,
  lastCompletedAt: AHORA - 86_400_000,
  hechasHoy: 0,
  puedeAjustarLeccion: false,
};

/** La variante «?demo=hecha»: la 275 quedó marcada hoy. */
function hechaHoy(): boolean {
  try {
    return sessionStorage.getItem("ucdm.demo") === "hecha";
  } catch {
    return false;
  }
}

export function usuarioDemo(): AppUser {
  if (!hechaHoy()) return USUARIO_DEMO;
  return { ...USUARIO_DEMO, currentLesson: 276, completedLessonsCount: 270, lastCompletedAt: AHORA - 60_000, hechasHoy: 1 };
}

/** Hechas de la 1 a la 274, menos cinco que quedaron por retomar. */
export function avanceDemo(): Progress[] {
  const faltan = new Set([38, 39, 112, 201, 247]);
  const out: Progress[] = [];
  for (let n = 1; n <= 274; n++) {
    if (faltan.has(n)) continue;
    out.push({ id: `demo-${n}`, userId: "demo", lessonId: String(n), lessonNumber: n, completed: true, completedAt: AHORA - (275 - n) * 86_400_000 });
  }
  if (hechaHoy()) {
    out.push({ id: "demo-275", userId: "demo", lessonId: "275", lessonNumber: 275, completed: true, completedAt: AHORA - 60_000 });
  }
  return out;
}
