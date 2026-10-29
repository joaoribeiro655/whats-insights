import {
  boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** contexto comercial usado no prompt de análise: produto, ticket, script, etapas */
  salesContext: text("sales_context"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sellers = pgTable("sellers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** id da instância no gateway */
  instanceId: text("instance_id").notNull().unique(),
  status: text("status").notNull().default("starting"),
  phone: text("phone"),
  waName: text("wa_name"),
  lastStatusAt: timestamp("last_status_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sellerId: uuid("seller_id").notNull().references(() => sellers.id, { onDelete: "cascade" }),
  phoneJid: text("phone_jid"),
  lidJid: text("lid_jid"),
  phone: text("phone"),
  name: text("name"),
  pushName: text("push_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("contacts_seller_phone_jid").on(t.sellerId, t.phoneJid),
  uniqueIndex("contacts_seller_lid_jid").on(t.sellerId, t.lidJid),
]);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sellerId: uuid("seller_id").notNull().references(() => sellers.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
  lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),
  lastDirection: text("last_direction"),
  firstInboundAt: timestamp("first_inbound_at", { withTimezone: true }),
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  firstResponseSeconds: integer("first_response_seconds"),
  inboundCount: integer("inbound_count").notNull().default(0),
  outboundCount: integer("outbound_count").notNull().default(0),
  /** contexto do anúncio (click to WhatsApp) que originou a conversa */
  adContext: jsonb("ad_context").$type<Record<string, string | null>>(),
  needsAnalysis: boolean("needs_analysis").notNull().default(false),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
  analyzedMessageCount: integer("analyzed_message_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("conversations_seller_contact").on(t.sellerId, t.contactId),
  index("conversations_last_message").on(t.orgId, t.lastMessageAt),
  index("conversations_needs_analysis").on(t.needsAnalysis, t.lastMessageAt),
]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sellerId: uuid("seller_id").notNull().references(() => sellers.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  waMessageId: text("wa_message_id").notNull(),
  /** in = lead mandou, out = vendedor mandou */
  direction: text("direction").notNull(),
  type: text("type").notNull(),
  text: text("text"),
  mediaMimetype: text("media_mimetype"),
  mediaDurationSeconds: integer("media_duration_seconds"),
  quotedWaMessageId: text("quoted_wa_message_id"),
  adContext: jsonb("ad_context").$type<Record<string, string | null>>(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
  source: text("source").notNull().default("live"),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("messages_seller_wa_id").on(t.sellerId, t.waMessageId),
  index("messages_conversation_sent").on(t.conversationId, t.sentAt),
  index("messages_org_sent").on(t.orgId, t.sentAt),
]);

export const conversationInsights = pgTable("conversation_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sellerId: uuid("seller_id").notNull().references(() => sellers.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().unique().references(() => conversations.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
  messageCount: integer("message_count").notNull(),
  // Lead
  leadScore: integer("lead_score").notNull(),
  stage: text("stage").notNull(),
  intent: text("intent"),
  interest: text("interest"),
  urgency: text("urgency"),
  budgetMentioned: text("budget_mentioned"),
  objections: jsonb("objections").$type<string[]>().notNull().default([]),
  lostReason: text("lost_reason"),
  sentiment: text("sentiment"),
  summary: text("summary").notNull(),
  nextStep: text("next_step"),
  followupNeeded: boolean("followup_needed").notNull().default(false),
  followupSuggestion: text("followup_suggestion"),
  // Vendedor
  sellerScore: integer("seller_score").notNull(),
  sellerStrengths: jsonb("seller_strengths").$type<string[]>().notNull().default([]),
  sellerImprovements: jsonb("seller_improvements").$type<string[]>().notNull().default([]),
  askedQualifyingQuestions: boolean("asked_qualifying_questions").notNull().default(false),
  attemptedClose: boolean("attempted_close").notNull().default(false),
  raw: jsonb("raw").$type<Record<string, unknown>>().notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
}, (t) => [
  index("insights_org_stage").on(t.orgId, t.stage),
  index("insights_seller").on(t.sellerId, t.analyzedAt),
]);

export type Seller = typeof sellers.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type ConversationInsight = typeof conversationInsights.$inferSelect;
