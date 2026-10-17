import LeccionCliente from "./LeccionCliente";
import { SITE } from "@/config/site";

// ────────────────────────────────────────────────────────────────────────────
// Cáscara de la página de una lección.
//
// OJO: este archivo NO lleva "use client" a propósito. Es una página "de
// servidor": se calcula UNA vez, al compilar. Todo lo que se ve está en
// `LeccionCliente.tsx`, que sí es de cliente (necesita al usuario, botones...).
//
// Se partió en dos porque el sitio se publica como archivos estáticos en Azure
// y hace falta `generateStaticParams`, que solo funciona en una página de
// servidor.
// ────────────────────────────────────────────────────────────────────────────

/**
 * La lista de páginas que hay que fabricar al compilar.
 *
 * Como no hay servidor que responda "sobre la marcha" cuando alguien entra a
 * `/lecciones/128`, ese archivo tiene que existir de antemano. Aquí se le dice
 * a Next: crea una página para cada lección, de la 1 a la 365.
 */
export function generateStaticParams() {
  return Array.from({ length: SITE.totalLessons }, (_, i) => ({
    numero: String(i + 1),
  }));
}

export default function LessonPage({ params }: { params: { numero: string } }) {
  return <LeccionCliente numero={params.numero} />;
}
