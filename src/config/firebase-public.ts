/**
 * Configuración PÚBLICA de Firebase (NO es secreta: va dentro de la página web).
 * Sirve como respaldo cuando no hay variables de entorno (por ejemplo, en un
 * despliegue rápido en Vercel). La seguridad real la dan las reglas de Firestore
 * y los "Dominios autorizados" de Authentication, no estas claves.
 */
export const FIREBASE_PUBLIC = {
  apiKey: "AIzaSyAQHdhDuW_erc5eeUtB0XZ63Y8EZjJB7pI",
  authDomain: "curso-milagros-2026.firebaseapp.com",
  projectId: "curso-milagros-2026",
  storageBucket: "curso-milagros-2026.firebasestorage.app",
  messagingSenderId: "118931736232",
  appId: "1:118931736232:web:815f630175953a7378649d",
} as const;

export const ADMIN_EMAILS_PUBLIC = ["fundacionsocial@gimnasioemocionalmb.com"];
