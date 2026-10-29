import { and, eq, inArray, sql as dsql } from "drizzle-orm";
import { contacts, conversations, db, messages, sellers, type Contact } from "@/db";

export interface AdContext {
  title: string | null; body: string | null; sourceType: string | null; sourceId: string | null;
  sourceUrl: string | null; mediaUrl: string | null; ctwaClid: string | null; conversionSource: string | null;
  entryPointConversionSource: string | null; entryPointConversionApp: string | null;
}
export interface IncomingMessage {
  waMessageId: string; phoneJid: string | null; lidJid: string | null; fromMe: boolean; timestamp: string;
  type: string; text: string | null; pushName: string | null; mediaMimetype: string | null;
  mediaDurationSeconds: number | null; quotedMessageId: string | null; adContext: AdContext | null; revoked: boolean;
}
export type GatewayEvent =
  | { type: "connection.update"; instanceId: string; status: string; phone: string | null; name: string | null; at: string }
  | { type: "messages.upsert"; instanceId: string; source: "live" | "history"; messages: IncomingMessage[]; at: string }
  | { type: "contacts.upsert"; instanceId: string; contacts: { phoneJid: string | null; lidJid: string | null; name: string | null; pushName: string | null }[]; at: string };

const phoneFromJid = (jid: string | null) => (jid ? jid.split("@")[0].split(":")[0] : null);

/** Encontra ou cria o contato do lead, unificando LID e telefone quando os dois aparecem. */
async function resolveContact(seller: { id: string; orgId: string }, phoneJid: string | null, lidJid: string | null, pushName: string | null): Promise<Contact> {
  const byPhone = phoneJid
    ? (await db.select().from(contacts).where(and(eq(contacts.sellerId, seller.id), eq(contacts.phoneJid, phoneJid))).limit(1))[0]
    : undefined;
  const byLid = lidJid
    ? (await db.select().from(contacts).where(and(eq(contacts.sellerId, seller.id), eq(contacts.lidJid, lidJid))).limit(1))[0]
    : undefined;

  let found = byPhone ?? byLid;
  if (byPhone && byLid && byPhone.id !== byLid.id) {
    // Mesmo lead com dois registros (chegou primeiro por LID, depois por telefone): funde no de telefone.
    await db.transaction(async (tx) => {
      const [convPhone] = await tx.select().from(conversations).where(eq(conversations.contactId, byPhone.id)).limit(1);
      const [convLid] = await tx.select().from(conversations).where(eq(conversations.contactId, byLid.id)).limit(1);
      if (convLid) {
        if (convPhone) {
          await tx.update(messages).set({ conversationId: convPhone.id, contactId: byPhone.id }).where(eq(messages.conversationId, convLid.id));
          await tx.delete(conversations).where(eq(conversations.id, convLid.id));
        } else {
          await tx.update(messages).set({ contactId: byPhone.id }).where(eq(messages.conversationId, convLid.id));
          await tx.update(conversations).set({ contactId: byPhone.id }).where(eq(conversations.id, convLid.id));
        }
      }
      await tx.delete(contacts).where(eq(contacts.id, byLid.id));
      await tx.update(contacts).set({ lidJid: byLid.lidJid, pushName: byPhone.pushName ?? byLid.pushName, name: byPhone.name ?? byLid.name, updatedAt: new Date() }).where(eq(contacts.id, byPhone.id));
    });
    found = (await db.select().from(contacts).where(eq(contacts.id, byPhone.id)).limit(1))[0];
  }

  if (found) {
    const patch: Partial<Contact> = {};
    if (phoneJid && !found.phoneJid) { patch.phoneJid = phoneJid; patch.phone = phoneFromJid(phoneJid); }
    if (lidJid && !found.lidJid) patch.lidJid = lidJid;
    if (pushName && !found.pushName) patch.pushName = pushName;
    if (Object.keys(patch).length) {
      await db.update(contacts).set({ ...patch, updatedAt: new Date() }).where(eq(contacts.id, found.id));
      return { ...found, ...patch };
    }
    return found;
  }

  const [created] = await db.insert(contacts).values({
    orgId: seller.orgId, sellerId: seller.id, phoneJid, lidJid, phone: phoneFromJid(phoneJid), pushName,
  }).onConflictDoNothing().returning();
  if (created) return created;
  // corrida entre lotes: busca de novo
  return resolveContact(seller, phoneJid, lidJid, pushName);
}

async function resolveConversation(seller: { id: string; orgId: string }, contactId: string) {
  const [existing] = await db.select().from(conversations).where(and(eq(conversations.sellerId, seller.id), eq(conversations.contactId, contactId))).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(conversations).values({ orgId: seller.orgId, sellerId: seller.id, contactId }).onConflictDoNothing().returning();
  if (created) return created;
  return resolveConversation(seller, contactId);
}

/** Recalcula contadores e tempos da conversa a partir das mensagens (idempotente, aguenta histórico fora de ordem). */
export async function refreshConversationStats(conversationIds: string[]) {
  if (!conversationIds.length) return;
  await db.execute(dsql`
    with agg as (
      select
        m.conversation_id,
        min(m.sent_at) as started_at,
        max(m.sent_at) as last_message_at,
        max(m.sent_at) filter (where m.direction = 'in') as last_inbound_at,
        max(m.sent_at) filter (where m.direction = 'out') as last_outbound_at,
        min(m.sent_at) filter (where m.direction = 'in') as first_inbound_at,
        count(*) filter (where m.direction = 'in') as inbound_count,
        count(*) filter (where m.direction = 'out') as outbound_count,
        count(*) as total
      from messages m
      where m.conversation_id in ${conversationIds} and m.revoked = false
      group by m.conversation_id
    ),
    fr as (
      select a.conversation_id,
        (select min(sent_at) from messages x where x.conversation_id = a.conversation_id and x.direction = 'out' and x.sent_at >= a.first_inbound_at) as first_response_at
      from agg a
    ),
    ad as (
      select distinct on (m.conversation_id) m.conversation_id, m.ad_context
      from messages m where m.conversation_id in ${conversationIds} and m.ad_context is not null
      order by m.conversation_id, m.sent_at asc
    )
    update conversations c set
      started_at = a.started_at,
      last_message_at = a.last_message_at,
      last_inbound_at = a.last_inbound_at,
      last_outbound_at = a.last_outbound_at,
      last_direction = case when a.last_inbound_at is not null and (a.last_outbound_at is null or a.last_inbound_at >= a.last_outbound_at) then 'in' else 'out' end,
      first_inbound_at = a.first_inbound_at,
      first_response_at = fr.first_response_at,
      first_response_seconds = case when fr.first_response_at is not null then extract(epoch from (fr.first_response_at - a.first_inbound_at))::int end,
      inbound_count = a.inbound_count,
      outbound_count = a.outbound_count,
      ad_context = coalesce(c.ad_context, ad.ad_context),
      needs_analysis = (a.total > c.analyzed_message_count)
    from agg a
    left join fr on fr.conversation_id = a.conversation_id
    left join ad on ad.conversation_id = a.conversation_id
    where c.id = a.conversation_id
  `);
}

export async function ingestEvents(events: GatewayEvent[]) {
  const touched = new Set<string>();
  let inserted = 0;

  for (const ev of events) {
    const [seller] = await db.select().from(sellers).where(eq(sellers.instanceId, ev.instanceId)).limit(1);
    if (!seller) continue; // instância desconhecida (ex: vendedor removido)

    if (ev.type === "connection.update") {
      await db.update(sellers).set({
        status: ev.status, lastStatusAt: new Date(ev.at),
        ...(ev.phone ? { phone: ev.phone } : {}), ...(ev.name ? { waName: ev.name } : {}),
      }).where(eq(sellers.id, seller.id));
      continue;
    }

    if (ev.type === "contacts.upsert") {
      for (const c of ev.contacts) {
        const contact = await resolveContact(seller, c.phoneJid, c.lidJid, c.pushName);
        if ((c.name && c.name !== contact.name) || (c.pushName && !contact.pushName)) {
          await db.update(contacts).set({ name: c.name ?? contact.name, pushName: contact.pushName ?? c.pushName, updatedAt: new Date() }).where(eq(contacts.id, contact.id));
        }
      }
      continue;
    }

    for (const m of ev.messages) {
      if (!m.phoneJid && !m.lidJid) continue;
      if (m.revoked) {
        await db.update(messages).set({ revoked: true }).where(and(eq(messages.sellerId, seller.id), eq(messages.waMessageId, m.waMessageId)));
        const [row] = await db.select({ conversationId: messages.conversationId }).from(messages).where(and(eq(messages.sellerId, seller.id), eq(messages.waMessageId, m.waMessageId))).limit(1);
        if (row) touched.add(row.conversationId);
        continue;
      }
      const contact = await resolveContact(seller, m.phoneJid, m.lidJid, m.fromMe ? null : m.pushName);
      const conv = await resolveConversation(seller, contact.id);
      const [row] = await db.insert(messages).values({
        orgId: seller.orgId, sellerId: seller.id, conversationId: conv.id, contactId: contact.id,
        waMessageId: m.waMessageId, direction: m.fromMe ? "out" : "in", type: m.type, text: m.text,
        mediaMimetype: m.mediaMimetype, mediaDurationSeconds: m.mediaDurationSeconds, quotedWaMessageId: m.quotedMessageId,
        adContext: m.adContext as Record<string, string | null> | null, sentAt: new Date(m.timestamp), source: ev.source,
      }).onConflictDoNothing().returning({ id: messages.id });
      if (row) { inserted += 1; touched.add(conv.id); }
    }
  }

  await refreshConversationStats([...touched]);
  return { inserted, conversationsTouched: touched.size };
}

/** Apaga mensagens antigas (LGPD / minimização). Mantém conversas e insights. */
export async function purgeOldMessages(retentionDays: number) {
  if (!retentionDays || retentionDays <= 0) return 0;
  const res = await db.execute(dsql`delete from messages where sent_at < now() - make_interval(days => ${retentionDays})`);
  return Number((res as unknown as { count?: number }).count ?? 0);
}

export { inArray };
