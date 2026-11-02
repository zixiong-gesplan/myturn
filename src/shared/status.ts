export const TICKET_STATUSES = [
  "waiting",
  "called",
  "in_service",
  "completed",
  "absent",
  "cancelled",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ACTIVE_STATUSES: TicketStatus[] = ["waiting", "called", "in_service"];

export const TERMINAL_STATUSES: TicketStatus[] = ["completed", "absent", "cancelled"];

export function isActiveStatus(status: TicketStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function statusLabel(status: TicketStatus): string {
  switch (status) {
    case "waiting":
      return "En espera";
    case "called":
      return "Llamado";
    case "in_service":
      return "En atención";
    case "completed":
      return "Atendido";
    case "absent":
      return "Ausente";
    case "cancelled":
      return "Cancelado";
  }
}

export function statusMessage(status: TicketStatus): string {
  switch (status) {
    case "waiting":
      return "Tu turno está en cola. Te llamaremos cuando llegue tu número.";
    case "called":
      return "Es tu turno. Acércate al punto de atención.";
    case "in_service":
      return "Te estamos atendiendo ahora.";
    case "completed":
      return "Tu turno ya ha sido atendido.";
    case "absent":
      return "Este turno se marcó como ausente. Si sigues en el establecimiento, pide ayuda al personal.";
    case "cancelled":
      return "Este turno fue cancelado.";
  }
}

export const SENSITIVE_ADMIN_ACTIONS = new Set(["cancel", "absent"]);
