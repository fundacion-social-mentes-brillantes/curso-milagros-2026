"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getDb } from "@/lib/firebase";
import type { AppUser, Role } from "@/types";

function toAppUser(uid: string, data: Record<string, unknown>): AppUser {
  return {
    uid,
    displayName: String(data.displayName ?? "Caminante"),
    email: String(data.email ?? ""),
    photoURL: (data.photoURL as string | null) ?? null,
    role: (data.role as Role) ?? "user",
    fullName: String(data.fullName ?? data.displayName ?? ""),
    country: String(data.country ?? ""),
    phone: String(data.phone ?? ""),
    profileComplete: Boolean(data.profileComplete),
    // Si el campo no existe (usuarios antiguos), se asume inscrito.
    enrolled: data.enrolled === undefined ? true : Boolean(data.enrolled),
    createdAt: Number(data.createdAt ?? 0),
    lastLoginAt: Number(data.lastLoginAt ?? 0),
    lastActivityAt: Number(data.lastActivityAt ?? 0),
    currentLesson: Number(data.currentLesson ?? 1),
    completedLessonsCount: Number(data.completedLessonsCount ?? 0),
  };
}

/**
 * Crea el perfil si no existe y actualiza datos de login.
 * NUNCA escala el rol: en creación queda como "user" (el admin se asigna
 * en el servidor vía /api/session).
 */
export async function ensureUserProfile(user: User): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const now = Date.now();

  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: user.displayName ?? "Caminante",
      email: user.email ?? "",
      photoURL: user.photoURL ?? null,
      role: "user" satisfies Role,
      fullName: user.displayName ?? "",
      country: "",
      phone: "",
      profileComplete: false,
      enrolled: true,
      createdAt: now,
      lastLoginAt: now,
      lastActivityAt: now,
      currentLesson: 1,
      completedLessonsCount: 0,
    });
    return;
  }

  await updateDoc(ref, {
    displayName: user.displayName ?? "Caminante",
    photoURL: user.photoURL ?? null,
    lastLoginAt: now,
    lastActivityAt: now,
  });
}

/** Guarda los datos de registro y marca el perfil como completo. */
export async function completeUserProfile(
  uid: string,
  data: { fullName: string; country: string; phone: string },
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, "users", uid), {
    fullName: data.fullName.trim(),
    displayName: data.fullName.trim() || "Caminante",
    country: data.country.trim(),
    phone: data.phone.trim(),
    profileComplete: true,
    lastActivityAt: Date.now(),
  });
}

export async function touchActivity(uid: string): Promise<void> {
  const db = getDb();
  try {
    await updateDoc(doc(db, "users", uid), { lastActivityAt: Date.now() });
  } catch {
    /* silencioso: no debe romper la app */
  }
}

export function subscribeAppUser(
  uid: string,
  cb: (user: AppUser | null) => void,
): () => void {
  const db = getDb();
  return onSnapshot(doc(db, "users", uid), (snap) => {
    cb(snap.exists() ? toAppUser(snap.id, snap.data()) : null);
  });
}

export async function getAppUser(uid: string): Promise<AppUser | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? toAppUser(snap.id, snap.data()) : null;
}

/** (Admin) Lista todas las personas. */
export async function listUsers(): Promise<AppUser[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => toAppUser(d.id, d.data()));
}

/** (Admin) Cambia el rol de una persona. */
export async function setUserRole(uid: string, role: Role): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, "users", uid), { role });
}

/** (Admin) Inscribe o desinscribe a una persona del proceso activo. */
export async function setUserEnrolled(uid: string, enrolled: boolean): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, "users", uid), { enrolled });
}
