"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "../../shared/types.ts";
import { api } from "../api.ts";

export function AdminShell({ children, title }: { children: ReactNode; title: string }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.data.user))
      .catch(() => router.replace("/admin/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await api.logout();
    router.push("/admin/login");
  }

  if (loading) {
    return (
      <div className="p-8 text-muted" role="status">
        Cargando panel…
      </div>
    );
  }
  if (!user) return null;

  const linkClass = (href: string, exact = false) =>
    `rounded px-3 py-2 text-sm ${
      (exact ? pathname === href : pathname.startsWith(href)) ? "bg-white/15" : "hover:bg-white/10"
    }`;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            MiTurno · Administración
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <Link href="/admin" className={linkClass("/admin", true)}>
              Cola
            </Link>
            <Link href="/admin/qr" className={linkClass("/admin/qr")}>
              Código QR
            </Link>
            <Link href="/admin/historial" className={linkClass("/admin/historial")}>
              Historial
            </Link>
            <Link href="/admin/ajustes" className={linkClass("/admin/ajustes")}>
              Ajustes
            </Link>
            <span className="px-3 text-sm text-white/80">{user.username}</span>
            <button type="button" onClick={logout} className="rounded bg-white/10 px-3 py-2 text-sm">
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold text-navy">{title}</h1>
        {children}
      </main>
    </div>
  );
}
