import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, sellers } from "@/db";
import { QrConnect } from "@/components/qr-connect";
import { Card, Empty, Kpi, PeriodTabs, Score } from "@/components/ui";
import { fmtRelative, fmtSeconds } from "@/lib/format";
import { getSellerStats, listConversations, topImprovements } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function SellerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dias?: string }> }) {
  const { id } = await params;
  const days = Number((await searchParams).dias ?? 7) || 7;
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, id)).limit(1);
  if (!seller) notFound();
  const [stats, convs, improvements] = await Promise.all([
    getSellerStats(seller.orgId, days).then((r) => r.find((s) => s.id === id)),
    listConversations(seller.orgId, { sellerId: id, limit: 20 }),
    topImprovements(seller.orgId, days, id),
  ]);
  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{seller.name}</h1>
        <PeriodTabs current={days} basePath={`/vendedores/${id}`} />
      </div>
      <Card title="Conexão do WhatsApp">
        <QrConnect sellerId={id} initialStatus={seller.status} />
      </Card>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Leads novos" value={stats.newLeads} />
          <Kpi label="1ª resposta (mediana)" value={fmtSeconds(stats.medianFirstResponse)} />
          <Kpi label="Resposta média" value={fmtSeconds(stats.medianResponse)} />
          <Kpi label="Taxa de resposta" value={pct(stats.responseRate)} />
          <Kpi label="Paradas" value={stats.stalled} tone={stats.stalled ? "bad" : "good"} />
          <Kpi label="Fora do horário" value={pct(stats.outsideHoursPct)} hint="mensagens enviadas fora do expediente" />
          <Kpi label="Nota do atendimento" value={stats.avgSellerScore == null ? "–" : Math.round(stats.avgSellerScore)} />
          <Kpi label="Ganhos" value={stats.won} tone="good" />
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Últimas conversas" className="md:col-span-2" action={<Link href={`/conversas?vendedor=${id}`} className="text-xs text-zinc-500 hover:underline">ver todas</Link>}>
          {convs.length === 0 ? <Empty>Nenhuma conversa ainda. Assim que o WhatsApp conectar, as mensagens começam a aparecer.</Empty> : (
            <ul className="divide-y divide-zinc-100">
              {convs.map((c) => (
                <li key={c.id} className="py-2 flex items-center gap-3 text-sm">
                  <Link href={`/conversas/${c.id}`} className="font-medium hover:underline truncate">{c.contactName ?? c.phone ?? "sem nome"}</Link>
                  <span className="text-xs text-zinc-400 truncate flex-1">{c.lastText ?? ""}</span>
                  <Score value={c.leadScore} />
                  <span className="text-xs text-zinc-400 whitespace-nowrap">{fmtRelative(c.lastMessageAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="O que melhorar">
          {improvements.length === 0 ? <Empty>Sem análises ainda.</Empty> : (
            <ul className="space-y-1.5 text-sm">{improvements.map((o) => <li key={o.improvement} className="flex justify-between gap-2"><span>{o.improvement}</span><span className="text-zinc-400 tabular-nums">{o.count}×</span></li>)}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
