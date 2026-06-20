"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/common/RouteGuard";
import { listUsers } from "@/lib/users";
import { UsersTable } from "@/components/admin/UsersTable";
import { PageLoader } from "@/components/ui/Spinner";
import type { AppUser } from "@/types";

function UsuariosInner() {
  const [users, setUsers] = useState<AppUser[] | null>(null);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  if (users === null) return <PageLoader label="Cargando personas..." />;

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-eyebrow">Administración</p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Personas y seguimiento</h1>
          <p className="mt-2 text-muted">Toca el rol de una persona para cambiarlo entre Usuario y Admin.</p>
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
