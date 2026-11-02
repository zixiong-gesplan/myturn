"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { TrackingView } from "../../shared/types.ts";
import { ApiError, api, formatWhen } from "../api.ts";
import { PublicLayout } from "../components/PublicLayout.tsx";

export function SeguimientoPage() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<TrackingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const etag = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const result = await api.track(token!, etag.current);
        if (cancelled) return;
        if (!result.notModified && result.data) setView(result.data);
        etag.current = result.etag;
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se ha podido consultar el turno.");
        }
      }
    }
    void load();
    const id = window.setInterval(load, 2500);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  return (
    <PublicLayout>
      <section className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        {error ? (
          <p className="text-danger" role="alert">
            {error}
          </p>
        ) : !view ? (
          <p className="text-muted" role="status">
            Cargando tu turno…
          </p>
        ) : (
          <div aria-live="polite">
            <h1 className="text-2xl font-bold text-navy">Tu turno: {view.displayNumber}</h1>
            <p className="mt-4 text-lg font-medium">{view.statusLabel}</p>
            <p className="mt-2 text-muted">{view.statusMessage}</p>
            <p className="mt-4">
              Actualmente estamos atendiendo el turno {view.currentDisplayNumber ?? "—"}.
            </p>
            <p className="mt-1">Tienes {view.peopleAhead} {view.peopleAhead === 1 ? "persona" : "personas"} por delante.</p>
            <p className="mt-4 text-sm text-muted">Solicitado el {formatWhen(view.createdAt)}.</p>
            <p className="mt-6 text-xs text-muted">Esta página se actualiza sola cada pocos segundos.</p>
          </div>
        )}
        <Link href="/turno" className="mt-6 inline-block text-sm text-navy underline">
          Volver a solicitar turno
        </Link>
      </section>
    </PublicLayout>
  );
}
