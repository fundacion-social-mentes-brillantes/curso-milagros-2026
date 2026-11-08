"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageLoader } from "@/components/ui/Spinner";
import { Onboarding } from "@/components/auth/Onboarding";

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

/** No se pudo traer el perfil ni reintentando: se dice, y se deja reintentar. */
function SinConexion({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="container-page py-20">
      <div className="vidrio mx-auto max-w-md rounded-[1.6rem] p-8 text-center">
        <p className="text-xl text-fg">No pudimos conectar con el curso</p>
        <p className="mt-2 text-sm text-muted">
          Puede ser la señal o que el servidor está despertando. Tu avance está a salvo.
        </p>
        <button onClick={onReintentar} className="boton-cristal mt-6">
          Reintentar
        </button>
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
  const { loading, configured, firebaseUser, appUser, isAdmin, perfilFallo, reintentarPerfil } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (configured && !loading && !firebaseUser) {
      router.replace("/login");
    }
  }, [configured, loading, firebaseUser, router]);

  if (!configured) return <ConfigNotice />;
  if (loading) return <PageLoader />;
  if (!firebaseUser) return <PageLoader label="Redirigiendo al inicio de sesión..." />;
  if (!appUser && perfilFallo) return <SinConexion onReintentar={reintentarPerfil} />;
  if (!appUser) return <PageLoader label="Preparando tu espacio..." />;
  // Primer ingreso: pedir datos de registro antes de entrar.
  if (!appUser.profileComplete) return <Onboarding />;
  if (requireAdmin && !isAdmin) return <NotAuthorized />;
  return <>{children}</>;
}
