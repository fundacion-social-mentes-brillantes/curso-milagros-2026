"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getClientAuth, firebaseConfigured, getGoogleProvider } from "@/lib/firebase";
import { cargarMiPerfil, getAppUser } from "@/lib/users";
import { ADMIN_EMAILS_PUBLIC } from "@/config/firebase-public";
import type { AppUser } from "@/types";
import { esDemo, usuarioDemo } from "@/lib/demo";

interface AuthState {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  configured: boolean;
  isAdmin: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  /**
   * Vuelve a leer el perfil del servidor. Lo necesita quien cambia sus propios
   * datos (Ajustes): sin esto el nombre nuevo se guardaría bien, pero la
   * pantalla seguiría mostrando el viejo hasta recargar.
   */
  refrescarPerfil: () => Promise<void>;
  /** No se pudo traer el perfil al entrar, ni reintentando (sin señal o servidor caído). */
  perfilFallo: boolean;
  /** Vuelve a intentar traer el perfil (el botón «Reintentar»). */
  reintentarPerfil: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

// Correos admin para el gateo de la INTERFAZ (la seguridad real está en las
// reglas de Firestore). Es público a propósito.
const ADMIN_EMAILS = (
  process.env.NEXT_PUBLIC_ADMIN_EMAILS
    ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(",")
    : ADMIN_EMAILS_PUBLIC
)
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function emailIsAdmin(email: string | null | undefined): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [perfilFallo, setPerfilFallo] = useState(false);
  // Cada lectura del perfil lleva un número de turno y solo vale la más
  // reciente: si dos lecturas se cruzan, la vieja no pisa a la nueva (antes la
  // lección actual podía quedar atrasada si la respuesta lenta llegaba última).
  const turnoPerfil = useRef(0);
  const turnoRefresco = useRef(0);

  const traerPerfil = useCallback(async () => {
    const turno = ++turnoPerfil.current;
    turnoRefresco.current++; // un refresco que venía en camino ya no vale
    setPerfilFallo(false);
    const perfil = await cargarMiPerfil();
    if (turno === turnoPerfil.current) {
      if (perfil) setAppUser(perfil);
      else setPerfilFallo(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Solo en `npm run dev`: «?demo» entra con una persona de prueba (ver lib/demo.ts).
    if (process.env.NODE_ENV === "development" && esDemo()) {
      setFirebaseUser({ uid: "demo", email: usuarioDemo().email, displayName: usuarioDemo().displayName, photoURL: null } as unknown as User);
      setAppUser(usuarioDemo());
      setLoading(false);
      return;
    }
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }

    const auth = getClientAuth();

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        turnoPerfil.current++; // cualquier lectura en camino ya no vale
        setFirebaseUser(null);
        setAppUser(null);
        setPerfilFallo(false);
        setLoading(false);
        return;
      }
      setFirebaseUser(user);
      // Una sola lectura (crea el perfil si es la primera vez), con reintentos.
      await traerPerfil();
    });

    return () => {
      turnoPerfil.current++;
      unsub();
    };
  }, [traerPerfil]);

  const signIn = useCallback(async () => {
    await signInWithPopup(getClientAuth(), getGoogleProvider());
  }, []);

  const signOutUser = useCallback(async () => {
    if (process.env.NODE_ENV === "development" && esDemo()) {
      sessionStorage.removeItem("ucdm.demo");
      setFirebaseUser(null);
      setAppUser(null);
      return;
    }
    await signOut(getClientAuth());
  }, []);

  const refrescarPerfil = useCallback(async () => {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    const base = turnoPerfil.current;
    const mio = ++turnoRefresco.current;
    const actualizado = await getAppUser(uid);
    if (actualizado && base === turnoPerfil.current && mio === turnoRefresco.current) {
      setAppUser(actualizado);
      setPerfilFallo(false);
    }
  }, [firebaseUser?.uid]);

  const reintentarPerfil = useCallback(() => {
    if (firebaseUser) void traerPerfil();
  }, [firebaseUser, traerPerfil]);

  const value: AuthState = {
    firebaseUser,
    appUser,
    loading,
    configured: firebaseConfigured,
    isAdmin: appUser?.role === "admin" || emailIsAdmin(firebaseUser?.email),
    signIn,
    signOutUser,
    refrescarPerfil,
    perfilFallo,
    reintentarPerfil,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
