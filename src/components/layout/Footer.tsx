import { SITE } from "@/config/site";

/**
 * El pie, como el del video: una línea pequeña con el nombre de la organización
 * y, abajo, el nombre del curso gigante, encendido desde abajo con la luz
 * esmeralda. El nombre es la misma imagen fija del logo (hace de molde).
 */
export function Footer() {
  return (
    // En el celular deja sitio para la barra flotante de abajo.
    <footer className="mt-24 overflow-hidden pb-28 md:pb-8">
      <div className="container-page">
        <div className="flex flex-col items-center justify-between gap-2 border-t border-fg/10 pt-6 text-center text-xs font-medium text-muted sm:flex-row sm:text-left">
          <p>{SITE.org}</p>
          <p>Un Curso de Milagros · {SITE.totalLessons} lecciones</p>
        </div>
        <div className="pie-marca mt-10 md:mt-14" aria-hidden>
          <span className="molde" />
        </div>
      </div>
    </footer>
  );
}
