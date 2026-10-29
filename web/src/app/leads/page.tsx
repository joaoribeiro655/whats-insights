import Link from "next/link";
import { Card, Empty, Score, StageBadge } from "@/components/ui";
import { fmtPhone, fmtRelative, STAGE_LABEL } from "@/lib/format";
import { listConversations } from "@/lib/metrics";
import { getDefaultOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

/** Visão por lead: contatos já analisados, ordenados por score. */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ etapa?: string }> }) {
  const sp = await searchParams;
  const org = await getDefaultOrg();
  const rows = (await listConversations(org.id, { stage: sp.etapa || undefined, limit: 200 }))
    .filter((r) => r.stage && r.stage !== "nao_lead")
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0));
  const stages = Object.entries(STAGE_LABEL).filter(([k]) => k !== "nao_lead");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Leads</h1>
        <div className="flex gap-1 text-sm flex-wrap">
          <Link href="/leads" className={`px-3 py-1 rounded-md border ${!sp.etapa ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 text-zinc-600"}`}>Todos</Link>
          {stages.map(([k, v]) => <Link key={k} href={`/leads?etapa=${k}`} className={`px-3 py-1 rounded-md border ${sp.etapa === k ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 text-zinc-600"}`}>{v}</Link>)}
        </div>
      </div>
      <Card>
        {rows.length === 0 ? <Empty>Nenhum lead analisado ainda.</Empty> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 text-left"><tr><th className="py-1">Lead</th><th>Etapa</th><th>Score</th><th>Resumo</th><th>Vendedor</th><th className="text-right">Última</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-zinc-100 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap"><Link href={`/conversas/${c.id}`} className="font-medium hover:underline">{c.contactName ?? fmtPhone(c.phone)}</Link><div className="text-xs text-zinc-400">{fmtPhone(c.phone)}</div></td>
                  <td className="pr-3"><StageBadge stage={c.stage} />{c.followupNeeded && <div className="text-[10px] text-amber-700 mt-0.5">follow up</div>}</td>
                  <td className="pr-3"><Score value={c.leadScore} /></td>
                  <td className="pr-3 text-zinc-600 max-w-md">{c.summary}</td>
                  <td className="pr-3 text-zinc-600 whitespace-nowrap">{c.sellerName}</td>
                  <td className="text-right text-xs text-zinc-400 whitespace-nowrap">{fmtRelative(c.lastMessageAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
