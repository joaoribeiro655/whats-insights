import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, sellers } from "@/db";
import { Card, Empty, Score, StageBadge } from "@/components/ui";
import { fmtRelative, fmtSeconds, STAGE_LABEL } from "@/lib/format";
import { listConversations } from "@/lib/metrics";
import { getDefaultOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

const FILTERS = [["", "Todas"], ["stalled", "Esperando resposta"], ["followup", "Follow up"], ["ads", "De anúncio"]] as const;

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ vendedor?: string; filtro?: string; etapa?: string; q?: string; pagina?: string }> }) {
  const sp = await searchParams;
  const org = await getDefaultOrg();
  const page = Math.max(1, Number(sp.pagina ?? 1) || 1);
  const limit = 50;
  const [sellerRows, rows] = await Promise.all([
    db.select({ id: sellers.id, name: sellers.name }).from(sellers).where(eq(sellers.orgId, org.id)).orderBy(asc(sellers.name)),
    listConversations(org.id, { sellerId: sp.vendedor || undefined, filter: sp.filtro || undefined, stage: sp.etapa || undefined, search: sp.q || undefined, limit, offset: (page - 1) * limit }),
  ]);
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch, pagina: undefined };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return `/conversas${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Conversas</h1>
      <div className="flex flex-wrap gap-2 items-center text-sm">
        {FILTERS.map(([v, label]) => (
          <Link key={v} href={link({ filtro: v || undefined })} className={`px-3 py-1 rounded-md border ${(sp.filtro ?? "") === v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 text-zinc-600"}`}>{label}</Link>
        ))}
        <form className="flex gap-2 items-center ml-auto" action="/conversas">
          {sp.vendedor && <input type="hidden" name="vendedor" value={sp.vendedor} />}
          {sp.filtro && <input type="hidden" name="filtro" value={sp.filtro} />}
          <select name="vendedor" defaultValue={sp.vendedor ?? ""} className="border border-zinc-200 rounded-md px-2 py-1 bg-white">
            <option value="">Todos os vendedores</option>
            {sellerRows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select name="etapa" defaultValue={sp.etapa ?? ""} className="border border-zinc-200 rounded-md px-2 py-1 bg-white">
            <option value="">Todas as etapas</option>
            {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="nome ou telefone" className="border border-zinc-200 rounded-md px-2 py-1 w-44" />
          <button className="px-3 py-1 rounded-md border border-zinc-300 bg-white">Filtrar</button>
        </form>
      </div>
      <Card>
        {rows.length === 0 ? <Empty>Nenhuma conversa com esses filtros.</Empty> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 text-left"><tr><th className="py-1">Contato</th><th>Vendedor</th><th>Etapa</th><th>Lead</th><th>Atendimento</th><th className="text-right">1ª resp.</th><th className="text-right">Msgs</th><th className="text-right">Última</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-zinc-100 align-top">
                  <td className="py-2 pr-3 max-w-xs">
                    <Link href={`/conversas/${c.id}`} className="font-medium hover:underline">{c.contactName ?? c.phone ?? "sem nome"}</Link>
                    {c.hasAd && <span className="ml-1 text-[10px] px-1 rounded bg-sky-100 text-sky-800">anúncio</span>}
                    {c.followupNeeded && c.stage && !["ganho", "perdido", "nao_lead"].includes(c.stage) && <span className="ml-1 text-[10px] px-1 rounded bg-amber-100 text-amber-800">follow up</span>}
                    <div className="text-xs text-zinc-400 truncate">{c.summary ?? c.lastText ?? ""}</div>
                  </td>
                  <td className="pr-3 text-zinc-600">{c.sellerName}</td>
                  <td className="pr-3"><StageBadge stage={c.stage} /></td>
                  <td className="pr-3"><Score value={c.leadScore} /></td>
                  <td className="pr-3"><Score value={c.sellerScore} /></td>
                  <td className="pr-3 text-right tabular-nums">{fmtSeconds(c.firstResponseSeconds)}</td>
                  <td className="pr-3 text-right tabular-nums">{c.inboundCount + c.outboundCount}</td>
                  <td className={`text-right text-xs whitespace-nowrap ${c.lastDirection === "in" ? "text-red-700" : "text-zinc-400"}`}>{fmtRelative(c.lastMessageAt)}{c.lastDirection === "in" ? " · lead" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex justify-between mt-3 text-xs">
          {page > 1 ? <Link href={`${link({})}${link({}).includes("?") ? "&" : "?"}pagina=${page - 1}`} className="underline">← anterior</Link> : <span />}
          {rows.length === limit && <Link href={`${link({})}${link({}).includes("?") ? "&" : "?"}pagina=${page + 1}`} className="underline">próxima →</Link>}
        </div>
      </Card>
    </div>
  );
}
