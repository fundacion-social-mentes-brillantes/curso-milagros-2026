import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
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
 * LAS LETRAS (Sebastián, 3 oct 2026). El nombre «UN CURSO DE MILAGROS» NO es una
 * letra: es una imagen fija recortada de la referencia oficial
 * (public/images/marca). Todo lo demás:
 *   · Newsreader → TODA la interfaz: títulos, números, botones, menús y textos.
 *     Es la serif editorial de su referencia; con su tamaño óptico se ve fina
 *     en los títulos grandes y clara en lo pequeño.
 *   · Glacial Indifference → solo el texto de la lección, para leer descansado.
 */
const serif = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
  // Next no trae las medidas de respaldo de Newsreader y avisaba al construir.
  adjustFontFallback: false,
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
      className={`dark ${serif.variable} ${lectura.variable}`}
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
