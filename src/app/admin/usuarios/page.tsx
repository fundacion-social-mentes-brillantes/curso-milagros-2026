"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { subscribeUsers } from "@/lib/users";
import { UsersTable } from "@/components/admin/UsersTable";
import { PageLoader } from "@/components/ui/Spinner";
import type { AppUser } from "@/types";

function UsuariosInner() {
  const [users, setUsers] = useState<AppUser[] | null>(null);

  useEffect(() => {
    // En tiempo real: cualquier cambio (inscrito, rol) se ve al instante.
    return subscribeUsers(setUsers);
  }, []);

  if (users === null) return <PageLoader label="Cargando personas..." />;

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-eyebrow">Administración</p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Personas y seguimiento</h1>
          <p className="mt-2 text-muted">
            Solo la cuenta de la fundación (admin principal) puede nombrar o quitar
            administradores: toca <strong>«Hacer admin»</strong> en su fila y confirma. Los demás
            administradores gestionan todo lo demás, pero no cambian quién es admin.
          </p>
        </div>
        <Link href="/admin" className="btn-ghost text-sm">
          ← Panel
        </Link>
      </header>

      <div className="mt-6">
        <UsersTable users={users} editable />
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <RouteGuard requireAdmin>
      <UsuariosInner />
    </RouteGuard>
  );
}
