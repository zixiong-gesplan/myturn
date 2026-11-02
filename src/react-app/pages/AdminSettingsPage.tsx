"use client";

import { useEffect, useState } from "react";
import { ApiError, api } from "../api.ts";
import { AdminShell } from "../components/AdminShell.tsx";

export function AdminSettingsPage() {
  const [form, setForm] = useState({
    establishmentName: "",
    publicBaseUrl: "",
    contactEmail: "",
    contactPostalAddress: "",
    dataControllerName: "",
    privacyPolicyVersion: "1.0",
    retentionDays: 7,
  });
  const [whatsapp, setWhatsapp] = useState<Record<string, boolean> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.settings().then((r) => {
      setForm({
        establishmentName: String(r.data.settings.establishmentName ?? ""),
        publicBaseUrl: String(r.data.settings.publicBaseUrl ?? ""),
        contactEmail: String(r.data.settings.contactEmail ?? ""),
        contactPostalAddress: String(r.data.settings.contactPostalAddress ?? ""),
        dataControllerName: String(r.data.settings.dataControllerName ?? ""),
        privacyPolicyVersion: String(r.data.settings.privacyPolicyVersion ?? "1.0"),
        retentionDays: Number(r.data.settings.retentionDays ?? 7),
      });
      setWhatsapp(r.data.whatsapp);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.saveSettings(form);
      setMessage("Ajustes guardados.");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "No se han podido guardar");
    }
  }

  return (
    <AdminShell title="Ajustes del establecimiento">
      <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-xl bg-white p-5 shadow-sm">
        {(
          [
            ["establishmentName", "Nombre del establecimiento"],
            ["publicBaseUrl", "URL pública del servicio"],
            ["dataControllerName", "Responsable del tratamiento"],
            ["contactEmail", "Correo de contacto"],
            ["contactPostalAddress", "Dirección postal"],
            ["privacyPolicyVersion", "Versión de la política de privacidad"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            {label}
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="block text-sm">
          Días de conservación de datos personales
          <input
            type="number"
            min={1}
            max={30}
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.retentionDays}
            onChange={(e) => setForm({ ...form, retentionDays: Number(e.target.value) })}
          />
        </label>
        <button className="rounded-lg bg-navy px-4 py-2 text-white">Guardar</button>
        {message ? <p className="text-sm">{message}</p> : null}
      </form>
      <section className="mt-8 max-w-xl rounded-xl bg-white p-5 text-sm shadow-sm">
        <h2 className="font-semibold text-navy">WhatsApp (API oficial)</h2>
        <p className="mt-2 text-muted">
          El envío está desactivado por defecto. No se afirma que los mensajes sean gratuitos. Hasta que exista una
          modalidad de coste cero validada, no se enviarán mensajes automáticos.
        </p>
        {whatsapp ? (
          <ul className="mt-3 list-disc pl-5">
            <li>WHATSAPP_ENABLED: {whatsapp.enabled ? "sí" : "no"}</li>
            <li>WHATSAPP_PAID_MESSAGES_ALLOWED: {whatsapp.paidMessagesAllowed ? "sí" : "no"}</li>
            <li>Credenciales configuradas: {whatsapp.configured ? "sí" : "no"}</li>
          </ul>
        ) : null}
      </section>
    </AdminShell>
  );
}
