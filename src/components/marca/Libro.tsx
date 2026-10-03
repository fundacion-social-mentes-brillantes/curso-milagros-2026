import { useId } from "react";

/**
 * El libro del ícono UCDM, calcado de public/icons/icon-512.png con sus mismas
 * coordenadas (no es un logo nuevo: es el mismo dibujo, sin el cuadrado).
 * Un solo trazo continuo: lomo arriba → página izquierda → lomo abajo →
 * página derecha → lomo. Así la luz puede dibujarlo de un tirón al abrir la app.
 */
export const LIBRO = {
  caja: "168 159 175 132",
  trazo:
    "M255.5 179 C238 171.6 222 167 201 167 L182.5 167.7 Q177 168 177 173.5 L177 263 Q177 268.6 182.5 268.5 L201 267.2 C222 267.3 238 272 255.5 281.2 " +
    "C273 272 289 267.3 310 267.2 L328.5 268.5 Q334 268.6 334 263 L334 173.5 Q334 168 328.5 167.7 L310 167 C289 167 273 171.6 255.5 179 V281.2",
  izquierda:
    "M255.5 179 C238 171.6 222 167 201 167 L182.5 167.7 Q177 168 177 173.5 L177 263 Q177 268.6 182.5 268.5 L201 267.2 C222 267.3 238 272 255.5 281.2 Z",
  derecha:
    "M255.5 179 C273 171.6 289 167 310 167 L328.5 167.7 Q334 168 334 173.5 L334 263 Q334 268.6 328.5 268.5 L310 267.2 C289 267.3 273 272 255.5 281.2 Z",
};

/** El libro de cristal: páginas de vidrio oscuro con el filo de luz dorada. */
export function Libro({ dibujar = false, className = "" }: { dibujar?: boolean; className?: string }) {
  // Cada libro necesita sus propios id: si dos comparten el filtro, el navegador
  // pinta un recuadro fantasma donde no debe.
  const id = useId().replace(/:/g, "");
  const d = dibujar ? "dibuja" : "";
  return (
    <svg viewBox={LIBRO.caja} aria-hidden className={`libro-svg block h-auto overflow-visible ${className || "w-full"}`}>
      <defs>
        <linearGradient id={`vidrio-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(255,255,255)" stopOpacity=".09" />
          <stop offset=".55" stopColor="rgb(40,190,165)" stopOpacity=".05" />
          <stop offset="1" stopColor="rgb(236,205,140)" stopOpacity=".08" />
        </linearGradient>
        <filter id={`halo-${id}`} x="150" y="140" width="210" height="170" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
      </defs>
      <path d={LIBRO.izquierda} fill={`url(#vidrio-${id})`} className="pagina" />
      <path d={LIBRO.derecha} fill={`url(#vidrio-${id})`} className="pagina" />
      <path d={LIBRO.trazo} pathLength={100} className={`filo-halo ${d}`} filter={`url(#halo-${id})`} />
      <path d={LIBRO.trazo} pathLength={100} className={`filo ${d}`} />
      <path d={LIBRO.trazo} pathLength={100} className={`filo-nucleo ${d}`} />
      {dibujar && (
        <>
          <path d={LIBRO.trazo} pathLength={100} className="cometa" />
          <path d={LIBRO.trazo} pathLength={100} className="cometa ancha" filter={`url(#halo-${id})`} />
        </>
      )}
    </svg>
  );
}

/** El nombre del curso: la imagen fija recortada de la referencia oficial. */
export function NombreCurso({ linea = false, className = "" }: { linea?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={linea ? "/images/marca/un-curso-de-milagros-linea.png" : "/images/marca/un-curso-de-milagros.png"}
      alt="Un Curso de Milagros"
      width={linea ? 2000 : 1400}
      height={linea ? 159 : 537}
      className={`nombre-curso ${className}`}
      draggable={false}
    />
  );
}
