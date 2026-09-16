"use client";

import { useState } from "react";
import { Seccion } from "./Seccion";
import { useAuth } from "@/components/providers/AuthProvider";
import { completeUserProfile } from "@/lib/users";
import { PAISES } from "@/config/site";

/**
 * LOS DATOS DE LA PERSONA.
 *
 * Estos sí van al servidor (no al navegador): son suyos, no del aparato, y
 * tienen que verse igual desde el celular y desde el computador.
 *
 * El correo no está: viene de Google y no se puede cambiar aquí. Tampoco el
 * plan ni el grupo, que los asigna un administrador. Mostrar un campo que no
 * se puede editar es peor que no mostrarlo, así que esos van en "Tu cuenta",
 * solo para consultar.
 */
export function MisDatos() {
  const { appUser, refrescarPerfil } = useAuth();

  const [fullName, setFullName] = useState(appUser?.fullName || appUser?.displayName || "");
  const [country, setCountry] = useState(appUser?.country || "");
  const [phone, setPhone] = useState(appUser?.phone || "");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "mal"; texto: string } | null>(null);

  if (!appUser) return null;

  const sinCambios =
    fullName.trim() === (appUser.fullName || appUser.displayName || "") &&
    country === (appUser.country || "") &&
    phone.trim() === (appUser.phone || "");

  async function guardar() {
    if (!fullName.trim()) {
      setAviso({ tono: "mal", texto: "Escribe tu nombre." });
      return;
    }
    setGuardando(true);
    setAviso(null);
    try {
      await completeUserProfile(appUser!.uid, {
        fullName: fullName.trim(),
        country,
        phone: phone.trim(),
      });
      // Sin esto los datos quedan bien guardados pero la pantalla (y el nombre
      // de arriba) seguirían mostrando los viejos hasta recargar.
      await refrescarPerfil();
      setAviso({ tono: "ok", texto: "Guardado." });
    } catch {
      setAviso({ tono: "mal", texto: "No se pudo guardar. Revisa tu conexión e inténtalo otra vez." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Seccion icono="👤" titulo="Mis datos" descripcion="Se guardan en tu cuenta.">
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold">Nombre completo</span>
          <input
            className="input mt-1.5"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={80}
            autoComplete="name"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">País</span>
          <select
            className="input mt-1.5"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">Sin decir</option>
            {PAISES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold">WhatsApp</span>
          <input
            className="input mt-1.5"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={30}
            inputMode="tel"
            autoComplete="tel"
            placeholder="+57 300 000 0000"
          />
          <span className="mt-1 block text-xs text-muted">
            Es por donde te escribe quien acompaña el grupo si te ve atrasado. No se publica en
            ningún lado ni lo ven los demás participantes.
          </span>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void guardar()}
          disabled={guardando || sinCambios}
          className="btn-primary"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        {aviso && (
          <span
            className={`text-sm font-semibold ${
              aviso.tono === "ok" ? "text-success" : "text-warning"
            }`}
          >
            {aviso.texto}
          </span>
        )}
      </div>
    </Seccion>
  );
}
