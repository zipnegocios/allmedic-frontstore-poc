import { pgTable, text, timestamp, jsonb, index, uuid as pgUuid } from "drizzle-orm/pg-core";
import { uuid } from "@/lib/uuid";

// ─── Conversations (Unified Inbox) ───
export const conversations = pgTable("conversations", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  channel: text("channel").notNull(), // 'whatsapp' | 'instagram'
  externalId: text("external_id").notNull(), // WA chat ID or IG thread ID
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerIgHandle: text("customer_ig_handle"),
  status: text("status").notNull().default("OPEN"), // 'OPEN' | 'CLOSED' | 'PENDING'
  assignedTo: text("assigned_to"), // user ID
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_conversations_channel_external").on(table.channel, table.externalId),
  index("idx_conversations_status").on(table.status),
  index("idx_conversations_assigned").on(table.assignedTo),
]);

// ─── Messages ───
export const messages = pgTable("messages", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  conversationId: pgUuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'whatsapp' | 'instagram' | 'manual'
  direction: text("direction").notNull(), // 'inbound' | 'outbound'
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  metadata: jsonb("metadata"), // message type, reactions, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_messages_conversation").on(table.conversationId),
  index("idx_messages_created_at").on(table.createdAt),
]);
