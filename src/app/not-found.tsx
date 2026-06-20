import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-12 text-center">
      <div>
        <p className="text-5xl">🌌</p>
        <h1 className="mt-4 font-display text-3xl font-bold">Página no encontrada</h1>
        <p className="mt-2 text-muted">El camino que buscas no existe por aquí.</p>
        <Link href="/" className="btn-primary mt-6">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
