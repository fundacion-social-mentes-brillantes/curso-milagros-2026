"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  addPost,
  moderatePost,
  softDeletePost,
  subscribeLessonPosts,
} from "@/lib/forum";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { relativeTime } from "@/lib/utils";
import type { ForumPost, ForumStatus } from "@/types";

const STATUS_BADGE: Partial<Record<ForumStatus, string>> = {
  hidden: "Oculto",
  deleted: "Eliminado",
  reviewed: "Revisado",
};

export function Forum({ lessonNumber }: { lessonNumber: number }) {
  const { appUser, isAdmin } = useAuth();
  const [posts, setPosts] = useState<ForumPost[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => subscribeLessonPosts(lessonNumber, setPosts), [lessonNumber]);

  const visible = useMemo(
    () =>
      (posts ?? []).filter((p) =>
        isAdmin ? true : p.status === "visible" || p.status === "reviewed",
      ),
    [posts, isAdmin],
  );

  const roots = visible.filter((p) => !p.parentId);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, ForumPost[]>();
    for (const p of visible) {
      if (p.parentId) {
        const arr = map.get(p.parentId) ?? [];
        arr.push(p);
        map.set(p.parentId, arr);
      }
    }
    return map;
  }, [visible]);

  async function publish() {
    if (!appUser || !text.trim()) return;
    setSending(true);
    try {
      await addPost({ lessonNumber, user: appUser, message: text });
      setText("");
    } finally {
      setSending(false);
    }
  }

  async function publishReply(parentId: string) {
    if (!appUser || !replyText.trim()) return;
    await addPost({ lessonNumber, user: appUser, message: replyText, parentId });
    setReplyText("");
    setReplyTo(null);
  }

  function PostCard({ post, isReply = false }: { post: ForumPost; isReply?: boolean }) {
    const mine = appUser?.uid === post.userId;
    const canModerate = isAdmin;
    const isDeleted = post.status === "deleted";

    return (
      <div className={isReply ? "ml-8 border-l-2 border-border pl-4" : ""}>
        <div className="flex items-start gap-3">
          <Avatar src={post.userPhoto} name={post.userName} size={isReply ? 30 : 38} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{post.userName}</span>
              <span className="text-xs text-muted">{relativeTime(post.createdAt)}</span>
              {canModerate && STATUS_BADGE[post.status] && (
                <span className="badge bg-warning/15 text-warning">{STATUS_BADGE[post.status]}</span>
              )}
            </div>
            <p className={`mt-1 whitespace-pre-line leading-relaxed ${isDeleted ? "italic text-muted" : "text-fg/90"}`}>
              {isDeleted ? "(mensaje eliminado)" : post.message}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold">
              {!isReply && !isDeleted && (
                <button
                  onClick={() => setReplyTo(replyTo === post.id ? null : post.id)}
                  className="text-primary hover:underline"
                >
                  Responder
                </button>
              )}
              {(mine || canModerate) && !isDeleted && (
                <button
                  onClick={() => void softDeletePost(post.id)}
                  className="text-muted hover:text-warning"
                >
                  Borrar
                </button>
              )}
              {canModerate && (
                <>
                  {post.status !== "hidden" ? (
                    <button onClick={() => void moderatePost(post.id, "hidden")} className="text-muted hover:text-fg">
                      Ocultar
                    </button>
                  ) : (
                    <button onClick={() => void moderatePost(post.id, "visible")} className="text-aqua hover:underline">
                      Mostrar
                    </button>
                  )}
                  {post.status !== "reviewed" && post.status !== "deleted" && (
                    <button onClick={() => void moderatePost(post.id, "reviewed")} className="text-muted hover:text-fg">
                      Marcar revisado
                    </button>
                  )}
                </>
              )}
            </div>

            {replyTo === post.id && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className="input"
                  placeholder="Escribe una respuesta amable..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void publishReply(post.id)}
                />
                <button onClick={() => void publishReply(post.id)} className="btn-primary shrink-0">
                  Enviar
                </button>
              </div>
            )}
          </div>
        </div>

        {(repliesByParent.get(post.id) ?? []).map((r) => (
          <div key={r.id} className="mt-4">
            <PostCard post={r} isReply />
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="card p-6 sm:p-7">
      <div className="mb-4 flex items-center gap-2">
        <span aria-hidden>💬</span>
        <h2 className="font-display text-xl font-bold">Foro de la lección</h2>
      </div>

      {/* composer */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <textarea
          className="input min-h-[52px] resize-y"
          rows={2}
          placeholder="Comparte una reflexión o haz una pregunta para el grupo..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={() => void publish()}
          disabled={sending || !text.trim()}
          className="btn-primary h-fit shrink-0 self-end"
        >
          {sending ? <Spinner /> : "Publicar"}
        </button>
      </div>

      {/* lista */}
      <div className="mt-6 space-y-6">
        {posts === null ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : roots.length === 0 ? (
          <EmptyState
            icon="🌼"
            imageSrc="/images/empty-forum.png"
            imageAlt="Ilustración de burbujas de diálogo cálidas para el foro"
            title="Aún no hay mensajes"
            description="Sé la primera persona en compartir lo que esta lección despertó en ti."
          />
        ) : (
          roots.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </section>
  );
}
