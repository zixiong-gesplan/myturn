"use client";

import { useEffect, useState } from "react";
import type { AdminTicket } from "../../shared/types.ts";
import { statusLabel, type TicketStatus } from "../../shared/status.ts";
import { ApiError, api, formatWhen } from "../api.ts";
import { AdminShell } from "../components/AdminShell.tsx";

type QueueHistoryItem = {
  id: string;
  name: string;
  isOpen: boolean;
  openedAt: number;
  closedAt: number | null;
  ticketCount: number;
};

export function AdminHistoryPage() {
  const [queues, setQueues] = useState<QueueHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.queues()
      .then((result) => {
        setQueues(result.data.queues);
        const current = result.data.queues.find((queue) => queue.isOpen);
        if (current) setSelectedId(current.id);
      })
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "No se pudo cargar el historial."));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setTickets([]);
      return;
    }
    api.queueTickets(selectedId)
      .then((result) => setTickets(result.data.tickets))
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "No se pudieron cargar los turnos."));
  }, [selectedId]);

  return (
    <AdminShell title="Historial de colas">
      {error ? <p className="mb-4 text-danger" role="alert">{error}</p> : null}
      <label className="block max-w-xl text-sm">
        Jornada
        <select
          className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">Selecciona una cola</option>
          {queues.map((queue) => (
            <option key={queue.id} value={queue.id}>
              {queue.name} · {queue.isOpen ? "abierta" : "archivada"} · {queue.ticketCount} turnos
            </option>
          ))}
        </select>
      </label>
      {selectedId && tickets.length === 0 ? (
        <p className="mt-6 rounded-xl bg-white p-5 text-sm text-muted">Esta cola todavía no tiene tickets.</p>
      ) : null}
      {tickets.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-muted">
              <tr>
                <th className="px-3 py-2">Turno</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Teléfono</th>
                <th className="px-3 py-2">Solicitud</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold tabular-nums">{ticket.displayNumber}</td>
                  <td className="px-3 py-2">{ticket.name}</td>
                  <td className="px-3 py-2">{ticket.phoneMasked}</td>
                  <td className="px-3 py-2">{formatWhen(ticket.createdAt)}</td>
                  <td className="px-3 py-2">{statusLabel(ticket.status as TicketStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AdminShell>
  );
}
