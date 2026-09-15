"use client";

import { getClientAuth } from "@/lib/firebase";

/**
 * El único punto por el que la app habla con sus datos.
 *
 * Antes cada pantalla hablaba directamente con Firestore y las reglas de
 * seguridad decidían qué podía ver. Ahora los datos viven en Azure y quien
 * decide es la API: por eso TODA petición lleva el "pase" del login con Google,
 * y el servidor comprueba quién eres antes de responder.
 *
 * Si algo falla se devuelve null o una lista vacía en vez de reventar: una
 * pantalla a medias es molesta, pero una pantalla en blanco con un error rojo
 * asusta a quien solo quiere hacer su lección.
 */

const BASE = "/api";

/** El pase de la persona. Si no ha entrado, no hay nada que pedir. */
async function pase(): Promise<string | null> {
  try {
    const usuario = getClientAuth().currentUser;
    if (!usuario) return null;
    return await usuario.getIdToken();
  } catch {
    return null;
  }
}

export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    public readonly clave: string,
  ) {
    super(`api ${estado}: ${clave}`);
  }
}

interface Opciones {
  metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  cuerpo?: unknown;
  /** Rutas públicas (como la configuración) que no necesitan sesión. */
  publica?: boolean;
}

/**
 * Llama a la API. Lanza ErrorApi si el servidor responde mal, para que quien
 * llama decida si eso importa o no.
 */
export async function llamar<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { metodo = "GET", cuerpo, publica = false } = opciones;

  const cabeceras: Record<string, string> = {};
  if (!publica) {
    const token = await pase();
    if (!token) throw new ErrorApi(401, "sin-sesion");
    cabeceras.Authorization = `Bearer ${token}`;
  }
  if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    cache: "no-store",
  });

  if (!res.ok) {
    let clave = "fallo";
    try {
      const d = (await res.json()) as { error?: string };
      clave = d.error ?? clave;
    } catch {
      /* respuesta sin cuerpo */
    }
    throw new ErrorApi(res.status, clave);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Igual que `llamar`, pero devuelve un valor de respaldo si algo falla. */
export async function llamarSeguro<T>(
  ruta: string,
  respaldo: T,
  opciones: Opciones = {},
): Promise<T> {
  try {
    return await llamar<T>(ruta, opciones);
  } catch {
    return respaldo;
  }
}

/**
 * Sustituto de las suscripciones "en vivo" que daba Firestore.
 *
 * Se decidió quitar el tiempo real en la migración: ahora los datos se piden
 * una vez y ya. Se conserva la MISMA forma de antes (pasas una función y
 * recibes otra para cancelar) para no tener que cambiar ninguna pantalla.
 */
export function cargarUnaVez<T>(
  pedir: () => Promise<T>,
  cb: (valor: T) => void,
): () => void {
  let vivo = true;
  void pedir()
    .then((v) => {
      if (vivo) cb(v);
    })
    .catch(() => {
      /* sin datos: la pantalla enseña su estado vacío */
    });
  return () => {
    vivo = false;
  };
}
