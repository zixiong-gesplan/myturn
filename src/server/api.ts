import { z } from "zod";
import { isWhatsAppSendingAllowed, whatsappSkipReason } from "../shared/whatsapp-policy";
import { countPeopleAheadFromWaitingNumbers } from "../shared/people-ahead";
import { normalizePhone, maskPhone } from "../shared/phone";
import { formatTicketNumber } from "../shared/ticket-number";
import { statusLabel, statusMessage, type TicketStatus } from "../shared/status";
import { verifyPassword } from "../shared/password";
import { hmacSha256Hex, sha256Hex } from "../shared/crypto";
import { getAppSettings, getClientForTransaction } from "./db/client";

const SESSION_COOKIE = "mt_session";
const TRACK_COOKIE = "mt_track";
const SESSION_SECONDS = 12 * 60 * 60;

type User = { id: string; username: string };
type SqlRow = Record<string, string | number | null>;

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  return Response.json(data, { status, headers: responseHeaders });
}

function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

function row<T extends SqlRow>(value: unknown): T | null {
  return value ? (value as T) : null;
}

function rows<T extends SqlRow>(values: unknown[]): T[] {
  return values as T[];
}

function cookieValue(request: Request, key: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === key) return decodeURIComponent(value.join("="));
  }
  return null;
}

function cookieHeader(name: string, value: string, request: Request, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

function clearCookie(name: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    throw new HttpError(403, "CSRF_REJECTED", "Origen de solicitud no válido");
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError(403, "CSRF_REJECTED", "Origen de solicitud no válido");
  }
}

async function bodyJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "INVALID_INPUT", "El cuerpo de la solicitud no es válido");
  }
}

async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const result = await getClientForTransaction().execute({
    sql: `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
          ON CONFLICT(key) DO UPDATE SET
            count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END,
            window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END
          RETURNING count`,
    args: [key, now, now - windowSeconds, now - windowSeconds],
  });
  return Number(result.rows[0]?.count ?? 0) <= limit;
}

function clientIp(request: Request): string {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function authenticate(request: Request): Promise<User> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Debes iniciar sesión");
  const tokenHash = await sha256Hex(token);
  const result = await getClientForTransaction().execute({
    sql: `SELECT u.id, u.username, u.active, s.expires_at
          FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ?`,
    args: [tokenHash],
  });
  const session = row<{ id: string; username: string; active: number; expires_at: number }>(
    result.rows[0],
  );
  if (!session || session.active !== 1 || session.expires_at < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "UNAUTHENTICATED", "Sesión no válida o caducada");
  }
  return { id: session.id, username: session.username };
}

async function settingsMap(): Promise<Record<string, string>> {
  return getAppSettings();
}

function waConfig() {
  return {
    enabled: process.env.WHATSAPP_ENABLED === "true",
    paidMessagesAllowed: process.env.WHATSAPP_PAID_MESSAGES_ALLOWED === "true",
    accessTokenConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    phoneNumberIdConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || "turno_confirmado",
  };
}

async function currentQueue() {
  const result = await getClientForTransaction().execute(
    "SELECT * FROM queues WHERE is_open = 1 LIMIT 1",
  );
  return row<{
    id: string;
    name: string;
    last_number: number;
    is_open: number;
    is_paused: number;
    current_ticket_id: string | null;
    opened_at: number;
  }>(result.rows[0]);
}

async function queueSnapshot() {
  const queue = await currentQueue();
  if (!queue) {
    return {
      currentDisplayNumber: null,
      nextDisplayNumber: null,
      isPaused: false,
      updatedAt: 0,
    };
  }
  const result = await getClientForTransaction().execute({
    sql: `SELECT
            current.display_number AS current_display,
            current.status AS current_status,
            next.display_number AS next_display
          FROM queues q
          LEFT JOIN tickets current ON current.id = q.current_ticket_id
          LEFT JOIN tickets next ON next.id = (
            SELECT id FROM tickets
            WHERE queue_id = q.id AND status = 'waiting'
            ORDER BY number ASC LIMIT 1
          )
          WHERE q.id = ?`,
    args: [queue.id],
  });
  const snapshot = row<{
    current_display: string | null;
    current_status: TicketStatus | null;
    next_display: string | null;
  }>(result.rows[0]);
  const currentIsVisible = snapshot?.current_status === "called" || snapshot?.current_status === "in_service";
  return {
    currentDisplayNumber: currentIsVisible ? snapshot?.current_display ?? null : null,
    nextDisplayNumber: snapshot?.next_display ?? null,
    isPaused: queue.is_paused === 1,
    updatedAt: queue.opened_at,
  };
}

async function ticketTracking(token: string) {
  const tokenHash = await sha256Hex(token);
  const result = await getClientForTransaction().execute({
    sql: `SELECT t.id, t.queue_id, t.number, t.display_number, t.status, t.created_at, t.called_at,
                 tok.expires_at, current.display_number AS current_display
          FROM tracking_tokens tok
          JOIN tickets t ON t.id = tok.ticket_id
          LEFT JOIN queues q ON q.id = t.queue_id
          LEFT JOIN tickets current ON current.id = q.current_ticket_id
          WHERE tok.token_hash = ?`,
    args: [tokenHash],
  });
  const ticket = row<{
    id: string;
    queue_id: string;
    number: number;
    display_number: string;
    status: TicketStatus;
    created_at: number;
    called_at: number | null;
    expires_at: number;
    current_display: string | null;
  }>(result.rows[0]);
  if (!ticket || ticket.expires_at < Math.floor(Date.now() / 1000)) return null;
  let ahead = 0;
  if (ticket.status === "waiting") {
    const waiting = await getClientForTransaction().execute({
      sql: "SELECT number FROM tickets WHERE queue_id = ? AND status = 'waiting' AND number < ?",
      args: [ticket.queue_id, ticket.number],
    });
    ahead = countPeopleAheadFromWaitingNumbers(
      ticket.number,
      ticket.status,
      rows<{ number: number }>(waiting.rows).map((item) => item.number),
    );
  }
  return {
    displayNumber: ticket.display_number || formatTicketNumber(ticket.number),
    status: ticket.status,
    statusLabel: statusLabel(ticket.status),
    statusMessage: statusMessage(ticket.status),
    currentDisplayNumber: ticket.current_display,
    peopleAhead: ahead,
    createdAt: ticket.created_at,
    calledAt: ticket.called_at,
  };
}

async function createTicket(input: {
  name: string;
  phone: string;
  whatsappConsent: boolean;
  source: "web" | "manual";
  operatorId?: string;
  request: Request;
}) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new HttpError(400, "INVALID_NAME", "Indica un nombre válido.");
  const phone = normalizePhone(input.phone);
  if (!phone) throw new HttpError(400, "INVALID_PHONE", "El teléfono no es válido. Usa un prefijo internacional, por ejemplo +34.");
  const pepper = process.env.PHONE_PEPPER;
  if (!pepper || pepper.length < 16) throw new HttpError(500, "SERVER_MISCONFIGURED", "El servicio no está configurado correctamente.");
  const phoneHash = await hmacSha256Hex(pepper, phone);
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const trackingToken = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const tokenHash = await sha256Hex(trackingToken);
  const settings = await settingsMap();
  const privacyVersion = settings.privacy_policy_version || "1.0";
  const configuredRetention = Number(settings.retention_days || 7);
  const retention = Number.isFinite(configuredRetention)
    ? Math.min(30, Math.max(1, configuredRetention))
    : 7;
  const queue = await currentQueue();
  if (!queue) throw new HttpError(409, "QUEUE_CLOSED", "No hay una cola abierta en este momento.");
  const client = getClientForTransaction();
  const tx = await client.transaction("write");
  let ticketNumber: number;
  try {
    const active = await tx.execute({
      sql: `SELECT id FROM tickets WHERE queue_id = ? AND phone_lookup_hash = ?
            AND status IN ('waiting', 'called', 'in_service') AND personal_data_cleared = 0 LIMIT 1`,
      args: [queue.id, phoneHash],
    });
    if (active.rows.length) throw new HttpError(409, "ACTIVE_TICKET_EXISTS", "Ya existe un turno activo para este teléfono.");
    const counter = await tx.execute({
      sql: "UPDATE queues SET last_number = last_number + 1 WHERE id = ? AND is_open = 1 RETURNING last_number",
      args: [queue.id],
    });
    if (!counter.rows[0]) throw new HttpError(409, "QUEUE_CLOSED", "La cola ya no está abierta.");
    ticketNumber = Number(counter.rows[0].last_number);
    const displayNumber = formatTicketNumber(ticketNumber);
    await tx.execute({
      sql: `INSERT INTO tickets
            (id, queue_id, number, display_number, name, phone_normalized, phone_lookup_hash, status, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?)`,
      args: [id, queue.id, ticketNumber, displayNumber, name, phone, phoneHash, input.source, now, now],
    });
    await tx.execute({
      sql: "INSERT INTO tracking_tokens (id, ticket_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), id, tokenHash, now + retention * 86400, now],
    });
    await tx.execute({
      sql: `INSERT INTO consents (id, ticket_id, channel, consent_given, privacy_policy_version, consent_timestamp)
            VALUES (?, ?, 'whatsapp', ?, ?, ?)`,
      args: [crypto.randomUUID(), id, input.whatsappConsent ? 1 : 0, privacyVersion, now],
    });
    await tx.execute({
      sql: `INSERT INTO ticket_events (id, queue_id, ticket_id, operator_id, event_type, created_at, metadata)
            VALUES (?, ?, ?, ?, 'created', ?, ?)`,
      args: [crypto.randomUUID(), queue.id, id, input.operatorId ?? null, now, JSON.stringify({ source: input.source })],
    });
    await tx.commit();
  } catch (cause) {
    await tx.rollback();
    if (cause instanceof HttpError) throw cause;
    throw cause;
  }
  const current = await queueSnapshot();
  const ahead = ticketNumber > 1
    ? await getClientForTransaction().execute({
        sql: "SELECT COUNT(*) AS count FROM tickets WHERE queue_id = ? AND status = 'waiting' AND number < ?",
        args: [queue.id, ticketNumber],
      })
    : null;
  const origin = process.env.APP_BASE_URL || new URL(input.request.url).origin;
  const trackingPath = `/seguimiento/${trackingToken}`;
  const whatsappQueued = input.whatsappConsent
    ? await sendWhatsApp(id, name, formatTicketNumber(ticketNumber), phone, `${origin}${trackingPath}`)
    : false;
  return {
    id,
    displayNumber: formatTicketNumber(ticketNumber),
    trackingToken,
    trackingPath,
    currentDisplayNumber: current.currentDisplayNumber,
    peopleAhead: Number(ahead?.rows[0]?.count ?? 0),
    whatsappQueued,
  };
}

async function sendWhatsApp(
  ticketId: string,
  name: string,
  displayNumber: string,
  phone: string,
  trackingUrl: string,
  event: "created" | "called" = "created",
): Promise<boolean> {
  const config = {
    ...waConfig(),
    templateName: event === "called"
      ? process.env.WHATSAPP_CALLED_TEMPLATE_NAME || "turno_llamado"
      : waConfig().templateName,
  };
  const allowed = isWhatsAppSendingAllowed(config);
  const client = getClientForTransaction();
  const now = Math.floor(Date.now() / 1000);
  if (!allowed) {
    await client.execute({
      sql: `INSERT INTO notification_attempts (id, ticket_id, channel, status, attempted_at, error_code)
            VALUES (?, ?, 'whatsapp', 'skipped', ?, ?)`,
      args: [crypto.randomUUID(), ticketId, now, whatsappSkipReason(config)],
    });
    return false;
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone.replace(/^\+/, ""),
          type: "template",
          template: {
            name: config.templateName,
            language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "es" },
            components: [{
              type: "body",
              parameters: event === "called"
                ? [
                    { type: "text", text: name.slice(0, 60) },
                    { type: "text", text: displayNumber },
                  ]
                : [
                    { type: "text", text: name.slice(0, 60) },
                    { type: "text", text: displayNumber },
                    { type: "text", text: trackingUrl },
                  ],
            }],
          },
        }),
      },
    );
    const payload = (await response.json()) as { messages?: Array<{ id?: string }>; error?: { code?: number } };
    const sent = response.ok;
    await client.execute({
      sql: `INSERT INTO notification_attempts
            (id, ticket_id, channel, status, provider_message_id, attempted_at, error_code)
            VALUES (?, ?, 'whatsapp', ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        ticketId,
        sent ? "accepted" : "failed",
        payload.messages?.[0]?.id ?? null,
        now,
        sent ? null : String(payload.error?.code ?? response.status),
      ],
    });
    return sent;
  } catch {
    await client.execute({
      sql: `INSERT INTO notification_attempts (id, ticket_id, channel, status, attempted_at, error_code)
            VALUES (?, ?, 'whatsapp', 'failed', ?, 'network')`,
      args: [crypto.randomUUID(), ticketId, now],
    });
    return false;
  }
}

async function createQueue(operator: User) {
  const client = getClientForTransaction();
  const tx = await client.transaction("write");
  const now = Math.floor(Date.now() / 1000);
  const queueId = crypto.randomUUID();
  try {
    const open = await tx.execute("SELECT id FROM queues WHERE is_open = 1 LIMIT 1");
    const oldQueueId = open.rows[0]?.id ? String(open.rows[0].id) : null;
    if (oldQueueId) {
      const active = await tx.execute({
        sql: `SELECT id FROM tickets WHERE queue_id = ? AND status IN ('waiting', 'called', 'in_service')`,
        args: [oldQueueId],
      });
      for (const ticket of rows<{ id: string }>(active.rows)) {
        await tx.execute({
          sql: "UPDATE tickets SET status = 'cancelled', completed_at = ?, updated_at = ? WHERE id = ?",
          args: [now, now, ticket.id],
        });
        await tx.execute({
          sql: `INSERT INTO ticket_events (id, queue_id, ticket_id, operator_id, event_type, created_at, metadata)
                VALUES (?, ?, ?, ?, 'cancelled', ?, '{"reason":"queue_closed"}')`,
          args: [crypto.randomUUID(), oldQueueId, ticket.id, operator.id, now],
        });
      }
      await tx.execute({
        sql: "UPDATE queues SET is_open = 0, is_paused = 0, current_ticket_id = NULL, closed_at = ? WHERE id = ?",
        args: [now, oldQueueId],
      });
      await tx.execute({
        sql: `INSERT INTO ticket_events (id, queue_id, operator_id, event_type, created_at, metadata)
              VALUES (?, ?, ?, 'queue_closed', ?, NULL)`,
        args: [crypto.randomUUID(), oldQueueId, operator.id, now],
      });
    }
    const businessDate = new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeZone: process.env.BUSINESS_TIME_ZONE || "Europe/Madrid",
    }).format(new Date(now * 1000));
    await tx.execute({
      sql: `INSERT INTO queues (id, name, last_number, is_open, is_paused, opened_at, created_by)
            VALUES (?, ?, 0, 1, 0, ?, ?)`,
      args: [queueId, `Cola ${businessDate}`, now, operator.id],
    });
    await tx.execute({
      sql: `INSERT INTO ticket_events (id, queue_id, operator_id, event_type, created_at, metadata)
            VALUES (?, ?, ?, 'queue_opened', ?, NULL)`,
      args: [crypto.randomUUID(), queueId, operator.id, now],
    });
    await tx.commit();
  } catch (cause) {
    await tx.rollback();
    throw cause;
  }
  return { ok: true, queueId };
}

async function adminTickets(filter: "active" | "today" | "all") {
  const queue = await currentQueue();
  if (!queue) {
    return {
      tickets: [],
      kpis: { currentDisplayNumber: null, pendingCount: 0, completedToday: 0, absentCount: 0, cancelledCount: 0, isPaused: false },
    };
  }
  const clause = filter === "active"
    ? "AND status IN ('waiting', 'called', 'in_service')"
    : filter === "today"
      ? ""
      : "";
  const result = await getClientForTransaction().execute({
    sql: `SELECT id, number, display_number, name, phone_normalized, created_at, status, source
          FROM tickets WHERE queue_id = ? ${clause} ORDER BY number DESC LIMIT 200`,
    args: [queue.id],
  });
  const current = await queueSnapshot();
  const counts = await getClientForTransaction().execute({
    sql: `SELECT
            SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
          FROM tickets WHERE queue_id = ?`,
    args: [queue.id],
  });
  const kpi = row<{ pending: number | null; completed: number | null; absent: number | null; cancelled: number | null }>(counts.rows[0]);
  return {
    tickets: rows<{
      id: string;
      number: number;
      display_number: string;
      name: string | null;
      phone_normalized: string | null;
      created_at: number;
      status: TicketStatus;
      source: "web" | "manual";
    }>(result.rows).map((ticket) => ({
      id: ticket.id,
      displayNumber: ticket.display_number || formatTicketNumber(ticket.number),
      name: ticket.name || "(anonimizado)",
      phoneMasked: maskPhone(ticket.phone_normalized),
      createdAt: ticket.created_at,
      status: ticket.status,
      source: ticket.source,
    })),
    kpis: {
      currentDisplayNumber: current.currentDisplayNumber,
      pendingCount: Number(kpi?.pending ?? 0),
      completedToday: Number(kpi?.completed ?? 0),
      absentCount: Number(kpi?.absent ?? 0),
      cancelledCount: Number(kpi?.cancelled ?? 0),
      isPaused: queue.is_paused === 1,
    },
  };
}

async function callNext(operator: User, request: Request) {
  const tx = await getClientForTransaction().transaction("write");
  const now = Math.floor(Date.now() / 1000);
  try {
    const queueResult = await tx.execute("SELECT id, is_paused FROM queues WHERE is_open = 1 LIMIT 1");
    const queue = row<{ id: string; is_paused: number }>(queueResult.rows[0]);
    if (!queue) throw new HttpError(409, "QUEUE_CLOSED", "No hay una cola abierta.");
    if (queue.is_paused) throw new HttpError(409, "QUEUE_PAUSED", "La cola está en pausa. Reanúdala para llamar al siguiente turno.");
    const selected = await tx.execute({
      sql: "SELECT id, display_number, name, phone_normalized FROM tickets WHERE queue_id = ? AND status = 'waiting' ORDER BY number ASC LIMIT 1",
      args: [queue.id],
    });
    const ticket = row<{ id: string; display_number: string; name: string | null; phone_normalized: string | null }>(selected.rows[0]);
    if (!ticket) {
      await tx.commit();
      return null;
    }
    const update = await tx.execute({
      sql: "UPDATE tickets SET status = 'called', called_at = ?, updated_at = ? WHERE id = ? AND status = 'waiting' RETURNING id",
      args: [now, now, ticket.id],
    });
    if (!update.rows.length) throw new HttpError(409, "CALL_CONFLICT", "El turno cambió; actualiza el panel e inténtalo de nuevo.");
    await tx.execute({
      sql: "UPDATE queues SET current_ticket_id = ? WHERE id = ?",
      args: [ticket.id, queue.id],
    });
    await tx.execute({
      sql: `INSERT INTO ticket_events (id, queue_id, ticket_id, operator_id, event_type, created_at)
            VALUES (?, ?, ?, ?, 'called', ?)`,
      args: [crypto.randomUUID(), queue.id, ticket.id, operator.id, now],
    });
    await tx.commit();
    if (ticket.phone_normalized) {
      const consent = await getClientForTransaction().execute({
        sql: "SELECT consent_given FROM consents WHERE ticket_id = ? AND channel = 'whatsapp' ORDER BY consent_timestamp DESC LIMIT 1",
        args: [ticket.id],
      });
      if (Number(consent.rows[0]?.consent_given) === 1) {
        const origin = process.env.APP_BASE_URL || new URL(request.url).origin;
        await sendWhatsApp(ticket.id, ticket.name || "Cliente", ticket.display_number, ticket.phone_normalized, origin, "called");
      }
    }
    return { id: ticket.id, displayNumber: ticket.display_number };
  } catch (cause) {
    await tx.rollback();
    throw cause;
  }
}

async function mutateStatus(ticketId: string, operator: User, next: "in_service" | "completed" | "absent" | "cancelled") {
  const tx = await getClientForTransaction().transaction("write");
  const now = Math.floor(Date.now() / 1000);
  const allowed: Record<string, TicketStatus[]> = {
    in_service: ["called"],
    completed: ["called", "in_service"],
    absent: ["waiting", "called", "in_service"],
    cancelled: ["waiting", "called", "in_service"],
  };
  try {
    const result = await tx.execute({
      sql: "SELECT id, queue_id, status FROM tickets WHERE id = ?",
      args: [ticketId],
    });
    const ticket = row<{ id: string; queue_id: string; status: TicketStatus }>(result.rows[0]);
    if (!ticket) throw new HttpError(404, "NOT_FOUND", "Turno no encontrado");
    if (!allowed[next].includes(ticket.status)) {
      if (ticket.status === next) {
        await tx.commit();
        return { id: ticketId, status: next };
      }
      throw new HttpError(409, "INVALID_TRANSITION", "No se puede realizar ese cambio de estado.");
    }
    await tx.execute({
      sql: `UPDATE tickets SET status = ?, updated_at = ?,
              completed_at = CASE WHEN ? IN ('completed', 'absent', 'cancelled') THEN ? ELSE completed_at END
            WHERE id = ?`,
      args: [next, now, next, now, ticketId],
    });
    await tx.execute({
      sql: `INSERT INTO ticket_events (id, queue_id, ticket_id, operator_id, event_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), ticket.queue_id, ticketId, operator.id, next, now],
    });
    if (["completed", "absent", "cancelled"].includes(next)) {
      await tx.execute({
        sql: "UPDATE queues SET current_ticket_id = NULL WHERE id = ? AND current_ticket_id = ?",
        args: [ticket.queue_id, ticketId],
      });
    }
    await tx.commit();
    return { id: ticketId, status: next };
  } catch (cause) {
    await tx.rollback();
    throw cause;
  }
}

async function setQueuePaused(operator: User, paused: boolean) {
  const queue = await currentQueue();
  if (!queue) throw new HttpError(409, "QUEUE_CLOSED", "No hay una cola abierta.");
  const now = Math.floor(Date.now() / 1000);
  await getClientForTransaction().batch([
    {
      sql: "UPDATE queues SET is_paused = ? WHERE id = ?",
      args: [paused ? 1 : 0, queue.id],
    },
    {
      sql: "INSERT INTO ticket_events (id, queue_id, operator_id, event_type, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), queue.id, operator.id, paused ? "queue_paused" : "queue_resumed", now],
    },
  ], "write");
}

async function repeatCall(operator: User) {
  const queue = await currentQueue();
  if (!queue?.current_ticket_id) throw new HttpError(409, "NO_CURRENT", "No hay un turno llamado para repetir");
  const now = Math.floor(Date.now() / 1000);
  const result = await getClientForTransaction().execute({
    sql: `SELECT id, display_number, status FROM tickets
          WHERE id = ? AND status IN ('called', 'in_service')`,
    args: [queue.current_ticket_id],
  });
  const ticket = row<{ id: string; display_number: string; status: TicketStatus }>(result.rows[0]);
  if (!ticket) throw new HttpError(409, "NO_CURRENT", "No hay un turno llamado para repetir");
  await getClientForTransaction().batch([
    { sql: "UPDATE tickets SET called_at = ?, updated_at = ? WHERE id = ?", args: [now, now, ticket.id] },
    {
      sql: "INSERT INTO ticket_events (id, queue_id, ticket_id, operator_id, event_type, created_at) VALUES (?, ?, ?, ?, 'repeat_call', ?)",
      args: [crypto.randomUUID(), queue.id, ticket.id, operator.id, now],
    },
  ], "write");
  return ticket;
}

function addEtag(request: Request, data: unknown): Response {
  const digest = JSON.stringify(data);
  const etag = `"${Buffer.from(digest).toString("base64url")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-store" } });
  }
  return json(data, 200, { ETag: etag });
}

const loginSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(1).max(200),
});
const createTicketSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(20),
  whatsappConsent: z.boolean().optional().default(false),
  privacyAccepted: z.literal(true),
});

export async function handleApi(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    const method = request.method.toUpperCase();
    const client = getClientForTransaction();

    if (["POST", "PATCH", "DELETE"].includes(method)) assertSameOrigin(request);

    if (method === "GET" && path.join("/") === "config/public") {
      const settings = await settingsMap();
      const wa = waConfig();
      return addEtag(request, {
        establishmentName: settings.establishment_name || "MiTurno",
        whatsappChannelAvailable: isWhatsAppSendingAllowed(wa),
        defaultCountry: "ES",
        privacyPolicyVersion: settings.privacy_policy_version || "1.0",
        dataControllerConfigured: Boolean(settings.data_controller_name && settings.contact_email),
        dataControllerName: settings.data_controller_name || "",
        contactEmail: settings.contact_email || "",
        contactPostalAddress: settings.contact_postal_address || "",
      });
    }
    if (method === "GET" && path.join("/") === "queue/public") {
      return addEtag(request, await queueSnapshot());
    }
    if (method === "GET" && path.join("/") === "cron/anonymize") {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
        throw new HttpError(401, "UNAUTHENTICATED", "Credenciales de tarea no válidas.");
      }
      const settings = await settingsMap();
      const configuredRetention = Number(settings.retention_days || 7);
      const retention = Number.isFinite(configuredRetention)
        ? Math.min(30, Math.max(1, configuredRetention))
        : 7;
      const cutoff = Math.floor(Date.now() / 1000) - retention * 86400;
      const expired = await client.execute({
        sql: `SELECT id FROM tickets WHERE personal_data_cleared = 0
              AND status IN ('completed', 'absent', 'cancelled')
              AND completed_at IS NOT NULL AND completed_at < ?`,
        args: [cutoff],
      });
      const tx = await client.transaction("write");
      try {
        for (const ticket of rows<{ id: string }>(expired.rows)) {
          await tx.execute({
            sql: `UPDATE tickets SET name = NULL, phone_normalized = NULL, phone_lookup_hash = NULL,
                    personal_data_cleared = 1, updated_at = ?
                  WHERE id = ? AND personal_data_cleared = 0`,
            args: [Math.floor(Date.now() / 1000), ticket.id],
          });
          await tx.execute({ sql: "DELETE FROM tracking_tokens WHERE ticket_id = ?", args: [ticket.id] });
          await tx.execute({ sql: "DELETE FROM consents WHERE ticket_id = ?", args: [ticket.id] });
          await tx.execute({
            sql: "UPDATE notification_attempts SET provider_message_id = NULL WHERE ticket_id = ?",
            args: [ticket.id],
          });
        }
        await tx.commit();
      } catch (cause) {
        await tx.rollback();
        throw cause;
      }
      return json({ anonymized: expired.rows.length });
    }
    if (method === "GET" && path[0] === "tickets" && path[1] === "track" && path[2]) {
      const tracking = await ticketTracking(path[2]);
      return tracking ? addEtag(request, tracking) : error(404, "NOT_FOUND", "El enlace de seguimiento no es válido o ha caducado");
    }
    if (method === "POST" && path.join("/") === "tickets") {
      const ipLimit = await rateLimit(`ticket:ip:${clientIp(request)}`, 20, 3600);
      if (!ipLimit) throw new HttpError(429, "RATE_LIMITED", "Has realizado demasiadas solicitudes. Inténtalo más tarde.");
      const payload = createTicketSchema.parse(await bodyJson(request));
      const normalizedPhone = normalizePhone(payload.phone);
      const pepper = process.env.PHONE_PEPPER;
      if (!normalizedPhone) throw new HttpError(400, "INVALID_PHONE", "El teléfono no es válido.");
      if (!pepper || pepper.length < 16) throw new HttpError(500, "SERVER_MISCONFIGURED", "El servicio no está configurado correctamente.");
      const phoneLimitHash = await hmacSha256Hex(pepper, normalizedPhone);
      const phoneLimit = await rateLimit(`ticket:phone:${phoneLimitHash}`, 5, 3600);
      if (!phoneLimit) throw new HttpError(429, "RATE_LIMITED", "Has realizado demasiadas solicitudes. Inténtalo más tarde.");
      const created = await createTicket({ ...payload, source: "web", request });
      return json(created, 201, {
        "Set-Cookie": cookieHeader(TRACK_COOKIE, created.trackingToken, request, 7 * 86400),
      });
    }
    if (method === "POST" && path.join("/") === "tickets/recover") {
      const payload = z.object({ phone: z.string().min(6).max(20) }).parse(await bodyJson(request));
      const trackingToken = cookieValue(request, TRACK_COOKIE);
      if (!trackingToken) throw new HttpError(403, "RECOVERY_DENIED", "No hay un enlace privado en este dispositivo. Usa el enlace original o pide ayuda al personal.");
      const phone = normalizePhone(payload.phone);
      const pepper = process.env.PHONE_PEPPER;
      if (!phone || !pepper || pepper.length < 16) throw new HttpError(403, "RECOVERY_DENIED", "No se puede mostrar el turno desde este dispositivo.");
      const tokenHash = await sha256Hex(trackingToken);
      const phoneHash = await hmacSha256Hex(pepper, phone);
      const result = await client.execute({
        sql: `SELECT t.id, t.display_number FROM tracking_tokens tok
              JOIN tickets t ON t.id = tok.ticket_id
              WHERE tok.token_hash = ? AND tok.expires_at >= ? AND t.phone_lookup_hash = ?`,
        args: [tokenHash, Math.floor(Date.now() / 1000), phoneHash],
      });
      const ticket = row<{ id: string; display_number: string }>(result.rows[0]);
      if (!ticket) throw new HttpError(403, "RECOVERY_DENIED", "No se puede mostrar el turno desde este dispositivo.");
      const tracking = await ticketTracking(trackingToken);
      if (!tracking) throw new HttpError(403, "RECOVERY_DENIED", "El enlace privado ha caducado.");
      return json({
        displayNumber: ticket.display_number,
        trackingToken,
        trackingPath: `/seguimiento/${trackingToken}`,
        currentDisplayNumber: tracking.currentDisplayNumber,
        peopleAhead: tracking.peopleAhead,
        whatsappQueued: false,
      });
    }
    if (method === "POST" && path.join("/") === "auth/login") {
      if (!(await rateLimit(`login:${clientIp(request)}`, 8, 900))) {
        throw new HttpError(429, "RATE_LIMITED", "Demasiados intentos de acceso. Espera unos minutos.");
      }
      const payload = loginSchema.parse(await bodyJson(request));
      const result = await client.execute({
        sql: "SELECT id, username, password_hash, active FROM users WHERE username = ?",
        args: [payload.username.toLowerCase()],
      });
      const user = row<{ id: string; username: string; password_hash: string; active: number }>(result.rows[0]);
      const dummyHash = "pbkdf2$sha256$210000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const valid = await verifyPassword(payload.password, user?.password_hash || dummyHash);
      if (!user || user.active !== 1 || !valid) {
        throw new HttpError(401, "INVALID_CREDENTIALS", "Usuario o contraseña no válidos");
      }
      const token = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const now = Math.floor(Date.now() / 1000);
      await client.batch([
        {
          sql: "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
          args: [crypto.randomUUID(), user.id, await sha256Hex(token), now + SESSION_SECONDS, now],
        },
        { sql: "UPDATE users SET last_login_at = ? WHERE id = ?", args: [now, user.id] },
      ], "write");
      return json(
        { user: { id: user.id, username: user.username, role: "admin" } },
        200,
        { "Set-Cookie": cookieHeader(SESSION_COOKIE, token, request, SESSION_SECONDS) },
      );
    }
    if (method === "POST" && path.join("/") === "auth/logout") {
      const token = cookieValue(request, SESSION_COOKIE);
      if (token) {
        await client.execute({ sql: "DELETE FROM sessions WHERE token_hash = ?", args: [await sha256Hex(token)] });
      }
      return json({ ok: true }, 200, { "Set-Cookie": clearCookie(SESSION_COOKIE, request) });
    }
    if (method === "GET" && path.join("/") === "auth/me") {
      const user = await authenticate(request);
      return json({ user: { ...user, role: "admin" } });
    }

    const isAdminRoute = path[0] === "admin";
    if (!isAdminRoute) return error(404, "NOT_FOUND", "Ruta no encontrada");
    const user = await authenticate(request);
    const adminPath = path.slice(1);
    if (method === "GET" && adminPath[0] === "tickets") {
      const filter = url.searchParams.get("filter");
      const data = await adminTickets(filter === "today" || filter === "all" ? filter : "active");
      return addEtag(request, data);
    }
    if (method === "GET" && adminPath.join("/") === "queues") {
      const history = await client.execute(
        `SELECT q.id, q.name, q.is_open, q.opened_at, q.closed_at,
                COUNT(t.id) AS ticket_count
         FROM queues q LEFT JOIN tickets t ON t.queue_id = q.id
         GROUP BY q.id ORDER BY q.opened_at DESC LIMIT 50`,
      );
      return json({
        queues: rows<{
          id: string;
          name: string;
          is_open: number;
          opened_at: number;
          closed_at: number | null;
          ticket_count: number;
        }>(history.rows).map((queue) => ({
          id: queue.id,
          name: queue.name,
          isOpen: queue.is_open === 1,
          openedAt: queue.opened_at,
          closedAt: queue.closed_at,
          ticketCount: Number(queue.ticket_count),
        })),
      });
    }
    if (method === "GET" && adminPath[0] === "queues" && adminPath[1] && adminPath[2] === "tickets") {
      const queueResult = await client.execute({
        sql: "SELECT id, name, is_open, opened_at, closed_at FROM queues WHERE id = ?",
        args: [adminPath[1]],
      });
      const archivedQueue = row<{
        id: string;
        name: string;
        is_open: number;
        opened_at: number;
        closed_at: number | null;
      }>(queueResult.rows[0]);
      if (!archivedQueue) throw new HttpError(404, "NOT_FOUND", "Cola no encontrada");
      const ticketResult = await client.execute({
        sql: `SELECT id, number, display_number, name, phone_normalized, created_at, status, source
              FROM tickets WHERE queue_id = ? ORDER BY number DESC LIMIT 500`,
        args: [archivedQueue.id],
      });
      return json({
        queue: {
          id: archivedQueue.id,
          name: archivedQueue.name,
          isOpen: archivedQueue.is_open === 1,
          openedAt: archivedQueue.opened_at,
          closedAt: archivedQueue.closed_at,
        },
        tickets: rows<{
          id: string;
          number: number;
          display_number: string;
          name: string | null;
          phone_normalized: string | null;
          created_at: number;
          status: TicketStatus;
          source: "web" | "manual";
        }>(ticketResult.rows).map((ticket) => ({
          id: ticket.id,
          displayNumber: ticket.display_number || formatTicketNumber(ticket.number),
          name: ticket.name || "(anonimizado)",
          phoneMasked: maskPhone(ticket.phone_normalized),
          createdAt: ticket.created_at,
          status: ticket.status,
          source: ticket.source,
        })),
      });
    }
    if (method === "POST" && adminPath.join("/") === "queue/next") {
      const ticket = await callNext(user, request);
      return json(ticket ? { empty: false, ticket } : { empty: true, message: "No hay turnos pendientes" });
    }
    if (method === "POST" && adminPath.join("/") === "queue/repeat") {
      return json({ ticket: await repeatCall(user) });
    }
    if (method === "POST" && adminPath.join("/") === "queue/pause") {
      await setQueuePaused(user, true);
      return json({ ok: true, isPaused: true });
    }
    if (method === "POST" && adminPath.join("/") === "queue/resume") {
      await setQueuePaused(user, false);
      return json({ ok: true, isPaused: false });
    }
    if (method === "POST" && adminPath.join("/") === "queue/new") {
      return json(await createQueue(user), 201);
    }
    if (method === "POST" && adminPath.join("/") === "tickets") {
      const payload = z.object({
        name: z.string().trim().min(2).max(80),
        phone: z.string().trim().min(6).max(20),
      }).parse(await bodyJson(request));
      const created = await createTicket({ ...payload, whatsappConsent: false, source: "manual", operatorId: user.id, request });
      return json(created, 201);
    }
    if (method === "POST" && adminPath[0] === "tickets" && adminPath[1] && adminPath[2]) {
      const action = adminPath[2];
      if (["serve", "complete", "absent", "cancel"].includes(action)) {
        const status = {
          serve: "in_service",
          complete: "completed",
          absent: "absent",
          cancel: "cancelled",
        }[action];
        return json(await mutateStatus(
          adminPath[1],
          user,
          status as "in_service" | "completed" | "absent" | "cancelled",
        ));
      }
    }
    if (method === "GET" && adminPath.join("/") === "settings") {
      const settings = await settingsMap();
      return json({
        settings: {
          establishmentName: settings.establishment_name ?? "",
          publicBaseUrl: settings.public_base_url ?? "",
          contactEmail: settings.contact_email ?? "",
          contactPostalAddress: settings.contact_postal_address ?? "",
          dataControllerName: settings.data_controller_name ?? "",
          privacyPolicyVersion: settings.privacy_policy_version ?? "1.0",
          retentionDays: Number(settings.retention_days ?? "7"),
        },
        whatsapp: {
          enabled: process.env.WHATSAPP_ENABLED === "true",
          paidMessagesAllowed: process.env.WHATSAPP_PAID_MESSAGES_ALLOWED === "true",
          configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
        },
      });
    }
    if (method === "PATCH" && adminPath.join("/") === "settings") {
      const allowedKeys = {
        establishmentName: "establishment_name",
        publicBaseUrl: "public_base_url",
        contactEmail: "contact_email",
        contactPostalAddress: "contact_postal_address",
        dataControllerName: "data_controller_name",
        privacyPolicyVersion: "privacy_policy_version",
        retentionDays: "retention_days",
      } as const;
      const payload = z.object({
        establishmentName: z.string().trim().min(1).max(100).optional(),
        publicBaseUrl: z.string().trim().max(300).optional(),
        contactEmail: z.string().trim().max(254).optional(),
        contactPostalAddress: z.string().trim().max(300).optional(),
        dataControllerName: z.string().trim().max(150).optional(),
        privacyPolicyVersion: z.string().trim().min(1).max(30).optional(),
        retentionDays: z.number().int().min(1).max(30).optional(),
      }).parse(await bodyJson(request));
      const now = Math.floor(Date.now() / 1000);
      const statements = Object.entries(payload).map(([key, value]) => ({
        sql: `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        args: [allowedKeys[key as keyof typeof allowedKeys], String(value), now, user.id],
      }));
      if (statements.length) await client.batch(statements, "write");
      return json({ ok: true });
    }
    return error(404, "NOT_FOUND", "Ruta no encontrada");
  } catch (cause) {
    if (cause instanceof HttpError) return error(cause.status, cause.code, cause.message);
    if (cause instanceof z.ZodError) return error(400, "INVALID_INPUT", "Revisa los datos enviados.");
    if (cause instanceof Error && cause.message.includes("idx_tickets_active_phone")) {
      return error(409, "ACTIVE_TICKET_EXISTS", "Ya existe un turno activo para este teléfono.");
    }
    console.error("API request failed", cause);
    return error(500, "INTERNAL_ERROR", "No se ha podido completar la solicitud.");
  }
}
