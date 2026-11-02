"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicConfig, TicketCreated } from "../../shared/types.ts";
import { ApiError, api } from "../api.ts";
import { PublicLayout } from "../components/PublicLayout.tsx";

export function TurnoPage() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+34");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingHint, setExistingHint] = useState(false);
  const [created, setCreated] = useState<(TicketCreated & { recovered?: boolean }) | null>(null);

  useEffect(() => {
    api.publicConfig().then((r) => setConfig(r.data));
  }, []);

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
        phone,
        whatsappConsent: config?.whatsappChannelAvailable ? whatsappConsent : false,
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
      const result = await api.recoverTicket(phone);
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
          {!created.whatsappQueued ? (
            <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-muted">
              Guarda el enlace de seguimiento. La confirmación en pantalla es inmediata y no depende de WhatsApp.
            </p>
          ) : (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-confirm-dark">
              Hemos puesto en cola un aviso por WhatsApp. El envío depende de la aprobación de Meta y puede tener coste.
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
        <h1 className="text-2xl font-bold text-navy">Solicita tu turno</h1>
        <p className="mt-2 text-sm text-muted">
          Introduce tu nombre y teléfono móvil. Recibirás el número en esta pantalla.
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
            <label htmlFor="phone" className="block text-sm font-medium">
              Teléfono móvil
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              aria-describedby="phone-help"
            />
            <p id="phone-help" className="mt-1 text-xs text-muted">
              Prefijo por defecto +34. Puedes indicar otro prefijo internacional.
            </p>
          </div>
          {config?.whatsappChannelAvailable ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={whatsappConsent}
                onChange={(e) => setWhatsappConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                Quiero recibir la confirmación por WhatsApp. Puedo retirar este consentimiento más adelante. El envío
                usa la API oficial de Meta y no está garantizado como gratuito.
              </span>
            </label>
          ) : (
            <p className="rounded-lg bg-slate-100 p-3 text-sm text-muted">
              El aviso automático por WhatsApp no está activo. Tu turno se confirma aquí y con un enlace privado de
              seguimiento.
            </p>
          )}
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
              <p>Ya hay un turno activo asociado a este teléfono.</p>
              <p className="mt-1 text-muted">
                Por privacidad no mostramos el número solo con el teléfono. Si lo pediste en este dispositivo, puedes
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
