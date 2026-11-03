import type { TicketStatus } from "./status.ts";

export type PublicConfig = {
  establishmentName: string;
  privacyPolicyVersion: string;
  dataControllerConfigured: boolean;
  dataControllerName: string;
  contactEmail: string;
  contactPostalAddress: string;
};

export type PublicQueue = {
  currentDisplayNumber: string | null;
  nextDisplayNumber: string | null;
  isPaused: boolean;
  updatedAt: number;
};

export type TrackingView = {
  displayNumber: string;
  status: TicketStatus;
  statusLabel: string;
  statusMessage: string;
  currentDisplayNumber: string | null;
  peopleAhead: number;
  createdAt: number;
  calledAt: number | null;
};

export type TicketCreated = {
  displayNumber: string;
  trackingToken: string;
  trackingPath: string;
  currentDisplayNumber: string | null;
  peopleAhead: number;
  emailQueued: boolean;
};

export type AdminTicket = {
  id: string;
  displayNumber: string;
  name: string;
  emailMasked: string;
  createdAt: number;
  status: TicketStatus;
  source: "web" | "manual";
};

export type AdminKpis = {
  currentDisplayNumber: string | null;
  pendingCount: number;
  completedToday: number;
  absentCount: number;
  cancelledCount: number;
  isPaused: boolean;
};

export type SessionUser = {
  id: string;
  username: string;
  role: "admin";
};
