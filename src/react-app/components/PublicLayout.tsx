"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export function PublicLayout({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:bg-white focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/turno" className="text-lg font-semibold tracking-tight">
            MiTurno
          </Link>
          <nav className="flex gap-4 text-sm text-white/90">
            <Link href="/turno">Solicitar turno</Link>
            <Link href="/privacidad">Privacidad</Link>
          </nav>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {title ? <h1 className="mb-6 text-2xl font-semibold text-navy">{title}</h1> : null}
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-4 px-4 py-4 text-sm text-muted">
          <Link href="/privacidad">Política de privacidad</Link>
          <Link href="/aviso-legal">Aviso legal</Link>
          <Link href="/contacto">Contacto</Link>
          <Link href="/admin/login">Personal</Link>
        </div>
      </footer>
    </div>
  );
}
