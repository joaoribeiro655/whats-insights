import Link from "next/link";
import { Card, Empty, Kpi, PeriodTabs, Score, StatusBadge } from "@/components/ui";
import { fmtRelative, fmtSeconds, STAGE_LABEL } from "@/lib/format";
import { adSources, getOverview, getSellerStats, listConversations, topImprovements, topObjections } from "@/lib/metrics";
import { getDefaultOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const sp = await searchParams;
  const days = Number(sp.dias ?? 7) || 7;
  const org = await getDefaultOrg();
  const [ov, sellers, stalled, followups, objections, improvements, ads] = await Promise.all([
    getOverview(org.id, days), getSellerStats(org.id, days),
    listConversations(org.id, { filter: "stalled", limit: 8 }), listConversations(org.id, { filter: "followup", limit: 8 }),
    topObjections(org.id, days), topImprovements(org.id, days), adSources(org.id, days),
  ]);
  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Visão geral</h1>
        <PeriodTabs current={days} basePath="/" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Leads novos" value={ov.newLeads} hint={`conversas iniciadas em ${days} dias`} />
        <Kpi label="1ª resposta (mediana)" value={fmtSeconds(ov.medianFirstResponse)} tone={ov.medianFirstResponse != null && ov.medianFirstResponse > 1800 ? "bad" : "good"} hint="tempo até o vendedor responder" />
        <Kpi label="Taxa de resposta" value={pct(ov.responseRate)} tone={ov.responseRate != null && ov.responseRate < 0.9 ? "warn" : "good"} hint="leads que receberam ao menos 1 resposta" />
        <Kpi label="Paradas esperando resposta" value={ov.stalled} tone={ov.stalled > 0 ? "bad" : "good"} hint="lead falou por último e ficou sem retorno" />
        <Kpi label="Precisam de follow up" value={ov.needFollowup} tone={ov.needFollowup > 0 ? "warn" : "good"} hint="segundo a análise" />
        <Kpi label="Conversas ativas" value={ov.activeConversations} />
        <Kpi label="Score médio dos leads" value={ov.avgLeadScore == null ? "–" : Math.round(ov.avgLeadScore)} />
        <Kpi label="Nota média do atendimento" value={ov.avgSellerScore == null ? "–" : Math.round(ov.avgSellerScore)} tone={ov.avgSellerScore != null && ov.avgSellerScore < 60 ? "warn" : "neutral"} />
      </div>

      <Card title="Vendedores">
        {sellers.length === 0 ? <Empty>Nenhum vendedor. <Link className="underline" href="/vendedores">Adicione o primeiro</Link>.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500 text-left">
                <tr><th className="py-1 pr-3">Vendedor</th><th className="pr-3">Status</th><th className="pr-3 text-right">Leads</th><th className="pr-3 text-right">Conversas</th><th className="pr-3 text-right">1ª resp.</th><th className="pr-3 text-right">Resp. média</th><th className="pr-3 text-right">Taxa resp.</th><th className="pr-3 text-right">Paradas</th><th className="pr-3 text-right">Fora do horário</th><th className="pr-3">Atendimento</th><th className="pr-3">Leads (score)</th><th className="text-right">Ganhos</th></tr>
              </thead>
              <tbody>
                {sellers.map((s) => (
                  <tr key={s.id} className="border-t border-zinc-100">
                    <td className="py-2 pr-3"><Link href={`/vendedores/${s.id}`} className="font-medium hover:underline">{s.name}</Link></td>
                    <td className="pr-3"><StatusBadge status={s.status} /></td>
                    <td className="pr-3 text-right tabular-nums">{s.newLeads}</td>
                    <td className="pr-3 text-right tabular-nums">{s.conversations}</td>
                    <td className="pr-3 text-right tabular-nums">{fmtSeconds(s.medianFirstResponse)}</td>
                    <td className="pr-3 text-right tabular-nums">{fmtSeconds(s.medianResponse)}</td>
                    <td className="pr-3 text-right tabular-nums">{pct(s.responseRate)}</td>
                    <td className={`pr-3 text-right tabular-nums ${s.stalled ? "text-red-700 font-medium" : ""}`}>{s.stalled}</td>
                    <td className="pr-3 text-right tabular-nums">{pct(s.outsideHoursPct)}</td>
                    <td className="pr-3"><Score value={s.avgSellerScore} /></td>
                    <td className="pr-3"><Score value={s.avgLeadScore} /></td>
                    <td className="text-right tabular-nums">{s.won}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Leads esperando resposta" action={<Link href="/conversas?filtro=stalled" className="text-xs text-zinc-500 hover:underline">ver todas</Link>}>
          {stalled.length === 0 ? <Empty>Ninguém esperando. 👏</Empty> : (
            <ul className="divide-y divide-zinc-100">
              {stalled.map((c) => (
                <li key={c.id} className="py-2 flex items-center gap-3 text-sm">
                  <Link href={`/conversas/${c.id}`} className="font-medium hover:underline truncate">{c.contactName ?? c.phone ?? "sem nome"}</Link>
                  <span className="text-zinc-400 text-xs">{c.sellerName}</span>
                  <span className="ml-auto text-xs text-red-700 whitespace-nowrap">esperando há {fmtRelative(c.lastInboundAt).replace(" atrás", "")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Follow up recomendado" action={<Link href="/conversas?filtro=followup" className="text-xs text-zinc-500 hover:underline">ver todas</Link>}>
          {followups.length === 0 ? <Empty>Nenhum follow up pendente.</Empty> : (
            <ul className="divide-y divide-zinc-100">
              {followups.map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <Link href={`/conversas/${c.id}`} className="font-medium hover:underline truncate">{c.contactName ?? c.phone ?? "sem nome"}</Link>
                    <span className="text-zinc-400 text-xs">{c.sellerName}</span>
                    <span className="ml-auto text-xs text-zinc-500">{c.stage ? STAGE_LABEL[c.stage] : ""}</span>
                  </div>
                  {c.summary && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{c.summary}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Objeções mais frequentes">
          {objections.length === 0 ? <Empty>Sem dados ainda.</Empty> : (
            <ul className="space-y-1 text-sm">{objections.map((o) => <li key={o.objection} className="flex justify-between"><span>{o.objection}</span><span className="text-zinc-400 tabular-nums">{o.count}</span></li>)}</ul>
          )}
        </Card>
        <Card title="Melhorias mais apontadas no atendimento">
          {improvements.length === 0 ? <Empty>Sem dados ainda.</Empty> : (
            <ul className="space-y-1 text-sm">{improvements.map((o) => <li key={o.improvement} className="flex justify-between gap-3"><span>{o.improvement}</span><span className="text-zinc-400 tabular-nums">{o.count}</span></li>)}</ul>
          )}
        </Card>
        <Card title="Origem por anúncio (click to WhatsApp)" className="md:col-span-2">
          {ads.length === 0 ? <Empty>Nenhum lead veio de anúncio neste período (ou o contexto do anúncio não chegou).</Empty> : (
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500 text-left"><tr><th className="py-1">Anúncio</th><th className="text-right">Leads</th><th className="text-right">Score médio</th><th className="text-right">Ganhos</th></tr></thead>
              <tbody>{ads.map((a) => <tr key={a.title} className="border-t border-zinc-100"><td className="py-1.5 truncate max-w-md">{a.title}</td><td className="text-right tabular-nums">{a.count}</td><td className="text-right tabular-nums">{a.avgScore == null ? "–" : Math.round(a.avgScore)}</td><td className="text-right tabular-nums">{a.won}</td></tr>)}</tbody>
            </table>
          )}
        </Card>
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        {ov.stageCounts.map((s) => <Kpi key={s.stage} label={STAGE_LABEL[s.stage] ?? s.stage} value={s.count} />)}
      </div>
    </div>
  );
}
