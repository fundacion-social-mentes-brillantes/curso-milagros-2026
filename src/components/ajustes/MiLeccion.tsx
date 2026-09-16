"use client";

import { useEffect, useState } from "react";
import { Seccion } from "./Seccion";
import { useAuth } from "@/components/providers/AuthProvider";
import { cambiarLeccionActual } from "@/lib/users";
import { listarGrupos, type Grupo } from "@/lib/grupos";
import { type ErrorApi } from "@/lib/api";
import { MAX_LECCIONES_DIA, SIN_GRUPO, SITE } from "@/config/site";

/**
 * EN QUÉ LECCIÓN VOY.
 *
 * Todo el mundo la ve. Cambiarla es otra cosa:
 *
 *   Admin        → libremente.
 *   Los demás    → solo si un admin les dio permiso, y sin pasar de la lección
 *                  en la que va su grupo hoy.
 *
 * El techo del grupo sale de la fecha en que ese grupo hizo la lección 1: si
 * empezó el 22 de junio, hoy le toca la que diga el calendario y mañana la
 * siguiente. Existe porque adelantarse da por hechas las anteriores; sin techo,
 * cualquiera podría ponerse en la 365 y aparecer como si hubiera terminado, y
 * las cifras del grupo dejarían de significar algo.
 *
 * Lo que se ve aquí es solo el aviso: quien de verdad comprueba las dos reglas
 * es el servidor. Una pantalla se puede saltar.
 */
export function MiLeccion() {
  const { appUser, isAdmin, refrescarPerfil } = useAuth();
  const [valor, setValor] = useState(String(appUser?.currentLesson || 1));
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "mal"; texto: string } | null>(null);

  const puedeCambiar = isAdmin || Boolean(appUser?.puedeAjustarLeccion);

  // El techo solo hace falta si de verdad puede cambiarla; no se pide si no.
  useEffect(() => {
    if (!puedeCambiar || isAdmin) return;
    let vivo = true;
    void listarGrupos().then((g) => vivo && setGrupos(g));
    return () => {
      vivo = false;
    };
  }, [puedeCambiar, isAdmin]);

  // Si el perfil llega después del primer dibujo, ponerse al día con él.
  useEffect(() => {
    if (appUser) setValor(String(appUser.currentLesson || 1));
  }, [appUser?.currentLesson]);

  if (!appUser) return null;

  const actual = appUser.currentLesson || 1;
  const miGrupo = (appUser.grupo || "").trim() || SIN_GRUPO;
  const grupo = grupos?.find((g) => g.nombre === miGrupo) ?? null;
  const techo = isAdmin ? SITE.totalLessons : (grupo?.leccionHoy ?? null);

  const destino = Math.min(Math.max(Math.trunc(Number(valor) || 0), 1), SITE.totalLessons);
  const valido = String(destino) === valor.trim();
  const pasaDelTecho = techo !== null && destino > techo;
  const cambia = valido && destino !== actual && !pasaDelTecho;

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    try {
      await cambiarLeccionActual(destino);
      await refrescarPerfil();
      setAviso({ tono: "ok", texto: `Listo, ahora vas en la lección ${destino}.` });
    } catch (err) {
      const clave = (err as ErrorApi)?.clave;
      const textos: Record<string, string> = {
        "sin-autorizacion":
          "Necesitas que quien acompaña tu grupo te lo autorice antes de cambiarla.",
        "grupo-sin-fecha":
          "Tu grupo todavía no tiene fecha de inicio. Pídesela a quien lo acompaña.",
        "pasa-del-grupo": "No puedes pasar de la lección en la que va tu grupo hoy.",
      };
      setAviso({
        tono: "mal",
        texto: textos[clave ?? ""] ?? "No se pudo guardar. Inténtalo otra vez.",
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Seccion icono="📍" titulo="Mi lección">
      {/* Quien no puede cambiarla ve el número y a quién pedírselo. Enseñarle
          una casilla que no va a funcionar solo sirve para frustrarlo. */}
      {!puedeCambiar ? (
        <>
          <p className="text-sm">
            Vas en la{" "}
            <strong className="font-display text-lg text-fg">lección {actual}</strong>.
          </p>
          <p className="mt-1.5 text-sm text-muted">
            Si empezaste tarde o ya venías haciendo el Curso por tu cuenta y el número no
            corresponde, pídeselo a quien acompaña tu grupo: te lo ajusta o te da permiso para
            hacerlo tú.
          </p>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Ajústala si empezaste tarde o ya venías haciendo el Curso por tu cuenta.
          </p>

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

          {/* El techo, dicho antes de que escriba un número que va a rebotar. */}
          {!isAdmin && (
            <p className="mt-2 text-sm text-muted">
              {grupos === null ? (
                "Comprobando hasta dónde va tu grupo…"
              ) : techo === null ? (
                <>
                  Tu grupo (<strong className="text-fg">{miGrupo}</strong>) todavía no tiene fecha
                  de inicio, así que no se puede saber su límite. Pídesela a quien lo acompaña.
                </>
              ) : (
                <>
                  Tu grupo (<strong className="text-fg">{miGrupo}</strong>) va hoy en la{" "}
                  <strong className="text-fg">lección {techo}</strong>. No puedes pasar de ahí.
                </>
              )}
            </p>
          )}

          {pasaDelTecho && (
            <p className="mt-2 text-sm text-warning">
              La {destino} está más adelante de donde va tu grupo.
            </p>
          )}

          {cambia && (
            <p className="mt-2 text-sm text-muted">
              {destino > actual ? (
                <>
                  Las <strong className="text-fg">{destino - 1}</strong> lecciones anteriores
                  quedarán como hechas. No suman puesto en el ranking: ese se gana haciéndolas el
                  día que salen.
                </>
              ) : (
                <>
                  Solo se mueve el número. Las lecciones que ya marcaste{" "}
                  <strong className="text-fg">siguen marcadas</strong>.
                </>
              )}
            </p>
          )}

          {aviso && (
            <p
              className={`mt-2 text-sm ${aviso.tono === "ok" ? "text-success" : "text-warning"}`}
            >
              {aviso.texto}
            </p>
          )}
        </>
      )}

      <p className="mt-4 border-t border-border pt-3 text-sm text-muted">
        Hoy llevas{" "}
        <strong className="tabular-nums text-fg">
          {appUser.hechasHoy ?? 0} de {MAX_LECCIONES_DIA}
        </strong>
        .{" "}
        {MAX_LECCIONES_DIA - (appUser.hechasHoy ?? 0) <= 0
          ? "Mañana puedes seguir."
          : "Puedes adelantar si vas atrasado."}
      </p>
    </Seccion>
  );
}
