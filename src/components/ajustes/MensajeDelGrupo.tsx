"use client";

import { useState } from "react";
import { Seccion } from "./Seccion";
import { useAuth } from "@/components/providers/AuthProvider";
import { getClientAuth } from "@/lib/firebase";
import {
  COMODINES,
  PLANTILLA_POR_DEFECTO,
  armarMensaje,
  llevaLaLeccion,
  useMensajeGrupo,
} from "@/lib/mensaje-grupo";

/**
 * EL MENSAJE QUE SE LE CUENTA AL GRUPO.
 *
 * Aquí se decide qué se propone cada vez que alguien marca una lección. Corto
 * por defecto —"Lección 115 hecha ✨"— porque esto se manda TODOS LOS DÍAS al
 * mismo grupo, y un texto largo repetido deja de leerse.
 *
 * La única regla que no se puede saltar: el mensaje tiene que decir QUÉ lección
 * fue. Sin el número, al grupo le llega un "hecha" suelto que no significa
 * nada. Por eso `{leccion}` es obligatorio y no deja guardar sin él.
 *
 * Lo de Lumi es para quien no sabe qué poner. Escribir una frase bonita en
 * blanco cuesta; elegir entre tres que ya están escritas, no.
 */
export function MensajeDelGrupo() {
  const { appUser, isAdmin } = useAuth();
  const { plantilla, guardar } = useMensajeGrupo();
  const [borrador, setBorrador] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string[] | null>(null);
  const [pensando, setPensando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "mal"; texto: string } | null>(null);

  // Mientras no se toque nada, se enseña lo guardado.
  const texto = borrador ?? plantilla;
  const leccionDeMuestra = appUser?.currentLesson || 1;
  const vistaPrevia = armarMensaje(texto, {
    numero: leccionDeMuestra,
    titulo: "",
  });

  const faltaLaLeccion = !llevaLaLeccion(texto);
  const cambiado = borrador !== null && borrador !== plantilla;

  // Lumi es de quien sostiene el proceso; el servidor ya lo exige igual.
  const puedeUsarLumi = isAdmin || appUser?.plan !== "ordinario";

  function insertar(comodin: string) {
    setBorrador(`${texto}${texto.endsWith(" ") || !texto ? "" : " "}${comodin}`);
    setAviso(null);
  }

  function aplicar(nuevo: string) {
    setBorrador(null);
    guardar(nuevo);
    setAviso({ tono: "ok", texto: "Guardado." });
  }

  /**
   * Le pide a Lumi tres frases cortas.
   *
   * La respuesta llega poco a poco (el mismo canal que usa el chat), así que se
   * junta entera y luego se parte en líneas. Solo se quedan las que traen el
   * número de la lección: sin él la frase no sirve, por bonita que sea.
   */
  async function pedirleALumi() {
    setPensando(true);
    setAviso(null);
    setIdeas(null);
    try {
      const usuario = getClientAuth().currentUser;
      const idToken = usuario ? await usuario.getIdToken() : null;
      if (!idToken) {
        setAviso({ tono: "mal", texto: "Tu sesión expiró. Vuelve a entrar." });
        return;
      }

      const peticion =
        "Dame TRES mensajes muy cortos para avisarle a mi grupo de WhatsApp que " +
        "terminé la lección del día. Reglas estrictas: cada uno en su propia línea, " +
        "sin numerar y sin comillas; máximo 8 palabras; cada uno DEBE contener " +
        "{leccion} tal cual (con llaves) donde va el número, y terminar con un emoji. " +
        "Tono sereno, cotidiano, nada solemne. Responde SOLO las tres líneas.";

      const res = await fetch("/api/sensei", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: peticion }], idToken }),
      });

      if (!res.ok || !res.body) {
        setAviso({
          tono: "mal",
          texto:
            res.status === 403
              ? "Lumi es de los Portadores de Luz."
              : res.status === 429
                ? "Muchas peticiones seguidas. Espera un momentito."
                : "Lumi no pudo responder ahora. Inténtalo en un rato.",
        });
        return;
      }

      const lector = res.body.getReader();
      const decodificador = new TextDecoder();
      let todo = "";
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        todo += decodificador.decode(value, { stream: true });
      }

      const lineas = todo
        .split("\n")
        .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").replace(/^["«]|["»]$/g, "").trim())
        .filter((l) => l.length > 0 && l.length <= 70 && llevaLaLeccion(l))
        .slice(0, 3);

      if (lineas.length === 0) {
        setAviso({ tono: "mal", texto: "Lumi no dio nada usable esta vez. Prueba otra vez." });
        return;
      }
      setIdeas(lineas);
    } catch {
      setAviso({ tono: "mal", texto: "No se pudo hablar con Lumi." });
    } finally {
      setPensando(false);
    }
  }

  return (
    <Seccion
      icono="💬"
      titulo="Mensaje para el grupo"
      descripcion="Lo que se propone al marcar una lección como hecha. Se guarda en este aparato."
    >
      <label htmlFor="plantilla-grupo" className="sr-only">
        Mensaje para el grupo
      </label>
      <textarea
        id="plantilla-grupo"
        value={texto}
        onChange={(e) => {
          setBorrador(e.target.value);
          setAviso(null);
        }}
        rows={2}
        maxLength={400}
        className="w-full resize-y rounded-xl border border-border bg-bg/60 p-3 text-sm leading-relaxed text-fg outline-none transition focus:border-aqua/60"
      />

      {/* Ver el resultado vale más que explicar los comodines. */}
      <div className="mt-3 rounded-xl border border-border bg-bg/40 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Así se verá hoy (lección {leccionDeMuestra})
        </p>
        <p className="mt-1.5 whitespace-pre-line text-sm text-fg">
          {vistaPrevia || <span className="text-muted">(vacío)</span>}
        </p>
      </div>

      {faltaLaLeccion && (
        <p className="mt-2 text-sm text-warning">
          Falta <code className="rounded bg-surface-2 px-1">{"{leccion}"}</code>: el grupo tiene
          que saber de qué lección hablas.
        </p>
      )}

      <div className="mt-3">
        <p className="text-xs text-muted">Toca para añadir:</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {COMODINES.map((c) => (
            <button
              key={c.clave}
              onClick={() => insertar(c.clave)}
              title={c.que}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              {c.clave}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => aplicar(texto.trim())}
          disabled={!cambiado || faltaLaLeccion}
          className="btn-primary"
        >
          Guardar
        </button>
        <button
          onClick={() => {
            setBorrador(null);
            guardar(PLANTILLA_POR_DEFECTO);
            setIdeas(null);
            setAviso({ tono: "ok", texto: "Volvió al de siempre." });
          }}
          className="btn-ghost"
        >
          El de siempre
        </button>
        {puedeUsarLumi && (
          <button onClick={() => void pedirleALumi()} disabled={pensando} className="btn-ghost">
            {pensando ? "Lumi está pensando…" : "✨ Que Lumi proponga"}
          </button>
        )}
      </div>

      {aviso && (
        <p className={`mt-2 text-sm ${aviso.tono === "ok" ? "text-success" : "text-warning"}`}>
          {aviso.texto}
        </p>
      )}

      {ideas && (
        <div className="mt-3 animate-fade-in rounded-xl border border-aqua/30 bg-aqua/5 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-aqua">
            Lumi propone · toca la que te guste
          </p>
          <div className="mt-2 space-y-1.5">
            {ideas.map((i) => (
              <button
                key={i}
                onClick={() => {
                  setBorrador(i);
                  setIdeas(null);
                  setAviso(null);
                }}
                className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm transition hover:bg-surface-2"
              >
                {armarMensaje(i, { numero: leccionDeMuestra, titulo: "" })}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Al tocar una queda escrita arriba; todavía hay que darle a Guardar.
          </p>
        </div>
      )}
    </Seccion>
  );
}
