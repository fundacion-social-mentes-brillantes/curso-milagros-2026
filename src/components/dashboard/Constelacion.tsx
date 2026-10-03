"use client";

import { useEffect, useRef } from "react";

/**
 * «Mi camino»: las 365 lecciones como partículas de luz que forman, sin línea,
 * una espiral que flota con profundidad. La lección 1 está en el centro.
 *   · hecha → punto dorado cálido
 *   · pendiente → casi transparente
 *   · la de hoy → halo esmeralda que late
 * Al tocar un punto sale una onda de luz con el número de la lección.
 */
export function Constelacion({ hechas, hoy, className = "" }: { hechas: Set<number>; hoy: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hechasRef = useRef(hechas);
  hechasRef.current = hechas;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const quieto =
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.getAttribute("data-movimiento") === "poco";

    // La espiral es siempre la misma (azar con semilla).
    let s = 7;
    const azar = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const puntos = Array.from({ length: 365 }, (_, i) => {
      const t = i / 364;
      const ang = 0.6 + t * 3.4 * Math.PI * 2;
      const r = 0.07 + 0.93 * Math.pow(t, 0.92);
      const desvio = (azar() - 0.5) * 0.05 * (0.4 + r);
      const lado = (azar() - 0.5) * 0.08;
      return { n: i + 1, ang: ang + lado / (r + 0.2), r: r + desvio, z: (azar() - 0.5) * 0.08, sx: 0, sy: 0, prof: 0 };
    });

    let w = 0;
    let h = 0;
    const medir = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(canvas);

    const ondas: { x: number; y: number; t0: number; n: number }[] = [];
    const tocar = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      const x = e.clientX - b.left;
      const y = e.clientY - b.top;
      let mejor: (typeof puntos)[number] | null = null;
      let d = 18;
      for (const p of puntos) {
        const q = Math.hypot(p.sx - x, p.sy - y);
        if (q < d) {
          d = q;
          mejor = p;
        }
      }
      if (mejor) ondas.push({ x: mejor.sx, y: mejor.sy, t0: performance.now(), n: mejor.n });
    };
    canvas.addEventListener("pointerdown", tocar);

    const t0 = performance.now();
    let raf = 0;
    const cuadro = (ahora: number) => {
      const t = (ahora - t0) / 1000;
      const giro = quieto ? 0 : t * 0.035;
      const aparece = quieto ? 1 : Math.min(1, t / 2.2);
      const hech = hechasRef.current;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h * 0.5;
      const incl = 0.58;
      const R = Math.min(w * 0.48, (h * 0.46) / incl);

      const g0 = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5);
      g0.addColorStop(0, "rgba(236,205,140,0.16)");
      g0.addColorStop(1, "rgba(236,205,140,0)");
      ctx.fillStyle = g0;
      ctx.fillRect(0, 0, w, h);

      for (const p of puntos) {
        const a = p.ang + giro;
        const yy = Math.sin(a) * p.r;
        p.prof = (yy + 1) / 2;
        p.sx = cx + Math.cos(a) * p.r * R;
        p.sy = cy + yy * R * incl + p.z * R;
      }
      const orden = [...puntos].sort((a, b) => a.prof - b.prof);
      for (const p of orden) {
        if (p.n === hoy || p.n / 365 > aparece * 1.02) continue;
        const tam = 0.65 + p.prof * 0.75;
        ctx.beginPath();
        if (hech.has(p.n)) {
          ctx.shadowColor = "rgba(255,226,160,0.9)";
          ctx.shadowBlur = 6 * tam;
          ctx.fillStyle = `rgba(${246 - p.prof * 6},${222 - p.prof * 4},${166 + p.prof * 20},${0.55 + p.prof * 0.45})`;
          ctx.arc(p.sx, p.sy, 1.9 * tam, 0, Math.PI * 2);
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(240,236,226,${0.07 + p.prof * 0.08})`;
          ctx.arc(p.sx, p.sy, 1.3 * tam, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      const p = puntos[hoy - 1];
      if (p && aparece >= 1) {
        if (hech.has(hoy)) {
          ctx.shadowColor = "rgba(255,226,160,0.95)";
          ctx.shadowBlur = 9;
          ctx.fillStyle = "#f6dfa6";
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 2.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          const pul = quieto ? 0.5 : (Math.sin(t * 1.8) + 1) / 2;
          const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, 20 + 8 * pul);
          g.addColorStop(0, `rgba(110,235,205,${0.6 + 0.25 * pul})`);
          g.addColorStop(0.4, "rgba(40,190,165,0.25)");
          g.addColorStop(1, "rgba(40,190,165,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 28, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fffaf0";
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (let i = ondas.length - 1; i >= 0; i--) {
        const o = ondas[i]!;
        const k = (ahora - o.t0) / 900;
        if (k >= 1) {
          ondas.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(255,240,205,${0.7 * (1 - k)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 4 + k * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,248,230,${1 - k})`;
        ctx.font = `700 12px ${getComputedStyle(document.body).fontFamily}`;
        ctx.textAlign = "center";
        ctx.fillText(`Lección ${o.n}`, o.x, o.y - 16 - k * 6);
      }
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", tocar);
    };
  }, [hoy]);

  return (
    <canvas
      ref={ref}
      className={`block h-full w-full cursor-pointer ${className}`}
      role="img"
      aria-label={`Tu camino: ${hechas.size} de 365 lecciones encendidas. Hoy vas en la lección ${hoy}.`}
    />
  );
}
