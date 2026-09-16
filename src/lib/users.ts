"use client";

import type { User } from "firebase/auth";
import { llamar, llamarSeguro, cargarUnaVez } from "@/lib/api";
import type { AppUser, Plan, Role } from "@/types";

/**
 * Personas del proceso.
 *
 * El login sigue siendo el de Google (Firebase); lo que cambió es DÓNDE vive el
 * perfil: antes en Firestore, ahora detrás de la API. Las funciones de este
 * archivo conservan el mismo nombre y la misma forma de siempre, así que
 * ninguna pantalla tuvo que cambiar.
 *
 * Nota sobre `subscribe*`: antes eran "en vivo" (la pantalla se actualizaba
 * sola). Ahora piden los datos una vez. Se mantiene la misma firma —le pasas
 * una función y te devuelve otra para cancelar— para no tocar las pantallas.
 */

/**
 * Asegura que la persona tiene perfil. El servidor lo crea en la primera
 * llamada a `/api/yo`, así que basta con pedirlo.
 *
 * Importante: el rol NUNCA se manda desde aquí. Quien nace, nace participante.
 */
export async function ensureUserProfile(_user: User): Promise<void> {
  await llamarSeguro<AppUser | null>("/yo", null);
}

/**
 * Guarda los datos de registro y marca el perfil como completo.
 *
 * Si la persona dice "voy en la lección 60", el servidor da por hechas las 59
 * anteriores. Eso solo se acepta la PRIMERA vez que se completa el registro:
 * después, el avance solo cambia marcando lecciones una a una.
 */
export async function completeUserProfile(
  _uid: string,
  data: { fullName: string; country: string; phone: string; startLesson?: number },
): Promise<void> {
  await llamar<AppUser>("/yo", {
    metodo: "PATCH",
    cuerpo: {
      fullName: data.fullName,
      country: data.country,
      phone: data.phone,
      ...(data.startLesson ? { startLesson: data.startLesson } : {}),
    },
  });
}

/**
 * Cambia en qué lección va la persona.
 *
 * Para quien entra tarde al proceso y ya venía haciéndolo por su cuenta, o para
 * corregir un número mal puesto. Adelantar da por hechas las anteriores;
 * retroceder solo mueve el número y no borra nada de lo ya marcado.
 */
export async function cambiarLeccionActual(leccion: number): Promise<AppUser> {
  return llamar<AppUser>("/yo/leccion-actual", {
    metodo: "PUT",
    cuerpo: { leccion },
  });
}

/** "Sigo por aquí". Si falla no pasa nada: es solo una estadística. */
export async function touchActivity(_uid: string): Promise<void> {
  await llamarSeguro("/yo/actividad", null, { metodo: "POST" });
}

export function subscribeAppUser(
  _uid: string,
  cb: (user: AppUser | null) => void,
): () => void {
  return cargarUnaVez(() => llamarSeguro<AppUser | null>("/yo", null), cb);
}

export async function getAppUser(_uid: string): Promise<AppUser | null> {
  return llamarSeguro<AppUser | null>("/yo", null);
}

/** (Admin) Lista todas las personas. */
export async function listUsers(): Promise<AppUser[]> {
  const r = await llamarSeguro<{ usuarios: AppUser[] }>("/usuarios", { usuarios: [] });
  return r.usuarios;
}

/** (Admin) Todas las personas. Ya no es en vivo; se piden una vez. */
export function subscribeUsers(cb: (users: AppUser[]) => void): () => void {
  return cargarUnaVez(listUsers, cb);
}

/** Cambio hecho por un admin sobre OTRA persona. */
async function cambiarPersona(uid: string, cambios: Record<string, unknown>): Promise<void> {
  await llamar<AppUser>(`/usuarios/${encodeURIComponent(uid)}`, {
    metodo: "PATCH",
    cuerpo: cambios,
  });
}

/** (Admin) Cambia el rol. Solo lo permite la cuenta principal de la fundación. */
export async function setUserRole(uid: string, role: Role): Promise<void> {
  await cambiarPersona(uid, { role });
}

/** (Admin) Inscribe o desinscribe del proceso activo. */
export async function setUserEnrolled(uid: string, enrolled: boolean): Promise<void> {
  await cambiarPersona(uid, { enrolled });
}

/**
 * (Admin) Activa la lectura en voz alta para una persona
 * (accesibilidad: solo para quien la solicite).
 */
export async function setUserVoiceReader(uid: string, voiceReader: boolean): Promise<void> {
  await cambiarPersona(uid, { voiceReader });
}

/**
 * (Admin) Asigna el grupo de una persona. Vacío la deja sin grupo.
 * Sirve para llevar varios grupos a la vez y ver cada uno por separado.
 */
export async function setUserGrupo(uid: string, grupo: string): Promise<void> {
  await cambiarPersona(uid, { grupo });
}

/**
 * (Admin) Cambia el plan: "pro" (Portador de Luz) u "ordinario" (Caminante).
 * Es lo único que decide si ve el video, a Lumi y la lección narrada.
 */
export async function setUserPlan(uid: string, plan: Plan): Promise<void> {
  await cambiarPersona(uid, { plan });
}
