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
 * Esa pregunta, que suena trivial, es la razón de ser de esta pantalla. Antes
 * no había forma de saberlo: o te llegaban o no te llegaban, y si no te
 * llegaban no sabías por cuál de las cinco razones posibles.
 *
 * Aquí se responde con lo que de verdad pasa, sin suavizarlo. Si están
 * bloqueadas, se dice que desde la página NO se pueden arreglar y se explica
 * dónde tocar. Si no se pudo comprobar, se dice eso mismo en vez de pintar un
 * visto bueno tranquilizador.
 */

/** Cada estado con su color, su explicación y qué se puede hacer. */
const LETREROS: Record<
  EstadoNotificaciones["clase"],
  { punto: string; texto: string; titulo: string; detalle: string }
> = {
  activo: {
    punto: "bg-success",
    texto: "text-success",
    titulo: "Activadas en este aparato",
    detalle:
      "Vas a recibir el aviso de las 3 de la mañana con la idea de tu lección, y tres recordatorios más durante el día.",
  },
  "sin-decidir": {
    punto: "bg-warning",
    texto: "text-warning",
    titulo: "Todavía no las has activado",
    detalle:
      "Nunca se te ha preguntado en este aparato, o cerraste el aviso sin responder. Se puede activar ahora.",
  },
  "permitido-apagado": {
    punto: "bg-warning",
    texto: "text-warning",
    titulo: "Permitidas, pero apagadas",
    detalle:
      "Diste permiso pero la suscripción está apagada, así que no te llega nada. Se enciende con un toque.",
  },
  bloqueado: {
    punto: "bg-warning",
    texto: "text-warning",
    titulo: "Bloqueadas por el navegador",
    detalle:
      "En algún momento se le dijo que no. El navegador no vuelve a preguntar, así que esto no se puede arreglar desde aquí: hay que cambiarlo en sus ajustes.",
  },
  "iphone-sin-instalar": {
    punto: "bg-muted",
    texto: "text-muted",
    titulo: "Falta instalar la página en el iPhone",
    detalle:
      "Los iPhone solo mandan notificaciones si la página está añadida a la pantalla de inicio. Es un momento y se explica abajo.",
  },
  "no-se-puede": {
    punto: "bg-muted",
    texto: "text-muted",
    titulo: "Este navegador no admite notificaciones",
    detalle:
      "Nada que puedas hacer aquí. Desde otro navegador (Chrome, por ejemplo) sí funcionan, y son independientes: puedes activarlas allá.",
  },
  desconocido: {
    punto: "bg-muted",
    texto: "text-muted",
    titulo: "No se pudo comprobar",
    detalle:
      "No hubo respuesta del servicio de notificaciones, así que no se puede saber si están activadas. Casi siempre es una extensión del navegador que bloquea el script.",
  },
};

/** Dónde toca ir a desbloquearlas, según el aparato. */
function comoDesbloquear(): { donde: string; pasos: string[] } {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Android/i.test(ua)) {
    return {
      donde: "En el celular Android",
      pasos: [
        "Toca el candado 🔒 que está junto a la dirección, arriba.",
        'Entra en "Permisos" y busca "Notificaciones".',
        'Cámbialo a "Permitir" y vuelve a esta página.',
      ],
    };
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return {
      donde: "En el iPhone",
      pasos: [
        "Abre los Ajustes del teléfono.",
        "Busca esta app en la lista y entra.",
        'Activa "Permitir notificaciones".',
      ],
    };
  }
  return {
    donde: "En el computador",
    pasos: [
      "Haz clic en el candado 🔒 que está a la izquierda de la dirección.",
      'Busca "Notificaciones" en la lista.',
      'Cámbialo a "Permitir" y recarga la página.',
    ],
  };
}

type Aviso = { tono: "ok" | "mal"; texto: string } | null;

export function Notificaciones() {
  const [estado, setEstado] = useState<EstadoNotificaciones | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [probando, setProbando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

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
      // acepta. Si se mirara solo una vez, lo normal sería ver "permitidas
      // pero apagadas" justo después de activarlas, que es lo contrario de lo
      // que acaba de pasar. Por eso se mira un par de veces más.
      let estadoNuevo = await consultarEstado();
      for (let intento = 0; intento < 3 && estadoNuevo.clase === "permitido-apagado"; intento++) {
        await new Promise((r) => setTimeout(r, 1200));
        estadoNuevo = await consultarEstado();
      }
      setEstado(estadoNuevo);
    } finally {
      setOcupado(false);
    }
  }

  async function probar() {
    setProbando(true);
    setAviso(null);
    try {
      const r = await llamar<{ ok: boolean; motivo?: string; destinatarios?: number }>(
        "/probar-notificacion",
        { metodo: "POST" },
      );
      if (r.ok) {
        setAviso({
          tono: "ok",
          texto: "Enviada. Debería aparecerte en unos segundos; si tienes la página abierta, míralo fuera del navegador.",
        });
      } else if (r.motivo === "sin-aparatos") {
        setAviso({
          tono: "mal",
          texto:
            "El servidor la mandó, pero no hay ningún aparato registrado a tu nombre. Apaga y vuelve a encender las notificaciones aquí abajo para registrar este.",
        });
      } else {
        setAviso({ tono: "mal", texto: "No se pudo enviar. Inténtalo de nuevo en un momento." });
      }
    } catch (err) {
      const e = err as ErrorApi;
      const textos: Record<string, string> = {
        "muy-seguido": "Espera unos segundos entre una prueba y otra.",
        "sin-onesignal": "Falta configurar el servicio de notificaciones en el servidor.",
        "sin-conexion": "No se pudo hablar con el servicio de notificaciones.",
        "onesignal-rechazo": "El servicio de notificaciones rechazó el envío.",
      };
      setAviso({
        tono: "mal",
        texto: textos[e?.clave ?? ""] ?? "No se pudo enviar la prueba.",
      });
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
  const desbloquear = comoDesbloquear();

  return (
    <Seccion
      icono="🔔"
      titulo="Notificaciones"
      descripcion="Se configuran por aparato: lo que actives aquí no afecta a tus otros teléfonos ni computadores."
    >
      {/* El estado, sin rodeos */}
      <div className="flex items-start gap-3 rounded-xl bg-surface-2/60 p-3.5">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${l.punto}`} aria-hidden />
        <div className="min-w-0">
          <p className={`text-sm font-bold ${l.texto}`}>{l.titulo}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{l.detalle}</p>
        </div>
      </div>

      {/* Qué se puede hacer desde aquí */}
      <div className="mt-4 flex flex-wrap gap-2">
        {estado.clase === "sin-decidir" && (
          <button onClick={() => void conEspera(activar)} disabled={ocupado} className="btn-primary">
            {ocupado ? "Un momento…" : "Activar notificaciones"}
          </button>
        )}

        {/* Sin respuesta de OneSignal, un botón de "activar" se quedaría
            pensando hasta agotar el plazo sin hacer nada. Lo honesto es
            ofrecer volver a mirar. */}
        {estado.clase === "desconocido" && (
          <button
            onClick={() => void conEspera(async () => {})}
            disabled={ocupado}
            className="btn-ghost"
          >
            {ocupado ? "Comprobando…" : "Volver a comprobar"}
          </button>
        )}

        {estado.clase === "permitido-apagado" && (
          <button onClick={() => void conEspera(encender)} disabled={ocupado} className="btn-primary">
            {ocupado ? "Un momento…" : "Encender"}
          </button>
        )}

        {estado.clase === "activo" && (
          <>
            <button onClick={() => void probar()} disabled={probando} className="btn-primary">
              {probando ? "Enviando…" : "Enviarme una de prueba"}
            </button>
            <button onClick={() => void conEspera(apagar)} disabled={ocupado} className="btn-ghost">
              {ocupado ? "Un momento…" : "Apagar en este aparato"}
            </button>
          </>
        )}
      </div>

      {aviso && (
        <p
          className={`mt-3 rounded-xl p-3 text-sm leading-relaxed ${
            aviso.tono === "ok"
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {/* Bloqueadas: lo único que sirve es explicar dónde tocar */}
      {estado.clase === "bloqueado" && (
        <div className="mt-4 rounded-xl border border-border p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {desbloquear.donde}
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-fg/90">
            {desbloquear.pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Sin respuesta de OneSignal. La causa casi siempre es la misma —una
          extensión que bloquea el script— y tiene arreglo, así que se dice
          cómo en vez de dejar a la persona con un "no se pudo" a secas. */}
      {estado.clase === "desconocido" && (
        <div className="mt-4 rounded-xl border border-border p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Qué suele ser</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-fg/90">
            <li>
              Un bloqueador de anuncios o de rastreadores (uBlock, AdBlock, Brave Shields, el
              antivirus). Desactívalo <strong>solo para esta página</strong> y recarga.
            </li>
            <li>
              Para salir de dudas rápido: abre esta misma página en una ventana de incógnito, donde
              las extensiones no corren. Si ahí sí funciona, era una extensión.
            </li>
            <li>Si no, puede ser la conexión. Vuelve a comprobar en un momento.</li>
          </ol>
          <p className="mt-2.5 text-xs leading-relaxed text-muted">
            Esto no afecta a tu avance ni a nada más de la página: solo impide saber —y
            cambiar— el estado de las notificaciones desde este navegador.
          </p>
        </div>
      )}

      {/* iPhone sin instalar */}
      {estado.clase === "iphone-sin-instalar" && (
        <div className="mt-4 rounded-xl border border-border p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Cómo instalarla en el iPhone
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-fg/90">
            <li>Con esta página abierta en Safari, toca el botón de compartir (el cuadrito con la flecha hacia arriba).</li>
            <li>Baja y elige &quot;Añadir a pantalla de inicio&quot;.</li>
            <li>Abre la app desde el ícono nuevo y vuelve aquí a activarlas.</li>
          </ol>
        </div>
      )}

      {/* Cuándo llegan. Puesto aquí para que nadie crea que fallan cuando
          simplemente todavía no es la hora. */}
      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Cuándo te llegan</p>
        <ul className="mt-2 space-y-1.5 text-sm text-fg/90">
          <li className="flex gap-2">
            <span className="font-semibold tabular-nums text-primary">3:00 a. m.</span>
            <span className="text-muted">la idea de la lección que te toca hoy</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-primary">3 veces más</span>
            <span className="text-muted">
              entre las 8 de la mañana y las 9 de la noche, a horas distintas cada día, siempre con
              la misma idea
            </span>
          </li>
        </ul>
        <p className="mt-2.5 text-xs leading-relaxed text-muted">
          Son siempre de la lección en la que vas. Si hoy no la hiciste, mañana te vuelve a
          esperar la misma: nadie se queda atrás.
        </p>
      </div>
    </Seccion>
  );
}
