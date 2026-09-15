"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { FIREBASE_PUBLIC } from "@/config/firebase-public";

/**
 * Configuración pública de Firebase (va en el navegador; no es secreta).
 *
 * Desde la migración a Azure, Firebase se usa SOLO para una cosa: el login con
 * Google. Los datos viven en Azure y quien decide qué puede ver cada persona es
 * la API, que comprueba el pase de Google en cada petición.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? FIREBASE_PUBLIC.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? FIREBASE_PUBLIC.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? FIREBASE_PUBLIC.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? FIREBASE_PUBLIC.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? FIREBASE_PUBLIC.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? FIREBASE_PUBLIC.appId,
};

/** ¿Están configuradas las claves de Firebase? */
export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

// initializeApp NO falla si faltan claves (solo guarda la config).
export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * Servicios PEREZOSOS: getAuth solo se llama cuando se usa
 * (en el navegador). Así el build/prerender nunca intenta inicializar Firebase
 * sin claves, y no rompe.
 */
let _auth: Auth | null = null;
let _provider: GoogleAuthProvider | null = null;

export function getClientAuth(): Auth {
  if (!_auth) _auth = getAuth(firebaseApp);
  return _auth;
}

export function getGoogleProvider(): GoogleAuthProvider {
  if (!_provider) {
    _provider = new GoogleAuthProvider();
    _provider.setCustomParameters({ prompt: "select_account" });
  }
  return _provider;
}
