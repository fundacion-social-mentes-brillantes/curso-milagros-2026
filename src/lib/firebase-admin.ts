/**
 * Firebase del lado del SERVIDOR (solo para las rutas /api).
 *
 * Por qué existe: el recordatorio diario corre sin que nadie haya iniciado
 * sesión, así que no hay un token de persona con el que leer Firestore. Con la
 * llave de servicio, el servidor lee la lista de participantes por su cuenta.
 *
 * NUNCA se importa desde un componente del navegador: la llave es secreta y
 * vive solo en las variables de entorno de Vercel (FIREBASE_SERVICE_ACCOUNT_JSON).
 */

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { FIREBASE_PUBLIC } from "@/config/firebase-public";

let app: App | null = null;

/**
 * El proyecto se fija A MANO y siempre. Si no, el SDK lo deduce de la llave que
 * encuentre y podría acabar leyendo la base de OTRO proyecto de la fundación
 * (pasó en pruebas: devolvía cero participantes sin dar ningún error).
 */
const PROYECTO = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || FIREBASE_PUBLIC.projectId;

/** ¿Está puesta la llave de servicio? (sin ella, la ruta avisa y no revienta) */
export function hayLlaveDeServicio(): boolean {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim().startsWith("{")) return true;
  // En el computador de casa vale la credencial que ya usa gcloud, así la
  // ruta se puede probar en local sin copiar ninguna llave al proyecto.
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

/**
 * La conexión lleva nombre propio. Así nunca reutiliza por error otra conexión
 * de Firebase que ya estuviera abierta (que fue justo lo que, en pruebas, la
 * hizo apuntar a la base equivocada).
 */
const NOMBRE = "recordatorio-diario";

function appAdmin(): App {
  if (app) return app;

  const yaAbierta = getApps().find((a) => a.name === NOMBRE);
  if (yaAbierta) {
    app = yaAbierta;
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim().startsWith("{")) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = initializeApp(
        { credential: applicationDefault(), projectId: PROYECTO },
        NOMBRE,
      );
      return app;
    }
    throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_JSON en las variables de entorno.");
  }

  const cuenta = JSON.parse(raw) as Record<string, unknown>;
  // Al pegar el JSON en Vercel, los saltos de línea de la clave quedan como \n
  // literales y la firma falla. Se devuelven a saltos de verdad.
  if (typeof cuenta.private_key === "string") {
    cuenta.private_key = cuenta.private_key.replace(/\\n/g, "\n");
  }

  app = initializeApp(
    { credential: cert(cuenta as never), projectId: PROYECTO },
    NOMBRE,
  );
  return app;
}

export function dbAdmin(): Firestore {
  return getFirestore(appAdmin());
}
