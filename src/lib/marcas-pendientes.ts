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
  /** La hora con la que quedó guardada (si ya estaba hecha, la de antes). */
  completedAt: number | null;
}

/** Una marca que el servidor rechazó del todo, para avisarle a la persona. */
export interface MarcaDescartada {
  n: number;
  motivo: string;
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

/** Guarda la lista en el celular. Devuelve false si no se pudo (almacenamiento lleno o bloqueado). */
function escribir(lista: MarcaPendiente[]): boolean {
  let ok = true;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    ok = false; // sin almacenamiento: queda solo el intento en vivo
  }
  avisar();
  return ok;
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

/**
 * Anota la marca en el celular antes de enviarla. Devuelve false si el celular
 * no la pudo guardar: entonces, si el envío falla, hay que decirlo en voz alta
 * (no hay copia que se reenvíe sola).
 */
export function anotarPendiente(uid: string, n: number, marcadaEn: number): boolean {
  confirmadas.delete(llave(uid, n));
  return escribir([...leer().filter((m) => !(m.uid === uid && m.n === n)), { uid, n, marcadaEn }]);
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

/**
 * ¿Es un «no» definitivo del servidor (no vale la pena reintentar)?
 *
 * Solo dos: el tope de lecciones de ese día, y una petición mal formada. Todo
 * lo demás se reintenta, incluidos 401/403/404/429 que puede dar Azure por su
 * cuenta (sesión por renovar, una publicación en curso, demasiadas peticiones):
 * antes cualquier 4xx borraba la marca sin avisar.
 */
export function esRespuestaDefinitiva(e: unknown): boolean {
  return e instanceof ErrorApi && (e.clave === "limite-diario" || e.estado === 400);
}

/** Cómo decirle a la persona por qué el servidor no aceptó una marca. */
export function motivoDeRechazo(e: unknown): string {
  return e instanceof ErrorApi && e.clave === "limite-diario"
    ? "ese día ya tenías 3 lecciones marcadas"
    : "el curso no la aceptó";
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Manda una marca al servidor. Reintenta dos veces más si falla la conexión o el
 * servidor (que puede tardar en despertar); un «no» definitivo sube enseguida.
 */
export function enviarMarca(
  uid: string,
  n: number,
  marcadaEn: number,
  via: "boton" | "reenvio" = "boton",
): Promise<MarcaGuardada> {
  const k = llave(uid, n);
  const yaVa = enVuelo.get(k);
  if (yaVa) return yaVa;
  const envio = mandar(n, marcadaEn, via)
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

async function mandar(n: number, marcadaEn: number, via: string): Promise<MarcaGuardada> {
  let ultimo: unknown;
  for (let intento = 0; intento < 3; intento++) {
    try {
      // «via» e «intento» solo van para la bitácora del servidor (para entender fallos).
      const r = await llamar<{ position: number | null; hechasHoy?: number; completedAt?: number | null }>(
        `/avance/${n}`,
        {
          metodo: "POST",
          cuerpo: { completed: true, marcadaEn, via, intento: intento + 1 },
          keepalive: true,
          tiempoMaximo: 25000,
        },
      );
      return {
        position: r?.position ?? null,
        hechasHoy: Number(r?.hechasHoy ?? 0),
        completedAt: Number(r?.completedAt) || null,
      };
    } catch (e) {
      ultimo = e;
      if (esRespuestaDefinitiva(e)) throw e;
      if (intento < 2) await espera(2000 * (intento + 1));
    }
  }
  throw ultimo;
}

/**
 * Le cuenta al servidor que una marca se perdió o se rechazó (para la bitácora).
 * Si tampoco llega, no pasa nada: el aviso en pantalla ya se mostró.
 */
export function reportarProblema(evento: string, n: number, detalle = ""): void {
  void llamar("/diagnostico", {
    metodo: "POST",
    cuerpo: { evento, n, detalle: detalle.slice(0, 200) },
    keepalive: true,
    tiempoMaximo: 15000,
  }).catch(() => {});
}

let enviando = false;

/**
 * Vuelve a mandar las marcas que quedaron pendientes. Devuelve las que por fin
 * quedaron guardadas (para avisar y refrescar el perfil) y las que el servidor
 * rechazó del todo (para AVISAR: antes se borraban en silencio).
 */
export async function reenviarPendientes(
  uid: string,
): Promise<{ guardadas: number[]; descartadas: MarcaDescartada[] }> {
  const guardadas: number[] = [];
  const descartadas: MarcaDescartada[] = [];
  if (enviando) return { guardadas, descartadas };
  enviando = true;
  try {
    for (const m of pendientesDe(uid).sort((a, b) => a.n - b.n)) {
      try {
        await enviarMarca(uid, m.n, m.marcadaEn, "reenvio");
        quitarPendiente(uid, m.n);
        guardadas.push(m.n);
      } catch (e) {
        // Un «no» definitivo (el tope de ese día) no se arregla reintentando:
        // se deja de insistir, pero se le dice a la persona.
        if (esRespuestaDefinitiva(e)) {
          quitarPendiente(uid, m.n);
          descartadas.push({ n: m.n, motivo: motivoDeRechazo(e) });
          reportarProblema("marca-descartada", m.n, motivoDeRechazo(e));
        }
      }
    }
  } finally {
    enviando = false;
  }
  return { guardadas, descartadas };
}
