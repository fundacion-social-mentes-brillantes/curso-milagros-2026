export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary ${className}`}
    />
  );
}

export function PageLoader({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted">
        <Spinner className="h-8 w-8" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}
