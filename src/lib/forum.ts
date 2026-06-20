"use client";

import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { AppUser, ForumPost, ForumStatus } from "@/types";

function toPost(id: string, data: Record<string, unknown>): ForumPost {
  return {
    id,
    lessonNumber: Number(data.lessonNumber ?? 0),
    userId: String(data.userId ?? ""),
    userName: String(data.userName ?? "Caminante"),
    userPhoto: (data.userPhoto as string | null) ?? null,
    message: String(data.message ?? ""),
    createdAt: Number(data.createdAt ?? 0),
    parentId: (data.parentId as string | null) ?? null,
    status: (data.status as ForumStatus) ?? "visible",
  };
}

/**
 * Escucha los mensajes de una lección. Una sola condición de igualdad
 * (sin orderBy) evita índices compuestos; se ordena en el cliente.
 */
export function subscribeLessonPosts(
  n: number,
  cb: (posts: ForumPost[]) => void,
): () => void {
  const db = getDb();
  const q = query(collection(db, "forumPosts"), where("lessonNumber", "==", n));
  return onSnapshot(q, (snap) => {
    const posts = snap.docs
      .map((d) => toPost(d.id, d.data()))
      .sort((a, b) => a.createdAt - b.createdAt);
    cb(posts);
  });
}

export async function addPost(args: {
  lessonNumber: number;
  user: Pick<AppUser, "uid" | "displayName" | "photoURL">;
  message: string;
  parentId?: string | null;
}): Promise<void> {
  const message = args.message.trim();
  if (!message) return;
  const db = getDb();
  await addDoc(collection(db, "forumPosts"), {
    lessonNumber: args.lessonNumber,
    userId: args.user.uid,
    userName: args.user.displayName,
    userPhoto: args.user.photoURL ?? null,
    message,
    createdAt: Date.now(),
    parentId: args.parentId ?? null,
    status: "visible" satisfies ForumStatus,
  });
}

/** (Admin) Cambia el estado de un mensaje: ocultar, revisar, restaurar. */
export async function moderatePost(
  id: string,
  status: ForumStatus,
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, "forumPosts", id), { status });
}

/** Borrado suave (autor o admin): marca como "deleted". */
export async function softDeletePost(id: string): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, "forumPosts", id), { status: "deleted" });
}

/** (Admin) Mensajes recientes de todas las lecciones, para moderar. */
export function subscribeRecentPosts(
  cb: (posts: ForumPost[]) => void,
  max = 200,
): () => void {
  const db = getDb();
  const q = query(
    collection(db, "forumPosts"),
    orderBy("createdAt", "desc"),
    limit(max),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toPost(d.id, d.data())));
  });
}
