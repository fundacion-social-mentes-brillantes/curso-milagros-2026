/** @type {import('next').NextConfig} */
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
};

export default nextConfig;
