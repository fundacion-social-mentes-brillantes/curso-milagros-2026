/** @type {import('next').NextConfig} */

// Cabeceras de seguridad aplicadas a todas las rutas. Conservadoras a propósito:
// protegen sin romper el login de Google, Firebase, ni los videos de YouTube/Drive.
const securityHeaders = [
  // Evita que otro sitio incruste la app en un iframe (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Evita que el navegador "adivine" tipos de archivo (MIME-sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No filtrar URLs internas completas al navegar a otros sitios.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactiva APIs del navegador que la app no usa.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Fuerza HTTPS en visitas futuras.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // CSP mínima y SEGURA: bloquea clickjacking (frame-ancestors), la inyección de
  // <base> y los plugins, SIN restringir scripts/conexiones/imágenes/iframes
  // (por eso no rompe Firebase, el login de Google ni los videos).
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
  },
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Fotos de perfil de Google
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Imágenes/thumbnails de Google Drive (si se usan)
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.google.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
