import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    active: integer("active").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    lastLoginAt: integer("last_login_at"),
  },
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("idx_sessions_user").on(table.userId)],
);

export const queues = sqliteTable(
  "queues",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
    isOpen: integer("is_open").notNull().default(1),
    isPaused: integer("is_paused").notNull().default(0),
    currentTicketId: text("current_ticket_id"),
    openedAt: integer("opened_at").notNull(),
    closedAt: integer("closed_at"),
    createdBy: text("created_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("idx_one_open_queue")
      .on(table.isOpen)
      .where(sql`${table.isOpen} = 1`),
    index("idx_queues_opened").on(table.openedAt),
  ],
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    queueId: text("queue_id")
      .notNull()
      .references(() => queues.id),
    number: integer("number").notNull(),
    displayNumber: text("display_number").notNull(),
    name: text("name"),
    email: text("email"),
    emailLookupHash: text("email_lookup_hash"),
    status: text("status", {
      enum: ["waiting", "called", "in_service", "completed", "absent", "cancelled"],
    }).notNull(),
    source: text("source", { enum: ["web", "manual"] }).notNull(),
    createdAt: integer("created_at").notNull(),
    calledAt: integer("called_at"),
    completedAt: integer("completed_at"),
    updatedAt: integer("updated_at").notNull(),
    personalDataCleared: integer("personal_data_cleared").notNull().default(0),
  },
  (table) => [
    uniqueIndex("idx_tickets_queue_number").on(table.queueId, table.number),
    index("idx_tickets_queue_status_number").on(table.queueId, table.status, table.number),
    uniqueIndex("idx_tickets_active_email")
      .on(table.queueId, table.emailLookupHash)
      .where(
        sql`${table.status} IN ('waiting', 'called', 'in_service') AND ${table.emailLookupHash} IS NOT NULL AND ${table.personalDataCleared} = 0`,
      ),
  ],
);

export const ticketEvents = sqliteTable(
  "ticket_events",
  {
    id: text("id").primaryKey(),
    queueId: text("queue_id").references(() => queues.id),
    ticketId: text("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
    operatorId: text("operator_id").references(() => users.id),
    eventType: text("event_type").notNull(),
    createdAt: integer("created_at").notNull(),
    metadata: text("metadata"),
  },
  (table) => [index("idx_ticket_events_ticket").on(table.ticketId, table.createdAt)],
);

export const trackingTokens = sqliteTable(
  "tracking_tokens",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("idx_tracking_expires").on(table.expiresAt)],
);

export const consents = sqliteTable(
  "consents",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    consentGiven: integer("consent_given").notNull(),
    privacyPolicyVersion: text("privacy_policy_version").notNull(),
    consentTimestamp: integer("consent_timestamp").notNull(),
  },
  (table) => [index("idx_consents_ticket").on(table.ticketId)],
);

export const notificationAttempts = sqliteTable(
  "notification_attempts",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    provider: text("provider"),
    eventType: text("event_type").notNull().default("legacy"),
    status: text("status").notNull(),
    providerMessageId: text("provider_message_id"),
    attemptedAt: integer("attempted_at").notNull(),
    errorCode: text("error_code"),
  },
  (table) => [index("idx_notification_ticket").on(table.ticketId, table.attemptedAt)],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
  updatedBy: text("updated_by"),
});

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
});

export const queueRelations = relations(queues, ({ many }) => ({
  tickets: many(tickets),
}));

export const ticketRelations = relations(tickets, ({ one, many }) => ({
  queue: one(queues, { fields: [tickets.queueId], references: [queues.id] }),
  events: many(ticketEvents),
}));
