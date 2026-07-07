import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

/**
 * Manifiesto PWA: permite "Instalar la aplicación" en Android (Chrome) y deja la
 * app con ícono propio y pantalla completa. Next.js lo sirve en
 * /manifest.webmanifest y enlaza el <link rel="manifest"> automáticamente.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: "Curso Milagros",
    description: SITE.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    // "any" (no bloquear a vertical) para que el video pueda girar a horizontal
    // y verse grande en el celular.
    orientation: "any",
    lang: "es",
    background_color: "#092622",
    theme_color: "#0F3630",
    categories: ["lifestyle", "education"],
    icons: [
      {
        src: "/images/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
