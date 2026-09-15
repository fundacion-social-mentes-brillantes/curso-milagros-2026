/** @type {import('next').NextConfig} */

// ────────────────────────────────────────────────────────────────────────────
// IMPORTANTE (migración a Azure Static Web Apps)
//
// Azure Static Web Apps sirve ARCHIVOS, no un servidor de Next.js. Por eso la
// app se "exporta" a HTML (output: "export"): al compilar se genera una carpeta
// `out/` con una página ya hecha para cada ruta, incluidas las 365 lecciones.
//
// Consecuencia directa: aquí ya NO pueden vivir las cabeceras de seguridad ni
// las reglas de caché. Un archivo suelto no puede añadir cabeceras por sí mismo;
// quien las pone es el servidor que lo entrega. Todas esas reglas se movieron,
// sin perder ninguna, al archivo `staticwebapp.config.json` de la raíz, que es
// donde Azure las lee. Si hay que tocar seguridad o caché, se toca ALLÍ.
// ────────────────────────────────────────────────────────────────────────────

const nextConfig = {
  reactStrictMode: true,

  // Genera el sitio como archivos estáticos en `out/`. Es la única forma
  // plenamente soportada por Azure Static Web Apps.
  output: "export",

  // Cada ruta se guarda como una carpeta con su `index.html`
  // (p. ej. `out/lecciones/42/index.html` en vez de `out/lecciones/42.html`).
  // Cualquier servidor de archivos sabe entregar un `index.html`, así que así
  // los enlaces funcionan en Azure sin configuración extra.
  trailingSlash: true,

  images: {
    // El "optimizador de imágenes" de Next es un programa que corre en un
    // servidor: redimensiona la foto al vuelo. En un sitio estático ese
    // servidor no existe, así que se apaga y las imágenes se sirven tal cual.
    // Sin esto, el build falla en los 4 sitios que usan <Image>.
    unoptimized: true,
    // Se conservan como documentación de los dominios externos de los que
    // vienen imágenes (fotos de perfil de Google, miniaturas de Drive).
    // Con `unoptimized: true` Next ya no los valida, pero si algún día se
    // vuelve a un servidor, la lista sigue aquí.
    remotePatterns: [
      // Fotos de perfil de Google
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Imágenes/thumbnails de Google Drive (si se usan)
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.google.com" },
    ],
  },
};

export default nextConfig;
