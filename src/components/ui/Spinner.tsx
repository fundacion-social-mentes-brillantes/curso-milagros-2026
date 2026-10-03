export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-gold/25 border-t-gold ${className}`}
    />
  );
}

const INFINITO = "M 50 25 C 61 11, 87 9, 88 25 C 87 41, 61 39, 50 25 C 39 11, 13 9, 12 25 C 13 41, 39 39, 50 25 Z";

/**
 * Mientras carga una pantalla: una estela de luz recorre el infinito (el camino
 * de cada día) y cambia del marfil dorado al turquesa del ícono.
 */
export function PageLoader({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status">
      <div className="flex flex-col items-center gap-5 text-muted">
        <svg viewBox="0 0 100 50" className="infinito-carga h-[4.5rem] w-36 overflow-visible" aria-hidden>
          <path d={INFINITO} className="pista" />
          <path d={INFINITO} pathLength={100} className="estela ancha" />
          <path d={INFINITO} pathLength={100} className="estela media" />
          <path d={INFINITO} pathLength={100} className="estela punta" />
        </svg>
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}
