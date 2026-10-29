import { sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { env } from "./env";

type Row = Record<string, unknown>;
const num = (v: unknown) => (v == null ? null : Number(v));

async function q<T = Row>(query: ReturnType<typeof dsql>): Promise<T[]> {
  const res = await db.execute(query);
  return res as unknown as T[];
}

export interface Overview {
  newLeads: number; activeConversations: number; stalled: number; needFollowup: number;
  medianFirstResponse: number | null; responseRate: number | null; avgLeadScore: number | null; avgSellerScore: number | null;
  stageCounts: { stage: string; count: number }[];
}

export async function getOverview(orgId: string, days: number): Promise<Overview> {
  const stalledMin = env.stalledAfterMinutes;
  const [k] = await q(dsql`
    select
      count(*) filter (where c.started_at >= now() - make_interval(days => ${days})) as new_leads,
      count(*) filter (where c.last_message_at >= now() - make_interval(days => ${days})) as active,
      count(*) filter (where c.last_direction = 'in' and c.last_inbound_at < now() - make_interval(mins => ${stalledMin}) and c.last_inbound_at >= now() - make_interval(days => ${days})) as stalled,
      percentile_cont(0.5) within group (order by c.first_response_seconds) filter (where c.first_inbound_at >= now() - make_interval(days => ${days})) as median_first,
      (count(*) filter (where c.first_response_at is not null and c.first_inbound_at >= now() - make_interval(days => ${days})))::float
        / nullif(count(*) filter (where c.first_inbound_at >= now() - make_interval(days => ${days})), 0) as response_rate
    from conversations c where c.org_id = ${orgId}
  `);
  const [i] = await q(dsql`
    select count(*) filter (where i.followup_needed and i.stage not in ('ganho','perdido','nao_lead')) as need_followup,
           avg(i.lead_score) filter (where i.stage <> 'nao_lead') as avg_lead, avg(i.seller_score) filter (where i.stage <> 'nao_lead') as avg_seller
    from conversation_insights i join conversations c on c.id = i.conversation_id
    where i.org_id = ${orgId} and c.last_message_at >= now() - make_interval(days => ${days})
  `);
  const stages = await q(dsql`
    select i.stage, count(*)::int as count from conversation_insights i join conversations c on c.id = i.conversation_id
    where i.org_id = ${orgId} and c.last_message_at >= now() - make_interval(days => ${days}) group by i.stage order by count desc
  `);
  return {
    newLeads: Number(k?.new_leads ?? 0), activeConversations: Number(k?.active ?? 0), stalled: Number(k?.stalled ?? 0),
    needFollowup: Number(i?.need_followup ?? 0), medianFirstResponse: num(k?.median_first), responseRate: num(k?.response_rate),
    avgLeadScore: num(i?.avg_lead), avgSellerScore: num(i?.avg_seller),
    stageCounts: stages.map((s) => ({ stage: String(s.stage), count: Number(s.count) })),
  };
}

export interface SellerStat {
  id: string; name: string; status: string; phone: string | null;
  conversations: number; newLeads: number; stalled: number; medianFirstResponse: number | null; medianResponse: number | null;
  responseRate: number | null; outsideHoursPct: number | null; avgLeadScore: number | null; avgSellerScore: number | null; won: number;
}

export async function getSellerStats(orgId: string, days: number): Promise<SellerStat[]> {
  const stalledMin = env.stalledAfterMinutes;
  const rows = await q(dsql`
    with conv as (
      select s.id as seller_id,
        count(c.id) filter (where c.last_message_at >= now() - make_interval(days => ${days})) as conversations,
        count(c.id) filter (where c.started_at >= now() - make_interval(days => ${days})) as new_leads,
        count(c.id) filter (where c.last_direction = 'in' and c.last_inbound_at < now() - make_interval(mins => ${stalledMin}) and c.last_inbound_at >= now() - make_interval(days => ${days})) as stalled,
        percentile_cont(0.5) within group (order by c.first_response_seconds) filter (where c.first_inbound_at >= now() - make_interval(days => ${days})) as median_first,
        (count(c.id) filter (where c.first_response_at is not null and c.first_inbound_at >= now() - make_interval(days => ${days})))::float
          / nullif(count(c.id) filter (where c.first_inbound_at >= now() - make_interval(days => ${days})), 0) as response_rate
      from sellers s left join conversations c on c.seller_id = s.id
      where s.org_id = ${orgId} group by s.id
    ),
    ordered as (
      select m.seller_id, m.direction, m.sent_at,
        lag(m.direction) over w as prev_dir, lag(m.sent_at) over w as prev_at
      from messages m where m.org_id = ${orgId} and m.revoked = false and m.sent_at >= now() - make_interval(days => ${days})
      window w as (partition by m.conversation_id order by m.sent_at)
    ),
    resp as (
      select seller_id,
        percentile_cont(0.5) within group (order by extract(epoch from (sent_at - prev_at))) filter (where direction = 'out' and prev_dir = 'in') as median_resp,
        (count(*) filter (where direction = 'out' and (extract(hour from sent_at at time zone ${env.timezone}) < ${env.businessHoursStart} or extract(hour from sent_at at time zone ${env.timezone}) >= ${env.businessHoursEnd} or extract(dow from sent_at at time zone ${env.timezone}) in (0,6))))::float
          / nullif(count(*) filter (where direction = 'out'), 0) as outside_pct
      from ordered group by seller_id
    ),
    ins as (
      select i.seller_id, avg(i.lead_score) filter (where i.stage <> 'nao_lead') as avg_lead, avg(i.seller_score) filter (where i.stage <> 'nao_lead') as avg_seller,
             count(*) filter (where i.stage = 'ganho') as won
      from conversation_insights i join conversations c on c.id = i.conversation_id
      where i.org_id = ${orgId} and c.last_message_at >= now() - make_interval(days => ${days}) group by i.seller_id
    )
    select s.id, s.name, s.status, s.phone, conv.conversations, conv.new_leads, conv.stalled, conv.median_first, conv.response_rate,
           resp.median_resp, resp.outside_pct, ins.avg_lead, ins.avg_seller, ins.won
    from sellers s join conv on conv.seller_id = s.id
    left join resp on resp.seller_id = s.id left join ins on ins.seller_id = s.id
    where s.org_id = ${orgId} and s.active order by s.name
  `);
  return rows.map((r) => ({
    id: String(r.id), name: String(r.name), status: String(r.status), phone: (r.phone as string | null) ?? null,
    conversations: Number(r.conversations ?? 0), newLeads: Number(r.new_leads ?? 0), stalled: Number(r.stalled ?? 0),
    medianFirstResponse: num(r.median_first), medianResponse: num(r.median_resp), responseRate: num(r.response_rate),
    outsideHoursPct: num(r.outside_pct), avgLeadScore: num(r.avg_lead), avgSellerScore: num(r.avg_seller), won: Number(r.won ?? 0),
  }));
}

export interface ConversationRow {
  id: string; sellerId: string; sellerName: string; contactName: string | null; phone: string | null;
  lastMessageAt: Date | null; lastDirection: string | null; lastInboundAt: Date | null; firstResponseSeconds: number | null;
  inboundCount: number; outboundCount: number; stage: string | null; leadScore: number | null; sellerScore: number | null;
  followupNeeded: boolean | null; summary: string | null; lastText: string | null; hasAd: boolean;
}

export async function listConversations(orgId: string, opts: { sellerId?: string; filter?: string; stage?: string; limit?: number; offset?: number; search?: string }): Promise<ConversationRow[]> {
  const stalledMin = env.stalledAfterMinutes;
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const conds = [dsql`c.org_id = ${orgId}`];
  if (opts.sellerId) conds.push(dsql`c.seller_id = ${opts.sellerId}`);
  if (opts.stage) conds.push(dsql`i.stage = ${opts.stage}`);
  if (opts.filter === "stalled") conds.push(dsql`c.last_direction = 'in' and c.last_inbound_at < now() - make_interval(mins => ${stalledMin})`);
  if (opts.filter === "followup") conds.push(dsql`i.followup_needed = true and i.stage not in ('ganho','perdido','nao_lead')`);
  if (opts.filter === "ads") conds.push(dsql`c.ad_context is not null`);
  if (opts.search) conds.push(dsql`(ct.name ilike ${"%" + opts.search + "%"} or ct.push_name ilike ${"%" + opts.search + "%"} or ct.phone ilike ${"%" + opts.search + "%"})`);
  const where = dsql.join(conds, dsql` and `);
  const rows = await q(dsql`
    select c.id, c.seller_id, s.name as seller_name, coalesce(ct.name, ct.push_name) as contact_name, ct.phone,
      c.last_message_at, c.last_direction, c.last_inbound_at, c.first_response_seconds, c.inbound_count, c.outbound_count,
      i.stage, i.lead_score, i.seller_score, i.followup_needed, i.summary, (c.ad_context is not null) as has_ad,
      (select m.text from messages m where m.conversation_id = c.id and m.revoked = false order by m.sent_at desc limit 1) as last_text
    from conversations c
    join sellers s on s.id = c.seller_id
    join contacts ct on ct.id = c.contact_id
    left join conversation_insights i on i.conversation_id = c.id
    where ${where}
    order by c.last_message_at desc nulls last
    limit ${limit} offset ${offset}
  `);
  return rows.map((r) => ({
    id: String(r.id), sellerId: String(r.seller_id), sellerName: String(r.seller_name), contactName: (r.contact_name as string | null) ?? null,
    phone: (r.phone as string | null) ?? null, lastMessageAt: r.last_message_at as Date | null, lastDirection: (r.last_direction as string | null) ?? null,
    lastInboundAt: r.last_inbound_at as Date | null, firstResponseSeconds: num(r.first_response_seconds), inboundCount: Number(r.inbound_count),
    outboundCount: Number(r.outbound_count), stage: (r.stage as string | null) ?? null, leadScore: num(r.lead_score), sellerScore: num(r.seller_score),
    followupNeeded: (r.followup_needed as boolean | null) ?? null, summary: (r.summary as string | null) ?? null,
    lastText: (r.last_text as string | null) ?? null, hasAd: Boolean(r.has_ad),
  }));
}

export interface ObjectionRow { objection: string; count: number }
export async function topObjections(orgId: string, days: number, limit = 8): Promise<ObjectionRow[]> {
  const rows = await q(dsql`
    select lower(trim(o)) as objection, count(*)::int as count
    from conversation_insights i join conversations c on c.id = i.conversation_id, jsonb_array_elements_text(i.objections) o
    where i.org_id = ${orgId} and c.last_message_at >= now() - make_interval(days => ${days})
    group by 1 order by 2 desc limit ${limit}
  `);
  return rows.map((r) => ({ objection: String(r.objection), count: Number(r.count) }));
}

export interface ImprovementRow { improvement: string; count: number }
export async function topImprovements(orgId: string, days: number, sellerId?: string, limit = 8): Promise<ImprovementRow[]> {
  const sellerCond = sellerId ? dsql`and i.seller_id = ${sellerId}` : dsql``;
  const rows = await q(dsql`
    select trim(o) as improvement, count(*)::int as count
    from conversation_insights i join conversations c on c.id = i.conversation_id, jsonb_array_elements_text(i.seller_improvements) o
    where i.org_id = ${orgId} and c.last_message_at >= now() - make_interval(days => ${days}) ${sellerCond}
    group by 1 order by 2 desc limit ${limit}
  `);
  return rows.map((r) => ({ improvement: String(r.improvement), count: Number(r.count) }));
}

export interface AdSourceRow { title: string; count: number; avgScore: number | null; won: number }
export async function adSources(orgId: string, days: number): Promise<AdSourceRow[]> {
  const rows = await q(dsql`
    select coalesce(c.ad_context->>'title', c.ad_context->>'sourceUrl', 'anúncio sem título') as title, count(*)::int as count,
      avg(i.lead_score) as avg_score, count(*) filter (where i.stage = 'ganho')::int as won
    from conversations c left join conversation_insights i on i.conversation_id = c.id
    where c.org_id = ${orgId} and c.ad_context is not null and c.started_at >= now() - make_interval(days => ${days})
    group by 1 order by 2 desc limit 10
  `);
  return rows.map((r) => ({ title: String(r.title), count: Number(r.count), avgScore: num(r.avg_score), won: Number(r.won) }));
}
