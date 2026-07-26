import { pgTable, text, boolean, timestamp, jsonb, pgEnum, uuid as pgUuid, index } from "drizzle-orm/pg-core";
import { uuid } from "@/lib/uuid";

// ─── Panel de correos (2026-07-25): control por evento + bandeja de salida/entrada ───

// Catálogo de eventos de correo controlables individualmente desde /admin/configuracion.
// Una fila por evento (no singleton) — `enabled` es el interruptor que consulta `sendEmail()`
// antes de disparar cada envío real. Sembrado por `scripts/seed-email-events.ts`.
export const emailEventSettings = pgTable("email_event_settings", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  eventKey: text("event_key").notNull().unique(),
  label: text("label").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const emailStatusEnum = pgEnum("email_status", [
  "SENT", "DELIVERED", "BOUNCED", "COMPLAINED", "OPENED", "CLICKED", "FAILED",
]);

// Historial de envíos reales ("bandeja de salida") — una fila por cada `sendEmail()` exitoso
// con `eventKey` informado. `resendId` es la clave para cruzar con los webhooks entrantes.
export const emailLog = pgTable("email_log", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  eventKey: text("event_key").notNull(),
  resendId: text("resend_id"),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  status: emailStatusEnum("status").notNull().default("SENT"),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
}, (table) => [
  index("idx_email_log_resend_id").on(table.resendId),
  index("idx_email_log_event_key").on(table.eventKey),
]);

// Log crudo de cada webhook recibido de Resend — incluye eventos de salida (delivered,
// bounced, opened, clicked, complained, failed) y el intento de entrada (email.received, si
// Resend Inbound llega a configurarse). Auditoría completa, sin filtrar nada.
export const emailWebhookEvents = pgTable("email_webhook_events", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  resendId: text("resend_id"),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_email_webhook_events_resend_id").on(table.resendId),
]);
