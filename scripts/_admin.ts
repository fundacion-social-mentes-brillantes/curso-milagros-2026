// Inicializador de Firebase Admin SOLO para scripts (carga .env.local).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv(); // también .env si existe

import {
  cert,
  getApps,
  initializeApp,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

let app: App | null = null;

export function admin(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0 && existing[0]) {
    app = existing[0];
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim().startsWith("{")) {
    const parsed = JSON.parse(raw);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    app = initializeApp({ credential: cert(parsed) });
    return app;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = initializeApp({ credential: applicationDefault() });
    return app;
  }

  throw new Error(
    "Faltan credenciales. Define FIREBASE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS en .env.local (ver INSTALACION.md).",
  );
}

export function db(): Firestore {
  return getFirestore(admin());
}

export function auth(): Auth {
  return getAuth(admin());
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
