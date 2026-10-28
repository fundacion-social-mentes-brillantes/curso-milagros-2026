"use client";

import { ErrorApi, llamar } from "@/lib/api";

/**
 * QUE UNA LECCIÓN MARCADA NO SE PIERDA NUNCA.
 *
 * Lo que pasaba (Sebastián, 21-23 y 27 de octubre de 2026): marcaba la lección
 * temprano, el botón se ponía dorado y decía «Lección completada» al instante,
 * y se iba a WhatsApp a mandar su mensaje al grupo. Pero el servidor (Azure, en
 * el plan gratuito) a esa hora está dormido y tarda en despertar; con la app ya
 * en segundo plano, la petición se perdía. Al otro día la lección aparecía sin
 * hacer y «atrasado 3». En el servidor no quedaba ni rastro de esas marcas.
 *
 * Ahora:
 *  1. La marca se anota PRIMERO en el celular (localStorage), con la hora real.
 *  2. Se envía con `keepalive` (sigue aunque se cierre la página) y se reintenta
 *     si falla la conexión o el servidor.
 *  3. Si aun así no llega, queda pendiente y se vuelve a mandar sola: al abrir
 *     la app, al volver a ella y cada medio minuto (AvisoMarcasPendientes), con un
 *     aviso visible mientras tanto.
 *  4. Se manda con la hora en que se marcó (`marcadaEn`): aunque llegue al otro
 *     día, cuenta para el día en que de verdad se hizo.
 * Solo se borra de pendientes cuando el servidor la confirma, o cuando contesta
 * un «no» definitivo (por ejemplo el tope de 3 lecciones de ese día).
 */

const CLAVE = "ucdm.marcas-pendientes";

export interface MarcaPendiente {
  uid: string;
  n: number;
  marcadaEn: number;
}

export interface MarcaGuardada {
  position: number | null;
  hechasHoy: number;
}

const oyentes = new Set<() => void>();

const llave = (uid: string, n: number) => `${uid}:${n}`;
// Envíos en curso: si la misma marca ya va en camino (por ejemplo, el reintento
// al volver de WhatsApp mientras el primer envío sigue esperando al servidor),
// se espera ese mismo envío en vez de mandar otro.
const enVuelo = new Map<string, Promise<MarcaGuardada>>();
// Hora de la última marca que el servidor confirmó, por lección. Así el botón
// se pone dorado aunque la haya guardado el aviso de arriba, por detrás.
const confirmadas = new Map<string, number>();

function leer(): MarcaPendiente[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const avisar = () => oyentes.forEach((f) => f());

function escribir(lista: MarcaPendiente[]): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* sin almacenamiento: queda solo el intento en vivo */
  }
  avisar();
}

export function suscribirPendientes(f: () => void): () => void {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

export function pendientesDe(uid: string): MarcaPendiente[] {
  return leer().filter((m) => m.uid === uid);
}

export function anotarPendiente(uid: string, n: number, marcadaEn: number): void {
  confirmadas.delete(llave(uid, n));
  escribir([...leer().filter((m) => !(m.uid === uid && m.n === n)), { uid, n, marcadaEn }]);
}

export function quitarPendiente(uid: string, n: number): void {
  escribir(leer().filter((m) => !(m.uid === uid && m.n === n)));
}

/** ¿Esa marca va ahora mismo camino al servidor? */
export function enCamino(uid: string, n: number): boolean {
  return enVuelo.has(llave(uid, n));
}

/** Si el servidor ya confirmó la última marca de esa lección, la hora en que se hizo. */
export function marcaConfirmada(uid: string, n: number): number | null {
  return confirmadas.get(llave(uid, n)) ?? null;
}

/** ¿Es un «no» definitivo del servidor (no vale la pena reintentar)? */
export function esRespuestaDefinitiva(e: unknown): boolean {
  return e instanceof ErrorApi && e.estado >= 400 && e.estado < 500 && e.estado !== 401 && e.estado !== 408;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Manda una marca al servidor. Reintenta dos veces más si falla la conexión o el
 * servidor (que puede tardar en despertar); un «no» definitivo sube enseguida.
 */
export function enviarMarca(uid: string, n: number, marcadaEn: number): Promise<MarcaGuardada> {
  const k = llave(uid, n);
  const yaVa = enVuelo.get(k);
  if (yaVa) return yaVa;
  const envio = mandar(n, marcadaEn)
    .then((r) => {
      confirmadas.set(k, marcadaEn);
      return r;
    })
    .finally(() => {
      enVuelo.delete(k);
      avisar();
    });
  enVuelo.set(k, envio);
  avisar();
  return envio;
}

async function mandar(n: number, marcadaEn: number): Promise<MarcaGuardada> {
  let ultimo: unknown;
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await llamar<{ position: number | null; hechasHoy?: number }>(`/avance/${n}`, {
        metodo: "POST",
        cuerpo: { completed: true, marcadaEn },
        keepalive: true,
        tiempoMaximo: 25000,
      });
      return { position: r.position ?? null, hechasHoy: Number(r.hechasHoy ?? 0) };
    } catch (e) {
      ultimo = e;
      if (esRespuestaDefinitiva(e)) throw e;
      if (intento < 2) await espera(2000 * (intento + 1));
    }
  }
  throw ultimo;
}

let enviando = false;

/**
 * Vuelve a mandar las marcas que quedaron pendientes. Devuelve las lecciones que
 * por fin quedaron guardadas (para avisar y refrescar el perfil).
 */
export async function reenviarPendientes(uid: string): Promise<number[]> {
  if (enviando) return [];
  enviando = true;
  const guardadas: number[] = [];
  try {
    for (const m of pendientesDe(uid).sort((a, b) => a.n - b.n)) {
      try {
        await enviarMarca(uid, m.n, m.marcadaEn);
        quitarPendiente(uid, m.n);
        guardadas.push(m.n);
      } catch (e) {
        // Un «no» definitivo (tope del día, lección fuera de orden) no se va a
        // arreglar reintentando: se deja de insistir.
        if (esRespuestaDefinitiva(e)) quitarPendiente(uid, m.n);
      }
    }
  } finally {
    enviando = false;
  }
  return guardadas;
}
