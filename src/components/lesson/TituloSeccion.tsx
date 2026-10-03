/**
 * El título de cada parte de la lección, igual en todas y al estilo del video:
 * Manrope grande y apretada, una pastilla con el ícono metida en la frase y el
 * final delgado y dorado («Escucha ◯ la lección»). Centrado y bastante más
 * grande que el texto que se lee, para que se note dónde empieza cada parte.
 */
export function TituloSeccion({
  icono,
  primera,
  acento,
  nota,
}: {
  icono: string;
  primera: string;
  acento: string;
  nota?: string;
}) {
  return (
    <header className="mb-8 text-center">
      <h2 className="titulo-seccion text-[2.15rem] md:text-[2.9rem]">
        {primera}
        <span className="pastilla" aria-hidden>
          <svg viewBox="0 0 24 24">
            <path d={icono} />
          </svg>
        </span>
        <em>{acento}</em>
      </h2>
      {nota && <p className="etiqueta mt-3">{nota}</p>}
    </header>
  );
}

export const ICONO_ESCUCHA = "M4.5 14.5v-2a7.5 7.5 0 0 1 15 0v2M3.6 13.6h3.6v5.6H3.6zM16.8 13.6h3.6v5.6h-3.6z";
export const ICONO_LEE = "M12 7.2C10 5.7 7 5.3 3.4 5.7v12c3.6-.4 6.6.1 8.6 1.5 2-1.4 5-1.9 8.6-1.5v-12C17 5.3 14 5.7 12 7.2ZM12 7.2v12";
export const ICONO_VIDEO = "M6.8 5.6h10.4a3.6 3.6 0 0 1 3.6 3.6v5.6a3.6 3.6 0 0 1-3.6 3.6H6.8a3.6 3.6 0 0 1-3.6-3.6V9.2a3.6 3.6 0 0 1 3.6-3.6ZM10.4 9.5v5l4.3-2.5-4.3-2.5Z";
export const ICONO_COMPARTE = "M20 11.6c0 4-3.6 7-8 7-1.2 0-2.3-.2-3.3-.6L4.4 19.4l1.2-3.4C4.6 14.8 4 13.3 4 11.6c0-4 3.6-7 8-7s8 3 8 7ZM9 11.6h.01M12 11.6h.01M15 11.6h.01";
