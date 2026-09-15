"use client";

import { useMemo } from "react";
import { computeGroupStats } from "@/lib/admin-analytics";
import { isPermanentAdmin } from "@/lib/admins";
import { SITE } from "@/config/site";
import type { AppUser } from "@/types";

/**
 * CÓMO VA CADA GRUPO.
 *
 * Aparece solo cuando hay personas repartidas en grupos. Si todas están en el
 * mismo sitio, las cifras generales del panel ya lo dicen todo y esta tabla
 * sobraría.
 *
 * Para qué sirve: cuando se llevan dos procesos a la vez (dos grupos que
 * empezaron en fechas distintas, por ejemplo), las cifras del panel salen
 * mezcladas y no dicen nada útil —un grupo que va por la 200 y otro que acaba
 * de empezar dan una media que no le corresponde a ninguno de los dos—. Aquí
 * cada grupo se mira por separado.
 */

const SIN_GRUPO = "Sin grupo";

export function ResumenPorGrupo({ users }: { users: AppUser[] }) {
  const grupos = useMemo(() => {
    // La cuenta de la fundación no es participante: no cuenta en las cifras.
    const gente = users.filter(
      (u) => u.enrolled !== false && !isPermanentAdmin(u.email),
    );

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
      }))
      // Primero los grupos con nombre, y entre ellos por orden alfabético;
      // "Sin grupo" al final, que es el cajón de lo pendiente de ordenar.
      .sort((a, b) => {
        if (a.nombre === SIN_GRUPO) return 1;
        if (b.nombre === SIN_GRUPO) return -1;
        return a.nombre.localeCompare(b.nombre, "es");
      });
  }, [users]);

  // Con un solo grupo no aporta nada: las cifras de arriba ya son ésas.
  const hayVarios = grupos.length > 1;
  if (!hayVarios) return null;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-border p-4">
        <h3 className="font-display text-lg font-semibold">Cómo va cada grupo 👥</h3>
        <p className="text-xs text-muted">
          Las cifras de arriba son de todo el mundo junto. Aquí, separadas por grupo.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="p-4 font-semibold">Grupo</th>
              <th className="p-4 font-semibold">Personas</th>
              <th className="p-4 font-semibold">Lección promedio</th>
              <th className="p-4 font-semibold">Más avanzada</th>
              <th className="p-4 font-semibold">Avance</th>
              <th className="p-4 font-semibold">Hicieron hoy</th>
              <th className="p-4 font-semibold">Sin entrar 7 días</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(({ nombre, miembros, stats }) => (
              <tr key={nombre} className="border-b border-border/60 last:border-0">
                <td className="p-4">
                  <span
                    className={
                      nombre === SIN_GRUPO
                        ? "badge bg-muted/15 text-muted"
                        : "badge bg-aqua/15 text-aqua"
                    }
                  >
                    {nombre}
                  </span>
                </td>
                <td className="p-4 font-semibold tabular-nums">{miembros.length}</td>
                <td className="p-4 tabular-nums">{stats.averageCurrentLesson}</td>
                <td className="p-4 tabular-nums text-muted">{stats.maxLesson}</td>
                <td className="p-4">
                  <span className="font-semibold tabular-nums">{stats.completionRate}%</span>
                  <span className="ml-1 text-xs text-muted">de {SITE.totalLessons}</span>
                </td>
                <td className="p-4 tabular-nums">
                  <span className={stats.activeToday > 0 ? "text-success" : "text-muted"}>
                    {stats.activeToday}
                  </span>
                </td>
                <td className="p-4 tabular-nums">
                  <span className={stats.inactive7d > 0 ? "text-warning" : "text-muted"}>
                    {stats.inactive7d}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
