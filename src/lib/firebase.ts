"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { FIREBASE_PUBLIC } from "@/config/firebase-public";

/**
 * Configuración pública de Firebase (va en el navegador; no es secreta).
 * Usa variables de entorno si existen; si no, el respaldo público.
 * La seguridad real la dan las reglas de Firestore.
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
 * Servicios PEREZOSOS: getAuth/getFirestore solo se llaman cuando se usan
 * (en el navegador). Así el build/prerender nunca intenta inicializar Firebase
 * sin claves, y no rompe.
 */
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _provider: GoogleAuthProvider | null = null;

export function getClientAuth(): Auth {
  if (!_auth) _auth = getAuth(firebaseApp);
  return _auth;
}

export function getDb(): Firestore {
  if (!_db) _db = getFirestore(firebaseApp);
  return _db;
}

export function getGoogleProvider(): GoogleAuthProvider {
  if (!_provider) {
    _provider = new GoogleAuthProvider();
    _provider.setCustomParameters({ prompt: "select_account" });
  }
  return _provider;
}
