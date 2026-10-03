import { SITE } from "@/config/site";

export function Footer() {
  return (
    // En el celular deja sitio para la barra flotante de abajo.
    <footer className="mt-16 pb-28 md:pb-0">
      <div className="container-page flex items-center gap-4 py-8">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/30" />
        <p className="text-center text-[0.62rem] font-medium uppercase tracking-[0.28em] text-muted/80">
          {SITE.org}
        </p>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/30" />
      </div>
    </footer>
  );
}
