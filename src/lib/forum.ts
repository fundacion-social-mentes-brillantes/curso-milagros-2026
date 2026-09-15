"use client";

import { llamar, llamarSeguro, cargarUnaVez } from "@/lib/api";
import type { AppUser, ForumPost, ForumStatus } from "@/types";

/**
 * Foro de cada lección.
 *
 * Dos cosas cambiaron al salir de Firestore:
 *
 * 1. Ya no es "en vivo". Antes los mensajes nuevos aparecían solos; ahora la
 *    lista se pide al abrir y al publicar. Con el uso que tiene, casi no se nota.
 *
 * 2. El autor ya NO viaja desde el navegador. Antes se mandaban nombre y foto
 *    junto al mensaje, y quien supiera hacerlo podía publicar con el nombre de
 *    otra persona. Ahora el servidor lo saca del pase de Google.
 */

async function pedirMensajes(n: number): Promise<ForumPost[]> {
  const r = await llamarSeguro<{ mensajes: ForumPost[] }>(`/foro/${n}`, {
    mensajes: [],
  });
  return [...r.mensajes].sort((a, b) => a.createdAt - b.createdAt);
}

/** Mensajes de una lección, del más viejo al más nuevo. */
export function subscribeLessonPosts(
  n: number,
  cb: (posts: ForumPost[]) => void,
): () => void {
  return cargarUnaVez(() => pedirMensajes(n), cb);
}

/** Vuelve a pedir los mensajes (después de publicar o moderar). */
export async function listLessonPosts(n: number): Promise<ForumPost[]> {
  return pedirMensajes(n);
}

export async function addPost(args: {
  lessonNumber: number;
  user: Pick<AppUser, "uid" | "displayName" | "photoURL">;
  message: string;
  parentId?: string | null;
}): Promise<void> {
  const message = args.message.trim();
  if (!message) return;
  // `user` se conserva en la firma para no tocar las pantallas, pero NO se
  // envía: el servidor decide quién eres. Suplantar ya no es posible.
  await llamar(`/foro/${args.lessonNumber}`, {
    metodo: "POST",
    cuerpo: { message, parentId: args.parentId ?? null },
  });
}

/**
 * Cambia el estado de un mensaje.
 *
 * Recibe el mensaje entero (no solo su id) porque ahora hace falta saber a qué
 * lección pertenece: es lo que le dice al servidor dónde está guardado.
 */
export async function moderatePost(
  post: Pick<ForumPost, "id" | "lessonNumber">,
  status: ForumStatus,
): Promise<void> {
  await llamar(`/foro/${post.lessonNumber}/${encodeURIComponent(post.id)}`, {
    metodo: "PATCH",
    cuerpo: { status },
  });
}

/** Borrado suave. Lo puede hacer el autor con el suyo, o un admin con cualquiera. */
export async function softDeletePost(
  post: Pick<ForumPost, "id" | "lessonNumber">,
): Promise<void> {
  await moderatePost(post, "deleted");
}

/** (Admin) Mensajes recientes de todas las lecciones, para moderar. */
export function subscribeRecentPosts(
  cb: (posts: ForumPost[]) => void,
  _max = 200,
): () => void {
  return cargarUnaVez(
    async () =>
      (
        await llamarSeguro<{ mensajes: ForumPost[] }>("/foro-reciente", {
          mensajes: [],
        })
      ).mensajes,
    cb,
  );
}
