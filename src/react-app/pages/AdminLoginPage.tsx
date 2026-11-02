"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "../api.ts";
import { PublicLayout } from "../components/PublicLayout.tsx";

export function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.login(username, password);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se ha podido iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicLayout title="Acceso del personal">
      <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="username" className="block text-sm font-medium">
            Usuario
          </label>
          <input
            id="username"
            autoComplete="username"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-navy px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </PublicLayout>
  );
}
