"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { SITE } from "@/config/site";

const STEPS = [
  { icon: "🎬", title: "Mira el video", text: "Una guía breve para entrar en la lección del día." },
  { icon: "📖", title: "Lee la lección", text: "El texto original del Curso, tal cual, en modo lectura." },
  { icon: "🌿", title: "Llévala a tu día", text: "Guía clara, ejemplos cotidianos y una reflexión final." },
];

const FEATURES = [
  { icon: "🧭", title: "Guía amorosa", text: "Cada lección explicada con lenguaje claro, humano y profundo." },
  { icon: "✅", title: "Tu avance", text: "Marca tus lecciones y observa tu camino crecer día a día." },
  { icon: "💬", title: "Comunidad", text: "Un foro por lección para compartir y acompañarnos." },
  { icon: "🌅", title: "Calma", text: "Un espacio sereno, sin ruido, pensado para tu paz." },
];

export default function HomePage() {
  const { firebaseUser, loading } = useAuth();
  const cta = firebaseUser ? "/dashboard" : "/login";
  const ctaLabel = firebaseUser ? "Continuar mi camino" : "Entrar con Google";

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <div className="animate-fade-up">
            <span className="badge bg-primary/12 text-primary">
              {SITE.org}
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
              Un Curso de Milagros,
              <span className="bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent">
                {" "}un paso de paz cada día.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              Acompañamiento diario de las {SITE.totalLessons} lecciones: video,
              lectura, guía cercana y comunidad. Tu proceso, a tu ritmo, con calma.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={cta} className="btn-primary text-base" aria-disabled={loading}>
                {ctaLabel}
              </Link>
              <Link href="/lecciones" className="btn-ghost text-base">
                Ver las lecciones
              </Link>
            </div>
          </div>

          <div className="relative animate-fade-up">
            <div className="relative mx-auto aspect-[4/3] w-full max-w-md sm:max-w-lg lg:max-w-none">
              <div className="absolute -inset-4 animate-breathe rounded-[2rem] bg-gradient-to-br from-gold/30 via-primary/25 to-aqua/25 blur-2xl" />
              <Image
                src="/images/hero.png"
                alt="Amanecer espiritual con montañas, luz dorada y cielo índigo aqua"
                fill
                priority
                sizes="(min-width: 1024px) 520px, (min-width: 640px) 512px, 100vw"
                className="relative rounded-[2rem] object-cover shadow-glow"
              />
            </div>
          </div>
        </div>
      </section>

      {/* PASOS */}
      <section className="container-page py-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/15 text-xl">
                  {s.icon}
                </span>
                <span className="text-xs font-bold text-muted">Paso {i + 1}</span>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="container-page py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6 text-center">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-2 font-display text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="container-page py-14">
        <div className="card overflow-hidden bg-gradient-to-br from-primary/12 to-gold/12 p-10 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Hoy es un buen día para empezar.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Entra con tu cuenta de Google y comienza la lección de hoy.
          </p>
          <Link href={cta} className="btn-primary mt-6 text-base">
            {ctaLabel}
          </Link>
        </div>
      </section>
    </div>
  );
}
