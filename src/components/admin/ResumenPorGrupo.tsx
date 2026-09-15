"use client";

import { useMemo } from "react";
import { computeGroupStats } from "@/lib/admin-analytics";
import { isPermanentAdmin } from "@/lib/admins";
import { BarRow } from "@/components/ui/Charts";
import { SITE } from "@/config/site";
import type { AppUser } from "@/types";

/**
 * CÓMO VA CADA GRUPO.
 *
 * Aparece solo cuando hay personas repartidas en grupos. Si todas están en el
 * mismo sitio, las cifras generales del panel ya lo dicen todo.
 *
 * Para qué sirve: cuando se llevan dos procesos a la vez (dos grupos que
 * empezaron en fechas distintas, por ejemplo), las cifras salen mezcladas y no
 * describen a ninguno —un grupo por la 200 y otro recién empezado dan una media
 * que no le corresponde a nadie—. Aquí cada grupo se mira por separado.
 *
 * TODO NÚMERO SE PUEDE TOCAR. Saber que "3 no hicieron hoy" no sirve de nada si
 * no puedes ver QUIÉNES son para escribirles. Cada cifra abre la lista de esas
 * personas, con su botón de WhatsApp y el mensaje ya escrito.
 */

const SIN_GRUPO = "Sin grupo";

export function ResumenPorGrupo({
  users,
  onVerLista,
}: {
  users: AppUser[];
  /** Abre la ventana con una lista de personas (la del panel). */
  onVerLista: (titulo: string, gente: AppUser[], descripcion?: string) => void;
}) {
  const grupos = useMemo(() => {
    // La cuenta de la fundación no es participante: no cuenta en las cifras.
    const gente = users.filter(
      (u) => u.enrolled !== false && !isPermanentAdmin(u.email),
    );

    const inicioDeHoy = new Date();
    inicioDeHoy.setHours(0, 0, 0, 0);
    const hoyMs = inicioDeHoy.getTime();
    const haceUnaSemanaMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const porGrupo = new Map<string, AppUser[]>();
    for (const u of gente) {
      const nombre = (u.grupo || "").trim() || SIN_GRUPO;
      const lista = porGrupo.get(nombre);
      if (lista) lista.push(u);
      else porGrupo.set(nombre, [u]);
    }

    return [...porGrupo.entries()]
      .map(([nombre, miembros]) => ({
        nombre,
        miembros,
        stats: computeGroupStats(miembros),
        hicieronHoy: miembros.filter((u) => u.lastCompletedAt >= hoyMs),
        sinHacerHoy: miembros.filter((u) => u.lastCompletedAt < hoyMs),
        sinEntrarSemana: miembros.filter((u) => u.lastActivityAt < haceUnaSemanaMs),
      }))
      // Los grupos con nombre por orden alfabético; "Sin grupo" al final, que
      // es el cajón de lo que falta por ordenar.
      .sort((a, b) => {
        if (a.nombre === SIN_GRUPO) return 1;
        if (b.nombre === SIN_GRUPO) return -1;
        return a.nombre.localeCompare(b.nombre, "es");
      });
  }, [users]);

  if (grupos.length <= 1) return null;

  const maxLeccion = Math.max(...grupos.map((g) => g.stats.averageCurrentLesson), 1);

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-border p-4">
        <h3 className="font-display text-lg font-semibold">Cómo va cada grupo 👥</h3>
        <p className="text-xs text-muted">
          Toca cualquier número para ver quiénes son y escribirles.
        </p>
      </div>

      {/* Comparación visual: de un vistazo, qué grupo va por delante. */}
      <div className="space-y-2 border-b border-border p-4">
        {grupos.map((g) => (
          <BarRow
            key={g.nombre}
            label={g.nombre}
            value={g.stats.averageCurrentLesson}
            max={maxLeccion}
            hint={`${g.miembros.length} ${g.miembros.length === 1 ? "persona" : "personas"} · ${g.stats.completionRate}%`}
          />
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="p-4 font-semibold">Grupo</th>
              <th className="p-4 font-semibold">Personas</th>
              <th className="p-4 font-semibold">Lección promedio</th>
              <th className="p-4 font-semibold">Más avanzada</th>
              <th className="p-4 font-semibold">Avance</th>
              <th className="p-4 font-semibold">Hicieron hoy</th>
              <th className="p-4 font-semibold">Falta hoy</th>
              <th className="p-4 font-semibold">Sin entrar 7 días</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr key={g.nombre} className="border-b border-border/60 last:border-0">
                <td className="p-4">
                  <button
                    onClick={() =>
                      onVerLista(g.nombre, g.miembros, "todo el grupo")
                    }
                    className={
                      g.nombre === SIN_GRUPO
                        ? "badge bg-muted/15 text-muted transition hover:bg-muted/25"
                        : "badge bg-aqua/15 text-aqua transition hover:bg-aqua/25"
                    }
                  >
                    {g.nombre} →
                  </button>
                </td>
                <td className="p-4 font-semibold tabular-nums">{g.miembros.length}</td>
                <td className="p-4 tabular-nums">{g.stats.averageCurrentLesson}</td>
                <td className="p-4 tabular-nums text-muted">{g.stats.maxLesson}</td>
                <td className="p-4">
                  <span className="font-semibold tabular-nums">
                    {g.stats.completionRate}%
                  </span>
                  <span className="ml-1 text-xs text-muted">de {SITE.totalLessons}</span>
                </td>
                <Celda
                  cantidad={g.hicieronHoy.length}
                  tono="ok"
                  onClick={() =>
                    onVerLista(
                      `${g.nombre} · hicieron hoy`,
                      g.hicieronHoy,
                      "ya marcaron su lección",
                    )
                  }
                />
                <Celda
                  cantidad={g.sinHacerHoy.length}
                  tono="aviso"
                  onClick={() =>
                    onVerLista(
                      `${g.nombre} · les falta hoy`,
                      g.sinHacerHoy,
                      "para acompañarlas con un mensaje",
                    )
                  }
                />
                <Celda
                  cantidad={g.sinEntrarSemana.length}
                  tono="aviso"
                  onClick={() =>
                    onVerLista(
                      `${g.nombre} · sin entrar 7 días`,
                      g.sinEntrarSemana,
                      "llevan una semana sin aparecer",
                    )
                  }
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Un número que se puede tocar para ver quiénes lo componen. */
function Celda({
  cantidad,
  tono,
  onClick,
}: {
  cantidad: number;
  tono: "ok" | "aviso";
  onClick: () => void;
}) {
  const color =
    cantidad === 0 ? "text-muted" : tono === "ok" ? "text-success" : "text-warning";
  return (
    <td className="p-4">
      <button
        onClick={onClick}
        disabled={cantidad === 0}
        className={`rounded-lg px-2 py-1 font-semibold tabular-nums transition ${color} ${
          cantidad === 0 ? "cursor-default" : "hover:bg-surface-2"
        }`}
      >
        {cantidad}
      </button>
    </td>
  );
}
