import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Serif_Display } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import { BarraInferior } from "@/components/layout/BarraInferior";
import { Footer } from "@/components/layout/Footer";
import { Arranque, GUION_ARRANQUE } from "@/components/marca/Arranque";
import { SenseiChat } from "@/components/sensei/SenseiChat";
import { OneSignalInit } from "@/components/notifications/OneSignalInit";
import { SITE } from "@/config/site";
import { GUION_ANTI_PARPADEO } from "@/lib/ajustes";

/*
 * LAS LETRAS (Sebastián, 2 oct 2026, sobre el estilo del video «superconscious»).
 * El nombre «UN CURSO DE MILAGROS» NO es una letra: es una imagen fija recortada
 * de la referencia oficial (public/images/marca). Todo lo demás:
 *   · Manrope → la interfaz entera: titulares grandes y apretados, botones,
 *     menús y textos. Moderna, limpia, como la del video. Los acentos de los
 *     titulares («Hola, Ana», «Lección 275») van en la misma letra, delgada y
 *     en dorado (no en cursiva: así lo pidió Sebastián).
 *   · Noto Serif Display, delgada → el número de la lección y el nombre de la
 *     persona («Lección 275», «Hola ANA»), como en las imágenes de Sebastián.
 *     Él eligió esta, libre, en vez de Le Jour Serif (la de sus imágenes), que
 *     pide licencia web. Para cambiarla, ver `.letra-display` en globals.css.
 *   · Glacial Indifference → el texto de la lección, para leer descansado.
 * Las tres son libres (OFL); sus licencias están en src/app/fuentes.
 */
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const display = Noto_Serif_Display({
  subsets: ["latin"],
  weight: "300",
  variable: "--font-display",
  display: "swap",
});

const lectura = localFont({
  src: [
    { path: "./fuentes/glacial-indifference-400.woff2", weight: "400", style: "normal" },
    { path: "./fuentes/glacial-indifference-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-leer",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE.name} · ${SITE.org}`,
    template: `%s · ${SITE.shortName}`,
  },
  description: SITE.description,
  icons: {
    icon: [
      { url: "/icons/favicon-64.png", type: "image/png", sizes: "64x64" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    // El iPhone redondea solo; por eso este va lleno, sin transparencia.
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Curso Milagros",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    images: [
      {
        url: "/images/og.png",
        width: 1200,
        height: 630,
        alt: `${SITE.name} - amanecer espiritual`,
      },
    ],
  },
};

export const viewport: Viewport = {
  // El noche verde azulado del ícono instalado: así la app no salta de color al
  // abrirse. Si la persona elige otro tema, `aplicar()` reescribe esta etiqueta.
  themeColor: "#01110E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      // El tema de siempre viene puesto ya desde aquí. Así, si el guioncito de
      // abajo no llega a correr, la página se ve como toda la vida en vez de
      // quedarse sin colores.
      className={`dark ${manrope.variable} ${display.variable} ${lectura.variable}`}
      data-tema="esmeralda"
      suppressHydrationWarning
    >
      <head>
        {/*
          Corre ANTES de que se pinte nada y deja puesto el tema elegido. Sin
          esto se vería un parpadeo: primero el tema de siempre y de golpe el
          otro. Tiene que ir en crudo porque React todavía no existe aquí.
        */}
        <script dangerouslySetInnerHTML={{ __html: GUION_ANTI_PARPADEO }} />
        <script dangerouslySetInnerHTML={{ __html: GUION_ARRANQUE }} />
      </head>
      <body className="font-sans antialiased scrollbar-soft">
        {/* Las luces que se pasean por los bordes, como en el video (globals.css). */}
        <div className="luces" aria-hidden>
          <i className="l1" />
          <i className="l2" />
          <i className="l3" />
          <i className="l4" />
        </div>
        <AuthProvider>
          <Arranque />
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <BarraInferior />
          <SenseiChat />
          <OneSignalInit />
        </AuthProvider>
      </body>
    </html>
  );
}
