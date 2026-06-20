"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageLoader } from "@/components/ui/Spinner";

function ConfigNotice() {
  return (
    <div className="container-page py-20">
      <div className="card mx-auto max-w-xl p-8 text-center">
        <p className="text-4xl">🔧</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Falta configurar Firebase</h1>
        <p className="mt-2 text-muted">
          Copia <code className="rounded bg-surface-2 px-1">.env.local.example</code> como{" "}
          <code className="rounded bg-surface-2 px-1">.env.local</code> y pega las claves de tu
          proyecto de Firebase. Revisa <code className="rounded bg-surface-2 px-1">INSTALACION.md</code>.
        </p>
      </div>
    </div>
  );
}

function NotAuthorized() {
  return (
    <div className="container-page py-20">
      <div className="card mx-auto max-w-xl p-8 text-center">
        <p className="text-4xl">🕊️</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Esta sección es solo para guías</h1>
        <p className="mt-2 text-muted">
          No tienes permisos de administración. Si crees que es un error, escribe a tu facilitador.
        </p>
        <Link href="/dashboard" className="btn-primary mt-6">
          Volver a mi camino
        </Link>
      </div>
    </div>
  );
}

export function RouteGuard({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { loading, configured, firebaseUser, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (configured && !loading && !firebaseUser) {
      router.replace("/login");
    }
  }, [configured, loading, firebaseUser, router]);

  if (!configured) return <ConfigNotice />;
  if (loading) return <PageLoader />;
  if (!firebaseUser) return <PageLoader label="Redirigiendo al inicio de sesión..." />;
  if (requireAdmin && !isAdmin) return <NotAuthorized />;
  return <>{children}</>;
}
