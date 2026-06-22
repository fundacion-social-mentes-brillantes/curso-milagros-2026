import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SenseiChat } from "@/components/sensei/SenseiChat";
import { SITE } from "@/config/site";

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
    <html lang="es" className={`dark ${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased scrollbar-soft">
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <SenseiChat />
        </AuthProvider>
      </body>
    </html>
  );
}
