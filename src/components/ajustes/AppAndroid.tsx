"use client";

import { useEffect, useState } from "react";
import { Seccion } from "./Seccion";
import { llamar } from "@/lib/api";
import { enAppAndroid, enlaceAjustesNativos } from "@/lib/app-android";

/**
 * APP DE ANDROID: el recordatorio diario a la hora exacta y el widget
 * «Lección de hoy». Solo aparece dentro de la app (en el navegador no sirve).
 *
 * Esas dos piezas son nativas y corren aunque nadie abra la app, así que
 * necesitan saber en qué lección va la persona sin su sesión de Google. Este
 * botón las vincula: pide al servidor un código de un solo uso y abre la
 * pantalla de la app con él (ver api/src/functions/appandroid.js).
 *
 * El código se pide ANTES del toque, al abrir Ajustes: Chrome solo abre la app
 * si el enlace sale directo de un toque, y esperar al servidor en ese momento
 * podría hacer que lo ignore. Vence a los 15 minutos; se renueva a los 10.
 */
export function AppAndroid() {
  const [visible, setVisible] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (!enAppAndroid()) return;
    setVisible(true);
    let vivo = true;
    const pedir = () =>
      llamar<{ codigo: string }>("/app/codigo", { metodo: "POST" })
        .then((r) => {
          if (vivo) {
            setCodigo(r.codigo);
            setFallo(false);
          }
        })
        .catch(() => {
          if (vivo) setFallo(true);
        });
    void pedir();
    const cada = window.setInterval(() => void pedir(), 10 * 60 * 1000);
    return () => {
      vivo = false;
      window.clearInterval(cada);
    };
  }, []);

  if (!visible) return null;

  return (
    <Seccion
      icono="📱"
      titulo="Recordatorio y widget"
      descripcion="Solo en esta app: un aviso cada día a la hora que elijas y la lección de hoy en la pantalla de inicio."
    >
      <ul className="grid gap-1.5 text-sm text-muted">
        <li>⏰ El recordatorio llega siempre a tu hora, aunque no abras la app.</li>
        <li>📖 El widget muestra tu lección de hoy y cambia solo a medianoche.</li>
        <li>👆 Al tocar cualquiera de los dos, se abre tu lección.</li>
      </ul>
      <div className="mt-4">
        {codigo ? (
          <a href={enlaceAjustesNativos(codigo)} className="btn-primary inline-flex">
            Elegir la hora y poner el widget
          </a>
        ) : (
          <button disabled className="btn-primary opacity-60">
            {fallo ? "No se pudo preparar. Revisa tu conexión." : "Preparando…"}
          </button>
        )}
      </div>
    </Seccion>
  );
}
