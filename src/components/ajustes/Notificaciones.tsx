"use client";

import { useCallback, useEffect, useState } from "react";
import { Seccion } from "./Seccion";
import { llamar, type ErrorApi } from "@/lib/api";
import {
  activar,
  apagar,
  consultarEstado,
  encender,
  type EstadoNotificaciones,
} from "@/lib/notificaciones";

/**
 * "¿TENGO LAS NOTIFICACIONES ACTIVADAS O NO?"
 *
 * Esa es la pregunta, y la respuesta tiene que caber de un vistazo: un punto de
 * color, una frase y el botón que toque. Nada más.
 *
 * Lo que puede salir mal —extensiones, permisos denegados, iPhone sin
 * instalar— se explica igual de bien, pero PLEGADO. Está ahí para quien lo
 * necesita, sin convertir la pantalla en un manual para quien no.
 *
 * Por dentro sí se miran varias cosas, porque el permiso del navegador y la
 * suscripción de OneSignal fallan por separado: se puede tener el permiso dado
 * y no recibir nada. Mirar solo el permiso es lo que deja a alguien esperando
 * un aviso que nunca sale.
 */

const LETREROS: Record<
  EstadoNotificaciones["clase"],
  { punto: string; texto: string; titulo: string; frase: string }
> = {
  activo: {
    punto: "bg-success",
    texto: "text-success",
    titulo: "Activadas",
    frase: "En este aparato te van a llegar.",
  },
  "sin-decidir": {
    punto: "bg-warning",
    texto: "text-warning",
    titulo: "Sin activar",
    frase: "En este aparato todavía no las has activado.",
  },
  "permitido-apagado": {
    punto: "bg-warning",
    texto: "text-warning",
    titulo: "Apagadas",
    frase: "Diste permiso, pero están apagadas y no te llega nada.",
  },
  bloqueado: {
    punto: "bg-warning",
    texto: "text-warning",
    titulo: "Bloqueadas",
    frase: "El navegador las bloqueó; hay que cambiarlo en sus ajustes.",
  },
  "iphone-sin-instalar": {
    punto: "bg-muted",
    texto: "text-muted",
    titulo: "Falta instalar la app",
    frase: "El iPhone solo las manda si la página está en la pantalla de inicio.",
  },
  "no-se-puede": {
    punto: "bg-muted",
    texto: "text-muted",
    titulo: "No disponibles",
    frase: "Este navegador no admite notificaciones.",
  },
  desconocido: {
    punto: "bg-muted",
    texto: "text-muted",
    titulo: "No se pudo comprobar",
    frase: "Casi siempre es una extensión del navegador que bloquea el script.",
  },
};

/** Los pasos que se despliegan, según lo que esté pasando. */
function ayuda(clase: EstadoNotificaciones["clase"]): string[] | null {
  if (clase === "bloqueado") {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    if (/Android/i.test(ua)) {
      return [
        "Toca el candado 🔒 junto a la dirección, arriba.",
        'Entra en "Permisos" y luego "Notificaciones".',
        'Cámbialo a "Permitir" y vuelve aquí.',
      ];
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return [
        "Abre los Ajustes del teléfono.",
        "Busca esta app en la lista y entra.",
        'Activa "Permitir notificaciones".',
      ];
    }
    return [
      "Haz clic en el candado 🔒 a la izquierda de la dirección.",
      'Busca "Notificaciones".',
      'Cámbialo a "Permitir" y recarga.',
    ];
  }
  if (clase === "iphone-sin-instalar") {
    return [
      "En Safari, toca el botón de compartir (el cuadrito con la flecha).",
      'Baja y elige "Añadir a pantalla de inicio".',
      "Abre la app desde el ícono nuevo y vuelve aquí.",
    ];
  }
  if (clase === "desconocido") {
    return [
      "Desactiva el bloqueador de anuncios solo para esta página y recarga.",
      "Para salir de dudas, ábrela en incógnito: ahí las extensiones no corren.",
      "Si tampoco, puede ser la conexión. Vuelve a comprobar en un momento.",
    ];
  }
  return null;
}

type Aviso = { tono: "ok" | "mal"; texto: string } | null;

export function Notificaciones() {
  const [estado, setEstado] = useState<EstadoNotificaciones | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [probando, setProbando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [verAyuda, setVerAyuda] = useState(false);

  const refrescar = useCallback(async () => {
    setEstado(await consultarEstado());
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  // Si vuelve de los ajustes del navegador tras desbloquearlas, que la pantalla
  // se entere sola en vez de dejarle un letrero viejo y equivocado.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === "visible") void refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [refrescar]);

  async function conEspera(tarea: () => Promise<void>) {
    setOcupado(true);
    setAviso(null);
    try {
      await tarea();
      // OneSignal registra el aparato un instante DESPUÉS de que la persona
      // acepta. Mirando una sola vez, lo normal sería ver "apagadas" justo
      // después de activarlas: lo contrario de lo que acaba de pasar.
      let nuevo = await consultarEstado();
      for (let i = 0; i < 3 && nuevo.clase === "permitido-apagado"; i++) {
        await new Promise((r) => setTimeout(r, 1200));
        nuevo = await consultarEstado();
      }
      setEstado(nuevo);
    } finally {
      setOcupado(false);
    }
  }

  async function probar() {
    setProbando(true);
    setAviso(null);
    try {
      const r = await llamar<{ ok: boolean; motivo?: string }>("/probar-notificacion", {
        metodo: "POST",
      });
      if (r.ok) {
        setAviso({ tono: "ok", texto: "Enviada. Te llega en unos segundos." });
      } else if (r.motivo === "sin-aparatos") {
        setAviso({
          tono: "mal",
          texto: "No hay ningún aparato registrado a tu nombre. Apaga y vuelve a encender aquí.",
        });
      } else {
        setAviso({ tono: "mal", texto: "No se pudo enviar." });
      }
    } catch (err) {
      const e = err as ErrorApi;
      const textos: Record<string, string> = {
        "muy-seguido": "Espera unos segundos entre una prueba y otra.",
        "sin-onesignal": "Falta configurar el servicio en el servidor.",
        "sin-conexion": "No se pudo hablar con el servicio.",
        "onesignal-rechazo": "El servicio rechazó el envío.",
      };
      setAviso({ tono: "mal", texto: textos[e?.clave ?? ""] ?? "No se pudo enviar la prueba." });
    } finally {
      setProbando(false);
    }
  }

  if (!estado) {
    return (
      <Seccion icono="🔔" titulo="Notificaciones">
        <p className="text-sm text-muted">Comprobando…</p>
      </Seccion>
    );
  }

  const l = LETREROS[estado.clase];
  const pasos = ayuda(estado.clase);

  return (
    <Seccion icono="🔔" titulo="Notificaciones" descripcion="Se configuran por aparato.">
      {/* Estado y acción en una sola línea: es lo único que casi todos miran. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${l.punto}`} aria-hidden />
        <span className={`text-sm font-bold ${l.texto}`}>{l.titulo}</span>
        <span className="min-w-0 flex-1 text-sm text-muted">{l.frase}</span>

        <span className="flex shrink-0 gap-2">
          {estado.clase === "sin-decidir" && (
            <button
              onClick={() => void conEspera(activar)}
              disabled={ocupado}
              className="btn-primary"
            >
              {ocupado ? "…" : "Activar"}
            </button>
          )}
          {estado.clase === "permitido-apagado" && (
            <button
              onClick={() => void conEspera(encender)}
              disabled={ocupado}
              className="btn-primary"
            >
              {ocupado ? "…" : "Encender"}
            </button>
          )}
          {estado.clase === "desconocido" && (
            <button
              onClick={() => void conEspera(async () => {})}
              disabled={ocupado}
              className="btn-ghost"
            >
              {ocupado ? "…" : "Comprobar"}
            </button>
          )}
          {estado.clase === "activo" && (
            <>
              <button onClick={() => void probar()} disabled={probando} className="btn-ghost">
                {probando ? "Enviando…" : "Probar"}
              </button>
              <button
                onClick={() => void conEspera(apagar)}
                disabled={ocupado}
                className="btn-ghost"
              >
                {ocupado ? "…" : "Apagar"}
              </button>
            </>
          )}
        </span>
      </div>

      {aviso && (
        <p className={`mt-3 text-sm ${aviso.tono === "ok" ? "text-success" : "text-warning"}`}>
          {aviso.texto}
        </p>
      )}

      {/* Los pasos, plegados. Quien está bien no tiene por qué leerlos. */}
      {pasos && (
        <div className="mt-3">
          <button
            onClick={() => setVerAyuda((v) => !v)}
            className="text-xs font-semibold text-aqua underline-offset-2 hover:underline"
          >
            {verAyuda ? "Ocultar" : "Qué puedo hacer"}
          </button>
          {verAyuda && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted">
              {pasos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Seccion>
  );
}
