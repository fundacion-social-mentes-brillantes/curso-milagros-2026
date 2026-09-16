"use client";

import { Seccion } from "./Seccion";
import { useAuth } from "@/components/providers/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { planInfo } from "@/config/planes";
import { SITE } from "@/config/site";

/**
 * TU CUENTA: lo que se puede consultar pero no cambiar desde aquí.
 *
 * El plan y el grupo los asigna un administrador, y el correo viene de Google.
 * Se muestran igual —en vez de esconderlos— porque "¿yo qué plan tengo?" y
 * "¿en qué grupo estoy?" son preguntas que la gente hace, y tenerlas a mano
 * evita una consulta por WhatsApp. Lo que no se toca, se ve pero no se edita.
 */
export function Cuenta() {
  const { appUser, isAdmin, signOutUser } = useAuth();
  if (!appUser) return null;

  const plan = planInfo(appUser.plan);
  const restantes = Math.max(0, SITE.totalLessons - appUser.completedLessonsCount);

  return (
    <Seccion icono="🪪" titulo="Tu cuenta">
      <div className="flex items-center gap-3">
        <Avatar src={appUser.photoURL} name={appUser.displayName} size={48} />
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold">{appUser.displayName}</p>
          <p className="truncate text-sm text-muted">{appUser.email}</p>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-3 border-t border-border pt-4 sm:grid-cols-2">
        <Dato etiqueta="Plan" valor={`${plan.emoji} ${plan.nombre}`} nota={plan.frase} />
        <Dato
          etiqueta="Grupo"
          valor={appUser.grupo?.trim() || "Sin grupo asignado"}
          nota={appUser.grupo?.trim() ? undefined : "Lo asigna quien acompaña el proceso."}
        />
        <Dato
          etiqueta="Vas en la lección"
          valor={String(appUser.currentLesson || 1)}
          nota={`Te quedan ${restantes} de ${SITE.totalLessons}.`}
        />
        <Dato
          etiqueta="En el proceso"
          valor={appUser.enrolled ? "Inscrito" : "No inscrito"}
          nota={
            appUser.enrolled
              ? "Cuentas en las estadísticas del grupo."
              : "Puedes ver todo, pero no apareces en las cifras del grupo."
          }
        />
        {isAdmin && <Dato etiqueta="Permisos" valor="👑 Administración" />}
      </dl>

      <div className="mt-5 border-t border-border pt-4">
        <button onClick={() => void signOutUser()} className="btn-ghost">
          Cerrar sesión
        </button>
        <p className="mt-2 text-xs text-muted">
          Solo cierra la sesión en este aparato. Tu avance queda guardado.
        </p>
      </div>
    </Seccion>
  );
}

function Dato({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-fg">{valor}</dd>
      {nota && <p className="mt-0.5 text-xs leading-snug text-muted">{nota}</p>}
    </div>
  );
}
