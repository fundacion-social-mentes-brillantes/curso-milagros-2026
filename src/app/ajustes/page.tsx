"use client";

import { useEffect } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { Notificaciones } from "@/components/ajustes/Notificaciones";
import { AppAndroid } from "@/components/ajustes/AppAndroid";
import { MiLeccion } from "@/components/ajustes/MiLeccion";
import { MensajeDelGrupo } from "@/components/ajustes/MensajeDelGrupo";
import { Apariencia } from "@/components/ajustes/Apariencia";
import { MisDatos } from "@/components/ajustes/MisDatos";
import { Cuenta } from "@/components/ajustes/Cuenta";
import { useAjustes } from "@/lib/ajustes";

/**
 * AJUSTES.
 *
 * El orden no es casual: primero las notificaciones, porque "¿las tengo
 * activadas o no?" es la duda que trajo a la gente hasta aquí. Después lo
 * bonito, después los datos, y de último la cuenta con el botón de salir bien
 * lejos del resto para que nadie lo toque sin querer.
 */
function AjustesInner() {
  const { ajustes, cambiar } = useAjustes();

  /*
   * Llegar directo a un bloque: «Personaliza tu mensaje de siempre», al marcar
   * una lección, trae aquí con #mensaje-para-el-grupo. El navegador no baja solo
   * porque esta pantalla se dibuja después de entrar la sesión, y los bloques de
   * arriba (notificaciones) crecen al cargar; por eso se baja aquí, dos veces, y
   * se ilumina el bloque un momento para que se vea dónde está.
   */
  useEffect(() => {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!id) return;
    const ir = () => {
      const el = document.getElementById(id);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: "smooth" });
    };
    const a = window.setTimeout(ir, 50);
    const b = window.setTimeout(ir, 700);
    const destino = document.getElementById(id);
    destino?.classList.add("resaltada");
    const c = window.setTimeout(() => destino?.classList.remove("resaltada"), 3200);
    return () => [a, b, c].forEach((t) => window.clearTimeout(t));
  }, []);

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="mb-6">
        <p className="etiqueta">Tu espacio</p>
        <h1 className="titular mt-2 text-[2.8rem] sm:text-[3.6rem]">
          Tus <em>ajustes</em>
        </h1>
        <p className="mt-1.5 text-muted">
          Tus recordatorios, en qué lección vas y cómo se te ve la app.
        </p>
      </header>

      <div className="mx-auto grid max-w-3xl gap-5">
        <Notificaciones />
        <AppAndroid />
        <MiLeccion />
        <MensajeDelGrupo />
        <Apariencia ajustes={ajustes} cambiar={cambiar} />
        <MisDatos />
        <Cuenta />
      </div>
    </div>
  );
}

export default function AjustesPage() {
  return (
    <RouteGuard>
      <AjustesInner />
    </RouteGuard>
  );
}
