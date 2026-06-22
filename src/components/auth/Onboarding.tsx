"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { completeUserProfile } from "@/lib/users";
import { Spinner } from "@/components/ui/Spinner";
import { ASK_STARTING_LESSON, SITE } from "@/config/site";

const COUNTRIES = [
  "Colombia",
  "México",
  "Argentina",
  "Chile",
  "Perú",
  "Ecuador",
  "Venezuela",
  "Bolivia",
  "Paraguay",
  "Uruguay",
  "Guatemala",
  "Honduras",
  "El Salvador",
  "Nicaragua",
  "Costa Rica",
  "Panamá",
  "Cuba",
  "República Dominicana",
  "Puerto Rico",
  "España",
  "Estados Unidos",
  "Otro",
];

export function Onboarding() {
  const { firebaseUser, appUser } = useAuth();
  const [fullName, setFullName] = useState(appUser?.fullName || appUser?.displayName || "");
  const [country, setCountry] = useState(appUser?.country || "");
  const [phone, setPhone] = useState(appUser?.phone || "");
  const [startLesson, setStartLesson] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = firebaseUser?.email ?? appUser?.email ?? "";

  async function submit() {
    if (!firebaseUser) return;
    if (!fullName.trim() || !country.trim() || !phone.trim()) {
      setError("Por favor completa todos los campos.");
      return;
    }
    const parsedStart = ASK_STARTING_LESSON ? Number(startLesson) : 1;
    setBusy(true);
    setError(null);
    try {
      await completeUserProfile(firebaseUser.uid, {
        fullName,
        country,
        phone,
        startLesson: parsedStart >= 1 ? parsedStart : 1,
      });
      // El cambio se refleja solo: el perfil pasa a "completo" y se abre la app.
    } catch {
      setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
      setBusy(false);
    }
  }

  return (
    <div className="container-page grid min-h-[80vh] place-items-center py-10">
      <div className="card w-full max-w-md overflow-hidden animate-fade-up">
        <div className="h-1 w-full bg-gradient-to-r from-gold via-gold-soft to-aqua" />
        <div className="p-7 sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-deep text-2xl shadow-glow">
            🌅
          </div>
          <h1 className="mt-4 text-center font-display text-2xl font-bold">Te damos la bienvenida</h1>
          <p className="mt-1 text-center text-sm text-muted">
            Antes de comenzar, cuéntanos quién eres. Solo se hace una vez.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold">Nombre completo</span>
              <input
                className="input mt-1.5"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre y apellido"
                autoFocus
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">Correo electrónico</span>
              <input className="input mt-1.5 cursor-default bg-surface-2/50 text-muted" value={email} readOnly />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">País</span>
              <select className="input mt-1.5" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Selecciona tu país…</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold">Número de celular</span>
              <input
                type="tel"
                className="input mt-1.5"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. +57 300 123 4567"
              />
            </label>

            {ASK_STARTING_LESSON && (
              <label className="block">
                <span className="text-sm font-semibold">¿En qué lección vas?</span>
                <span className="ml-1 text-xs text-muted">(este año el proceso ya comenzó)</span>
                <input
                  type="number"
                  min={1}
                  max={SITE.totalLessons}
                  className="input mt-1.5"
                  value={startLesson}
                  onChange={(e) => setStartLesson(e.target.value)}
                  placeholder="Ej. 27"
                />
                <span className="mt-1 block text-xs text-muted">
                  Marcaremos como hechas las anteriores, así no las registras una por una. Si
                  apenas empiezas, escribe 1.
                </span>
              </label>
            )}
          </div>

          {error && <p className="mt-4 text-center text-sm text-warning">{error}</p>}

          <button onClick={() => void submit()} disabled={busy} className="btn-primary mt-6 w-full text-base">
            {busy ? <Spinner /> : "Comenzar mi camino"}
          </button>
          <p className="mt-3 text-center text-xs text-muted">
            Tus datos son privados y solo los usa la fundación para acompañarte.
          </p>
        </div>
      </div>
    </div>
  );
}
