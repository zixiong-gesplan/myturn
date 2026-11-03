"use client";

import { useEffect, useRef, useState } from "react";
import { statusLabel, type TicketStatus } from "../../shared/status.ts";
import type { AdminKpis, AdminTicket } from "../../shared/types.ts";
import { ApiError, api, formatWhen } from "../api.ts";
import { AdminShell } from "../components/AdminShell.tsx";

export function AdminDashboard() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [filter, setFilter] = useState<"active" | "today">("active");
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; action: "cancel" | "absent"; label: string } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const etag = useRef<string | undefined>(undefined);

  async function refresh(force = false) {
    const result = await api.adminTickets(filter, force ? undefined : etag.current);
    etag.current = result.etag;
    if (!result.notModified && result.data) {
      setTickets(result.data.tickets);
      setKpis(result.data.kpis);
    }
  }

  useEffect(() => {
    void refresh(true);
    const id = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(id);
  }, [filter]);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    try {
      const result = await fn();
      const data = result as { empty?: boolean; message?: string };
      setMessage(data?.empty ? data.message ?? "No hay turnos pendientes" : ok ?? "Acción realizada");
      await refresh(true);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Error al ejecutar la acción");
    }
  }

  return (
    <AdminShell title="Cola de atención">
      {kpis ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label="En atención" value={kpis.currentDisplayNumber ?? "—"} />
          <Kpi label="Pendientes" value={String(kpis.pendingCount)} />
          <Kpi label="Atendidos hoy" value={String(kpis.completedToday)} />
          <Kpi label="Ausentes hoy" value={String(kpis.absentCount)} />
          <Kpi label="Cancelados hoy" value={String(kpis.cancelledCount)} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-danger"
          onClick={() => {
            if (window.confirm("Abrir una cola nueva cancelará los turnos activos de la cola actual y conservará su historial. ¿Continuar?")) {
              void run(() => api.newQueue(), "Nueva cola abierta; los turnos anteriores se conservaron en el historial");
            }
          }}
        >
          Abrir nueva cola
        </button>
        <button className="rounded-lg bg-navy px-4 py-2 text-white" onClick={() => run(() => api.callNext())}>
          Llamar al siguiente turno
        </button>
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2" onClick={() => run(() => api.repeat(), "Llamada repetida")}>
          Repetir la llamada
        </button>
        {kpis?.isPaused ? (
          <button className="rounded-lg bg-confirm px-4 py-2 text-white" onClick={() => run(() => api.resume(), "Cola reanudada")}>
            Reanudar cola
          </button>
        ) : (
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2" onClick={() => run(() => api.pause(), "Cola en pausa")}>
            Pausar cola
          </button>
        )}
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2" onClick={() => setManualOpen(true)}>
          Crear turno manual
        </button>
        <button
          className="rounded-lg border border-slate-300 bg-white px-4 py-2"
          onClick={() => setFilter((f) => (f === "active" ? "today" : "active"))}
        >
          {filter === "active" ? "Ver turnos de hoy" : "Ver pendientes"}
        </button>
      </div>
      {kpis?.isPaused ? <p className="mt-3 text-sm text-amber-800">La cola está en pausa: no se pueden hacer nuevas llamadas.</p> : null}
      {message ? (
        <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm" role="status">
          {message}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-muted">
            <tr>
              <th className="px-3 py-2">Turno</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Solicitud</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  No hay turnos pendientes
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold tabular-nums">{t.displayNumber}</td>
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2">{t.emailMasked}</td>
                  <td className="px-3 py-2">{formatWhen(t.createdAt)}</td>
                  <td className="px-3 py-2">{statusLabel(t.status as TicketStatus)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {t.status === "called" ? (
                        <button className="rounded bg-slate-100 px-2 py-1" onClick={() => run(() => api.serve(t.id), "En atención")}>
                          En atención
                        </button>
                      ) : null}
                      {t.status === "called" || t.status === "in_service" ? (
                        <button className="rounded bg-confirm px-2 py-1 text-white" onClick={() => run(() => api.complete(t.id), "Atendido")}>
                          Atendido
                        </button>
                      ) : null}
                      <button
                        className="rounded bg-slate-100 px-2 py-1"
                        onClick={() => setConfirm({ id: t.id, action: "absent", label: `¿Marcar el turno ${t.displayNumber} como ausente?` })}
                      >
                        Ausente
                      </button>
                      <button
                        className="rounded bg-red-50 px-2 py-1 text-danger"
                        onClick={() => setConfirm({ id: t.id, action: "cancel", label: `¿Cancelar el turno ${t.displayNumber}? Esta acción es irreversible.` })}
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirm ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" className="max-w-md rounded-xl bg-white p-5">
            <p>{confirm.label}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded px-3 py-2" onClick={() => setConfirm(null)}>
                Volver
              </button>
              <button
                className="rounded bg-danger px-3 py-2 text-white"
                onClick={() => {
                  const action = confirm.action === "cancel" ? api.cancel : api.absent;
                  void run(() => action(confirm.id));
                  setConfirm(null);
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {manualOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <form
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl bg-white p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api.createManual(manualName, manualEmail), "Turno creado");
              setManualOpen(false);
              setManualName("");
              setManualEmail("");
            }}
          >
            <h2 className="text-lg font-semibold">Crear turno manual</h2>
            <label className="mt-4 block text-sm">
              Nombre
              <input className="mt-1 w-full rounded border px-3 py-2" value={manualName} onChange={(e) => setManualName(e.target.value)} required />
            </label>
            <label className="mt-3 block text-sm">
              Correo electrónico
              <input type="email" className="mt-1 w-full rounded border px-3 py-2" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} required />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setManualOpen(false)}>
                Cerrar
              </button>
              <button type="submit" className="rounded bg-navy px-3 py-2 text-white">
                Crear
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AdminShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-navy">{value}</p>
    </div>
  );
}
