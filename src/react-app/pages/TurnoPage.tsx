"use client";

import { useState } from "react";
import Link from "next/link";
import type { TicketCreated } from "../../shared/types.ts";
import { ApiError, api } from "../api.ts";
import { InstitutionLogo } from "../components/InstitutionLogo.tsx";
import { PublicLayout } from "../components/PublicLayout.tsx";

export function TurnoPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingHint, setExistingHint] = useState(false);
  const [created, setCreated] = useState<(TicketCreated & { recovered?: boolean }) | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingHint(false);
    if (!privacyAccepted) {
      setError("Debes aceptar la información de protección de datos para continuar.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.createTicket({
        name,
        email,
        privacyAccepted: true,
      });
      const data = result.data;
      if (data.existing && !data.recovered) {
        setExistingHint(true);
        return;
      }
      setCreated(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setExistingHint(true);
        setError(err.message);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No se ha podido solicitar el turno.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function recover() {
    setError(null);
    try {
      const result = await api.recoverTicket(email);
      setCreated(result.data);
      setExistingHint(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se ha podido recuperar el turno.");
    }
  }

  if (created?.displayNumber) {
    return (
      <PublicLayout>
        <section className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm" aria-live="polite">
          <InstitutionLogo />
          <p className="text-sm font-medium text-confirm">Confirmación</p>
          <h1 className="mt-1 text-2xl font-bold text-navy">¡Tu turno está confirmado!</h1>
          <p className="mt-6 text-center font-semibold tracking-[0.2em] text-navy" style={{ fontSize: "3.2rem", lineHeight: 1 }}>
            {created.displayNumber}
          </p>
          <p className="mt-4 text-center text-lg">
            Tu número de turno es <strong>{created.displayNumber}</strong>.
          </p>
          <p className="mt-2 text-center text-muted">
            Turno que se está atendiendo: {created.currentDisplayNumber ?? "ninguno todavía"}.
          </p>
          <p className="mt-1 text-center text-muted">Personas por delante: {created.peopleAhead}.</p>
          {created.emailQueued ? (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-confirm-dark">
              Hemos enviado el número de turno y el enlace de seguimiento a tu correo.
            </p>
          ) : created.recovered ? (
            <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-muted">
              Este es tu turno recuperado. El correo original no se ha vuelto a enviar; guarda el enlace de seguimiento.
            </p>
          ) : (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              No se pudo enviar el correo. Guarda el enlace de seguimiento y avisa al personal si necesitas ayuda.
            </p>
          )}
          <Link
            href={created.trackingPath}
            className="mt-6 block w-full rounded-xl bg-navy px-4 py-3 text-center font-semibold text-white"
          >
            Consultar mi turno
          </Link>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <InstitutionLogo />
        <h1 className="text-2xl font-bold text-navy">Solicita tu turno</h1>
        <p className="mt-2 text-sm text-muted">
          Introduce tu nombre y correo electrónico. Recibirás el número del turno por correo.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              aria-describedby="email-help"
            />
            <p id="email-help" className="mt-1 text-xs text-muted">
              Lo usaremos solo para enviarte el número y avisarte cuando se acerque tu turno.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="mt-1"
              required
            />
            <span>
              He leído la información básica de protección de datos y la{" "}
              <Link className="underline" href="/privacidad">
                política de privacidad
              </Link>
              . Los datos se usan para gestionar el turno y se eliminan a los 7 días de su finalización.
            </span>
          </label>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {existingHint ? (
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p>Ya hay un turno activo asociado a este correo.</p>
              <p className="mt-1 text-muted">
                Por privacidad no mostramos el número solo con el correo. Si lo pediste en este dispositivo, puedes
                recuperarlo. Si tienes el enlace privado, ábrelo.
              </p>
              <button type="button" onClick={recover} className="mt-3 rounded-lg bg-navy px-3 py-2 text-white">
                Recuperar turno de este dispositivo
              </button>
            </div>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-confirm px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Solicitando…" : "Solicitar turno"}
          </button>
        </form>
      </section>
    </PublicLayout>
  );
}
