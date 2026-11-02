import type { TicketStatus } from "./status.ts";

export type CountableTicket = {
  number: number;
  status: TicketStatus;
};

/**
 * Personas por delante: turnos activos anteriores en la cola FIFO,
 * no una resta entre números (los cancelados/ausentes no cuentan).
 */
export function countPeopleAhead(
  viewer: CountableTicket,
  others: CountableTicket[],
): number {
  if (viewer.status === "called" || viewer.status === "in_service") {
    return 0;
  }
  if (viewer.status !== "waiting") {
    return 0;
  }
  return others.filter(
    (t) => t.status === "waiting" && t.number < viewer.number,
  ).length;
}

export function countPeopleAheadFromWaitingNumbers(
  viewerNumber: number,
  viewerStatus: TicketStatus,
  waitingNumbersAhead: number[],
): number {
  if (viewerStatus !== "waiting") return 0;
  return waitingNumbersAhead.filter((n) => n < viewerNumber).length;
}
