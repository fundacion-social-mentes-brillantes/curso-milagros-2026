"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getClientAuth, firebaseConfigured, getGoogleProvider } from "@/lib/firebase";
import { ensureUserProfile, getAppUser, subscribeAppUser } from "@/lib/users";
import { ADMIN_EMAILS_PUBLIC } from "@/config/firebase-public";
import type { AppUser } from "@/types";
import { esDemo, USUARIO_DEMO } from "@/lib/demo";

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

  useEffect(() => {
    // Solo en `npm run dev`: «?demo» entra con una persona de prueba (ver lib/demo.ts).
    if (process.env.NODE_ENV === "development" && esDemo()) {
      setFirebaseUser({ uid: "demo", email: USUARIO_DEMO.email, displayName: USUARIO_DEMO.displayName, photoURL: null } as unknown as User);
      setAppUser(USUARIO_DEMO);
      setLoading(false);
      return;
    }
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }

    let unsubUser: (() => void) | undefined;
    const auth = getClientAuth();

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (unsubUser) {
        unsubUser();
        unsubUser = undefined;
      }

      if (!user) {
        setFirebaseUser(null);
        setAppUser(null);
        setLoading(false);
        return;
      }

      setFirebaseUser(user);
      try {
        await ensureUserProfile(user);
      } catch {
        /* no romper el login si falla la creación del perfil */
      }

      unsubUser = subscribeAppUser(user.uid, (au) => {
        setAppUser(au);
        setLoading(false);
      });
    });

    return () => {
      unsub();
      if (unsubUser) unsubUser();
    };
  }, []);

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
    const actualizado = await getAppUser(uid);
    if (actualizado) setAppUser(actualizado);
  }, [firebaseUser?.uid]);

  const value: AuthState = {
    firebaseUser,
    appUser,
    loading,
    configured: firebaseConfigured,
    isAdmin: appUser?.role === "admin" || emailIsAdmin(firebaseUser?.email),
    signIn,
    signOutUser,
    refrescarPerfil,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
