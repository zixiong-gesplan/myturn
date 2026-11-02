import type { AdminKpis, AdminTicket, PublicConfig, PublicQueue, SessionUser, TicketCreated, TrackingView } from "../shared/types.ts";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit & { etag?: string } = {}): Promise<{ data: T; etag?: string; notModified: boolean }> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (init.etag) headers.set("If-None-Match", init.etag);
  const res = await fetch(path, { ...init, headers, credentials: "include" });
  if (res.status === 304) return { data: undefined as T, etag: res.headers.get("ETag") ?? init.etag, notModified: true };
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.code ?? "ERROR", json?.error?.message ?? "Error de servidor", json);
  }
  return { data: json as T, etag: res.headers.get("ETag") ?? undefined, notModified: false };
}

export const api = {
  publicConfig: () => request<PublicConfig>("/api/config/public"),
  publicQueue: (etag?: string) => request<PublicQueue>("/api/queue/public", { etag }),
  createTicket: (body: { name: string; phone: string; whatsappConsent: boolean; privacyAccepted: true }) =>
    request<TicketCreated & { existing?: boolean; recovered?: boolean; message?: string }>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  recoverTicket: (phone: string) =>
    request<TicketCreated & { existing: boolean; recovered: boolean }>("/api/tickets/recover", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
  track: (token: string, etag?: string) => request<TrackingView>(`/api/tickets/track/${token}`, { etag }),
  login: (username: string, password: string) =>
    request<{ user: SessionUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: SessionUser }>("/api/auth/me"),
  adminTickets: (filter: string, etag?: string) =>
    request<{ tickets: AdminTicket[]; kpis: AdminKpis }>(`/api/admin/tickets?filter=${filter}`, { etag }),
  queues: () => request<{ queues: Array<{ id: string; name: string; isOpen: boolean; openedAt: number; closedAt: number | null; ticketCount: number }> }>("/api/admin/queues"),
  queueTickets: (queueId: string) =>
    request<{ queue: { id: string; name: string; isOpen: boolean; openedAt: number; closedAt: number | null }; tickets: AdminTicket[] }>(
      `/api/admin/queues/${encodeURIComponent(queueId)}/tickets`,
    ),
  createManual: (name: string, phone: string) =>
    request<TicketCreated>("/api/admin/tickets", { method: "POST", body: JSON.stringify({ name, phone }) }),
  callNext: () => request<{ empty: boolean; message?: string; ticket?: AdminTicket }>("/api/admin/queue/next", { method: "POST" }),
  newQueue: () => request<{ ok: boolean; queueId: string }>("/api/admin/queue/new", { method: "POST" }),
  repeat: () => request<{ ticket: AdminTicket }>("/api/admin/queue/repeat", { method: "POST" }),
  complete: (id: string) => request(`/api/admin/tickets/${id}/complete`, { method: "POST" }),
  serve: (id: string) => request(`/api/admin/tickets/${id}/serve`, { method: "POST" }),
  absent: (id: string) => request(`/api/admin/tickets/${id}/absent`, { method: "POST" }),
  cancel: (id: string) => request(`/api/admin/tickets/${id}/cancel`, { method: "POST" }),
  pause: () => request("/api/admin/queue/pause", { method: "POST" }),
  resume: () => request("/api/admin/queue/resume", { method: "POST" }),
  settings: () => request<{ settings: Record<string, string | number>; whatsapp: Record<string, boolean> }>("/api/admin/settings"),
  saveSettings: (body: Record<string, unknown>) =>
    request("/api/admin/settings", { method: "PATCH", body: JSON.stringify(body) }),
};

export function formatWhen(unix: number): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(unix * 1000));
}
