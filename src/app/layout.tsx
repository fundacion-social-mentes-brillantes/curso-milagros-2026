import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SenseiChat } from "@/components/sensei/SenseiChat";
import { OneSignalInit } from "@/components/notifications/OneSignalInit";
import { SITE } from "@/config/site";
import { GUION_ANTI_PARPADEO } from "@/lib/ajustes";

const serif = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
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
    icon: [{ url: "/images/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/images/icon.png", sizes: "512x512" }],
  },
  appleWebApp: {
    capable: true,
    title: "Curso Milagros",
    statusBarStyle: "default",
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
  // El de "Esmeralda", que es el tema por defecto. Si la persona elige otro,
  // `aplicar()` reescribe esta etiqueta al vuelo (ver src/lib/ajustes.ts).
  themeColor: "#0F3630",
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
      className={`dark ${serif.variable} ${sans.variable}`}
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
      </head>
      <body className="font-sans antialiased scrollbar-soft">
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <SenseiChat />
          <OneSignalInit />
        </AuthProvider>
      </body>
    </html>
  );
}
