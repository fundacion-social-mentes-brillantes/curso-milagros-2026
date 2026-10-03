"use client";

import { useEffect, useState } from "react";
import { Libro, NombreCurso } from "@/components/marca/Libro";

/**
 * Al abrir la app: una luz dorada dibuja el libro, sale un pulso del centro y
 * aparece el nombre con brillo, que luego se calma. Unos 2,5 s y se desvanece.
 *
 * Solo la primera vez de cada visita (no en cada cambio de pantalla) y nunca si
 * la persona pidió menos movimiento. Lo decide `GUION_ARRANQUE`, que corre antes
 * de pintar nada: así no se ve un destello de la página antes del arranque.
 */
export const GUION_ARRANQUE = `
try{
  if(!sessionStorage.getItem('ucdm.arranque')
     && localStorage.getItem('gemb.movimiento')!=='poco'
     && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.documentElement.classList.add('ver-arranque');
    sessionStorage.setItem('ucdm.arranque','1');
  }
}catch(e){}
`;

export function Arranque() {
  const [vivo, setVivo] = useState(true);

  useEffect(() => {
    if (!document.documentElement.classList.contains("ver-arranque")) {
      setVivo(false);
      return;
    }
    const t = setTimeout(() => {
      document.documentElement.classList.remove("ver-arranque");
      setVivo(false);
    }, 3400);
    return () => clearTimeout(t);
  }, []);

  if (!vivo) return null;
  return (
    <div className="arranque" aria-hidden>
      <div className="flex flex-col items-center">
        <Libro dibujar className="w-[8.6rem] [transform:perspective(900px)_rotateX(9deg)] md:w-[11rem]" />
        <span className="pulso" />
        <NombreCurso className="mt-9 w-[min(78vw,19rem)] md:w-[27rem]" />
      </div>
    </div>
  );
}
