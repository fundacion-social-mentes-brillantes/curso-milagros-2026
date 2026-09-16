"use client";

import { useState } from "react";
import { Seccion } from "./Seccion";
import { useAuth } from "@/components/providers/AuthProvider";
import { cambiarLeccionActual } from "@/lib/users";
import { MAX_LECCIONES_DIA, SITE } from "@/config/site";

/**
 * EN QUÉ LECCIÓN VOY, Y CÓMO CORREGIRLO.
 *
 * Hace falta porque el número se fija al registrarse y hasta ahora no había
 * forma de tocarlo. Quien entra tarde —o quien ya venía haciendo el Curso por
 * su cuenta antes de llegar aquí— quedaba atrapado en la lección 1 y tenía que
 * pedirle a un admin que se lo moviera.
 *
 * Las dos direcciones NO hacen lo mismo, y conviene que se vea antes de tocar
 * nada:
 *
 *   Adelantar   → las anteriores quedan como hechas (es lo que significa "voy
 *                 en la 112": que las 111 ya pasaron).
 *   Retroceder  → solo mueve el número. Lo que ya marcaste sigue marcado.
 *
 * Que retroceder no borre nada es deliberado: un número mal tecleado no debería
 * poder llevarse por delante meses de trabajo. Que sobre información es
 * recuperable; que falte, no.
 */
export function MiLeccion() {
  const { appUser, refrescarPerfil } = useAuth();
  const [valor, setValor] = useState(String(appUser?.currentLesson || 1));
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "mal"; texto: string } | null>(null);

  if (!appUser) return null;

  const actual = appUser.currentLesson || 1;
  const destino = Math.min(Math.max(Math.trunc(Number(valor) || 0), 1), SITE.totalLessons);
  const valido = String(destino) === valor.trim() && destino >= 1;
  const cambia = valido && destino !== actual;

  const restanHoy = Math.max(0, MAX_LECCIONES_DIA - (appUser.hechasHoy ?? 0));

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    try {
      await cambiarLeccionActual(destino);
      await refrescarPerfil();
      setAviso({ tono: "ok", texto: `Listo, ahora vas en la lección ${destino}.` });
    } catch {
      setAviso({ tono: "mal", texto: "No se pudo guardar. Inténtalo otra vez." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Seccion
      icono="📍"
      titulo="Mi lección"
      descripcion="Ajústala si empezaste tarde o ya venías haciendo el Curso por tu cuenta."
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-semibold">Voy en la lección</span>
          <input
            type="number"
            min={1}
            max={SITE.totalLessons}
            inputMode="numeric"
            className="input mt-1.5 w-28 tabular-nums"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              setAviso(null);
            }}
          />
        </label>
        <button
          onClick={() => void guardar()}
          disabled={!cambia || guardando}
          className="btn-primary"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {/* Qué va a pasar exactamente, ANTES de tocar el botón. */}
      {cambia && (
        <p className="mt-2.5 text-sm text-muted">
          {destino > actual ? (
            <>
              Las <strong className="text-fg">{destino - 1}</strong> lecciones anteriores quedarán
              como hechas. No suman puesto en el ranking: ese se gana haciéndolas el día que salen.
            </>
          ) : (
            <>
              Solo se mueve el número. Las lecciones que ya marcaste{" "}
              <strong className="text-fg">siguen marcadas</strong>; si quieres, las desmarcas una a
              una desde cada lección.
            </>
          )}
        </p>
      )}

      {aviso && (
        <p className={`mt-2.5 text-sm ${aviso.tono === "ok" ? "text-success" : "text-warning"}`}>
          {aviso.texto}
        </p>
      )}

      <p className="mt-4 border-t border-border pt-3 text-sm text-muted">
        Hoy llevas{" "}
        <strong className="text-fg tabular-nums">
          {appUser.hechasHoy ?? 0} de {MAX_LECCIONES_DIA}
        </strong>
        .{" "}
        {restanHoy === 0
          ? "Mañana puedes seguir."
          : `Puedes hacer ${restanHoy} más si vas atrasado.`}
      </p>
    </Seccion>
  );
}
