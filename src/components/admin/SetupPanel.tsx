"use client";

import { useState } from "react";
import { importLessonTextClient, seedLessonsClient } from "@/lib/lessons";
import { Spinner } from "@/components/ui/Spinner";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function SetupPanel({ onChanged }: { onChanged?: () => void }) {
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(30);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function doSeed() {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const { created, skipped } = await seedLessonsClient();
      setSeedMsg(`Listo: ${created} lecciones creadas${skipped ? `, ${skipped} ya existían` : ""}.`);
      onChanged?.();
    } catch {
      setSeedMsg("No se pudo crear. ¿Iniciaste sesión como admin y publicaste las reglas?");
    } finally {
      setSeeding(false);
    }
  }

  async function doImport() {
    const a = Math.max(1, Math.min(360, Math.trunc(from)));
    const b = Math.max(a, Math.min(360, Math.trunc(to)));
    setImporting(true);
    setImportMsg(null);
    let ok = 0;
    let review = 0;
    let failed = 0;
    const total = b - a + 1;
    for (let n = a; n <= b; n++) {
      try {
        const { found } = await importLessonTextClient(n);
        if (found) ok++;
        else review++;
      } catch {
        failed++;
      }
      setProgress({ done: n - a + 1, total });
      await sleep(350); // amable con el blog
    }
    setProgress(null);
    setImportMsg(`Importadas ${a}–${b}: ${ok} bien, ${review} para revisar, ${failed} con error.`);
    onChanged?.();
  }

  return (
    <div className="card border-dashed p-5">
      <h3 className="font-display text-lg font-semibold">⚙️ Preparar el contenido</h3>
      <p className="mt-1 text-sm text-muted">
        Solo la primera vez: crea las lecciones y trae el texto original. Todo desde aquí, sin terminal.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Paso 1: crear */}
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-bold">1. Crear las 365 lecciones</p>
          <p className="mt-1 text-xs text-muted">
            Crea la estructura y la Lección 25 de ejemplo. No borra lo que ya exista.
          </p>
          <button onClick={() => void doSeed()} disabled={seeding} className="btn-primary mt-3">
            {seeding ? <Spinner /> : "Crear lecciones"}
          </button>
          {seedMsg && <p className="mt-2 text-sm text-fg/80">{seedMsg}</p>}
        </div>

        {/* Paso 2: importar */}
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-bold">2. Importar texto original</p>
          <p className="mt-1 text-xs text-muted">
            Trae el texto exacto desde el blog. Hazlo por tramos (las 361–365 se cargan a mano).
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold">
              Desde
              <input
                type="number"
                min={1}
                max={360}
                value={from}
                onChange={(e) => setFrom(Number(e.target.value))}
                className="input mt-1 w-20"
              />
            </label>
            <label className="text-xs font-semibold">
              Hasta
              <input
                type="number"
                min={1}
                max={360}
                value={to}
                onChange={(e) => setTo(Number(e.target.value))}
                className="input mt-1 w-20"
              />
            </label>
            <button onClick={() => void doImport()} disabled={importing} className="btn-ghost">
              {importing ? <Spinner /> : "Importar"}
            </button>
          </div>
          {progress && (
            <p className="mt-2 text-sm text-muted">
              Importando… {progress.done}/{progress.total}
            </p>
          )}
          {importMsg && <p className="mt-2 text-sm text-fg/80">{importMsg}</p>}
        </div>
      </div>
    </div>
  );
}
