"use client";

import { Fila, Opciones, Seccion } from "./Seccion";
import { TEMAS, type Ajustes, type Movimiento, type Texto } from "@/lib/ajustes";

/**
 * CÓMO SE VE LA APP.
 *
 * Los cambios se aplican en el momento, sin botón de guardar: se elige mirando
 * el resultado, que es como se elige un color. Un "Guardar" aquí solo añadiría
 * un paso y la duda de si quedó puesto.
 */
export function Apariencia({
  ajustes,
  cambiar,
}: {
  ajustes: Ajustes;
  cambiar: <K extends keyof Ajustes>(campo: K, valor: Ajustes[K]) => void;
}) {
  return (
    <Seccion
      icono="🎨"
      titulo="Apariencia"
      descripcion="Se guarda en este aparato y se aplica al instante."
    >
      <p className="mb-3 text-sm font-semibold text-fg">Tema</p>
      <div
        role="radiogroup"
        aria-label="Tema de colores"
        className="grid gap-2.5 sm:grid-cols-2"
      >
        {TEMAS.map((t) => {
          const activo = ajustes.tema === t.id;
          return (
            <button
              key={t.id}
              role="radio"
              aria-checked={activo}
              onClick={() => cambiar("tema", t.id)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                activo
                  ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                  : "border-border bg-surface hover:bg-surface-2"
              }`}
            >
              {/* Muestra de los colores de verdad del tema, para elegir viendo
                  y no leyendo un nombre. */}
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border"
              >
                {t.muestra.map((c) => (
                  <span key={c} className="h-full w-1/3" style={{ background: c }} />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-fg">{t.nombre}</span>
                  {t.id === "esmeralda" && (
                    <span className="badge bg-gold/15 px-1.5 py-0 text-[10px] text-gold">
                      por defecto
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">
                  {t.descripcion}
                </span>
              </span>
              {activo && <span className="shrink-0 text-primary">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-5 divide-y divide-border border-t border-border pt-1">
        <Fila
          titulo="Tamaño de la lectura"
          ayuda="Solo cambia el texto de la lección, no los menús."
        >
          <Opciones<Texto>
            etiqueta="Tamaño de la lectura"
            valor={ajustes.texto}
            onCambiar={(v) => cambiar("texto", v)}
            opciones={[
              { id: "normal", nombre: "Normal" },
              { id: "grande", nombre: "Grande" },
              { id: "enorme", nombre: "Muy grande" },
            ]}
          />
        </Fila>

        <Fila
          titulo="Animaciones"
          ayuda="Quítalas si los movimientos de la pantalla te molestan o te marean."
        >
          <Opciones<Movimiento>
            etiqueta="Animaciones"
            valor={ajustes.movimiento}
            onCambiar={(v) => cambiar("movimiento", v)}
            opciones={[
              { id: "normal", nombre: "Normales" },
              { id: "poco", nombre: "Reducidas" },
            ]}
          />
        </Fila>
      </div>

      {/* Muestra en vivo: se ve el tamaño elegido con el texto de verdad, con
          su misma letra y su mismo interlineado. */}
      <div className="mt-5 rounded-xl border border-border bg-bg/40 p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
          Así se te verá la lección
        </p>
        <p className="reading">
          Nada de lo que veo significa nada. Esta idea es la que te prepara para todas las que
          vienen, porque suelta lo que creías saber y deja sitio para mirar de nuevo.
        </p>
      </div>
    </Seccion>
  );
}
