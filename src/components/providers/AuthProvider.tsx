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
import { ensureUserProfile, subscribeAppUser } from "@/lib/users";
import { ADMIN_EMAILS_PUBLIC } from "@/config/firebase-public";
import type { AppUser } from "@/types";

interface AuthState {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  configured: boolean;
  isAdmin: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
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
    await signOut(getClientAuth());
  }, []);

  const value: AuthState = {
    firebaseUser,
    appUser,
    loading,
    configured: firebaseConfigured,
    isAdmin: appUser?.role === "admin" || emailIsAdmin(firebaseUser?.email),
    signIn,
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
