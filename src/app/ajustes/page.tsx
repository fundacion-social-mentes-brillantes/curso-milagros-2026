"use client";

import { RouteGuard } from "@/components/common/RouteGuard";
import { Notificaciones } from "@/components/ajustes/Notificaciones";
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

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="mb-6">
        <p className="section-eyebrow">Tu espacio</p>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Ajustes</h1>
        <p className="mt-1.5 text-muted">
          Tus recordatorios, en qué lección vas y cómo se te ve la app.
        </p>
      </header>

      <div className="mx-auto grid max-w-3xl gap-5">
        <Notificaciones />
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
