"use client";

import { useEffect, useMemo, useState } from "react";
import { guardarFechaDeGrupo, listarGrupos, type Grupo } from "@/lib/grupos";
import { SIN_GRUPO } from "@/config/site";
import type { AppUser } from "@/types";

/**
 * CUÁNDO EMPEZÓ CADA GRUPO.
 *
 * De esta fecha sale todo lo demás: si un grupo hizo la lección 1 el 22 de
 * junio, hoy le toca la que diga el calendario y mañana la siguiente. Ese
 * número es el techo hasta el que puede adelantarse alguien de ese grupo.
 *
 * Por qué la fecha y no "por dónde va la mayoría": porque con la fecha el
 * número es el mismo para todos y se puede saber de antemano. Mirando a la
 * gente, el techo subiría y bajaría según quién marcara ese día, y nadie
 * podría decir hasta dónde puede llegar.
 *
 * Un grupo sin fecha no bloquea nada: simplemente, nadie de ese grupo puede
 * ajustarse la lección hasta que se la pongas. Por eso se avisa en rojo.
 */
export function FechasDeGrupos({ users }: { users: AppUser[] }) {
  const [guardados, setGuardados] = useState<Grupo[] | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function recargar() {
    setGuardados(await listarGrupos());
  }

  useEffect(() => {
    void recargar();
  }, []);

  /**
   * Los grupos que existen de verdad (los que alguien tiene puestos) más
   * "General", que es donde caen quienes todavía no tienen grupo. Se muestran
   * aunque no tengan fecha: justamente esos son los que hay que atender.
   */
  const filas = useMemo(() => {
    const nombres = new Set<string>();
    let hayGenteSinGrupo = false;
    for (const u of users) {
      const g = (u.grupo || "").trim();
      if (g) nombres.add(g);
      else hayGenteSinGrupo = true;
    }
    if (hayGenteSinGrupo) nombres.add(SIN_GRUPO);
    // Y los que ya tienen fecha, aunque ahora mismo no quede nadie en ellos.
    for (const g of guardados ?? []) nombres.add(g.nombre);

    return [...nombres]
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((nombre) => {
        const guardado = (guardados ?? []).find((g) => g.nombre === nombre);
        const personas = users.filter(
          (u) => ((u.grupo || "").trim() || SIN_GRUPO) === nombre,
        ).length;
        return { nombre, personas, inicio: guardado?.inicio ?? null, leccionHoy: guardado?.leccionHoy ?? null };
      });
  }, [users, guardados]);

  async function guardar(nombre: string) {
    setGuardando(true);
    setError(null);
    try {
      await guardarFechaDeGrupo(nombre, valor);
      await recargar();
      setEditando(null);
    } catch {
      setError("No se pudo guardar. Revisa la fecha e inténtalo otra vez.");
    } finally {
      setGuardando(false);
    }
  }

  if (filas.length === 0) return null;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-border p-4">
        <h3 className="font-display text-lg font-semibold">Cuándo empezó cada grupo 📅</h3>
        <p className="text-xs text-muted">
          El día en que ese grupo hizo la lección 1. De ahí sale en qué lección va hoy, y hasta
          dónde puede adelantarse su gente.
        </p>
      </div>

      {error && <p className="border-b border-border px-4 py-2 text-sm text-warning">{error}</p>}

      <ul className="divide-y divide-border">
        {filas.map((f) => (
          <li key={f.nombre} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{f.nombre}</span>
              <span className="text-xs text-muted">
                {f.personas} {f.personas === 1 ? "persona" : "personas"}
              </span>
            </span>

            {editando === f.nombre ? (
              <span className="flex items-center gap-2">
                <input
                  type="date"
                  className="input w-auto py-1.5 text-sm"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
                <button
                  onClick={() => void guardar(f.nombre)}
                  disabled={guardando || !valor}
                  className="btn-primary px-3 py-1.5 text-xs"
                >
                  {guardando ? "…" : "Guardar"}
                </button>
                <button
                  onClick={() => setEditando(null)}
                  className="text-xs text-muted underline"
                >
                  Cancelar
                </button>
              </span>
            ) : (
              <>
                <span className="text-sm">
                  {f.inicio ? (
                    <>
                      <span className="text-muted">Empezó el </span>
                      <strong>{f.inicio}</strong>
                      <span className="text-muted"> · hoy va en la </span>
                      <strong className="text-primary tabular-nums">{f.leccionHoy}</strong>
                    </>
                  ) : (
                    <span className="text-warning">Sin fecha: nadie de este grupo puede ajustar su lección.</span>
                  )}
                </span>
                <button
                  onClick={() => {
                    setValor(f.inicio ?? "");
                    setEditando(f.nombre);
                    setError(null);
                  }}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  {f.inicio ? "Cambiar" : "Poner fecha"}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
