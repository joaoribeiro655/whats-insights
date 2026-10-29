import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { contacts, conversationInsights, conversations, db, messages, sellers } from "@/db";
import { AnalyzeButton } from "@/components/analyze-button";
import { Card, Score, StageBadge } from "@/components/ui";
import { fmtDate, fmtPhone, fmtRelative, fmtSeconds } from "@/lib/format";

export const dynamic = "force-dynamic";

function Bubble({ m }: { m: typeof messages.$inferSelect }) {
  const out = m.direction === "out";
  let body = m.text;
  if (m.type === "audio") body = `🎤 áudio ${m.mediaDurationSeconds ? `(${m.mediaDurationSeconds}s)` : ""}`;
  else if (m.type === "image") body = `🖼️ imagem${m.text ? ` · ${m.text}` : ""}`;
  else if (m.type === "video") body = `🎬 vídeo${m.text ? ` · ${m.text}` : ""}`;
  else if (m.type === "document") body = `📎 ${m.text ?? "documento"}`;
  else if (m.type === "sticker") body = "figurinha";
  else if (m.type === "location") body = `📍 ${m.text ?? "localização"}`;
  else if (m.type === "contact") body = `👤 ${m.text ?? "contato"}`;
  else if (!body) body = `[${m.type}]`;
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${out ? "bg-emerald-100" : "bg-white border border-zinc-200"} ${m.revoked ? "opacity-50 line-through" : ""}`}>
        {m.adContext && <div className="text-[11px] text-sky-800 mb-1">via anúncio: {m.adContext.title ?? m.adContext.sourceUrl ?? ""}</div>}
        <div className="whitespace-pre-wrap break-words">{body}</div>
        <div className="text-[10px] text-zinc-400 text-right mt-0.5">{fmtDate(m.sentAt)}</div>
      </div>
    </div>
  );
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (!conv) notFound();
  const [[seller], [contact], [insight], msgs] = await Promise.all([
    db.select().from(sellers).where(eq(sellers.id, conv.sellerId)).limit(1),
    db.select().from(contacts).where(eq(contacts.id, conv.contactId)).limit(1),
    db.select().from(conversationInsights).where(eq(conversationInsights.conversationId, id)).limit(1),
    db.select().from(messages).where(and(eq(messages.conversationId, id))).orderBy(asc(messages.sentAt)),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">{contact?.name ?? contact?.pushName ?? fmtPhone(contact?.phone)}</h1>
        <span className="text-sm text-zinc-500">{fmtPhone(contact?.phone)} · atendido por <Link href={`/vendedores/${seller?.id}`} className="underline">{seller?.name}</Link></span>
        <span className="ml-auto text-xs text-zinc-400">1ª resposta: {fmtSeconds(conv.firstResponseSeconds)} · {conv.inboundCount} do lead / {conv.outboundCount} do vendedor</span>
      </div>
      <div className="grid md:grid-cols-5 gap-4">
        <Card className="md:col-span-3 bg-zinc-50">
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {msgs.length === 0 ? <p className="text-sm text-zinc-400 text-center py-6">Sem mensagens.</p> : msgs.map((m) => <Bubble key={m.id} m={m} />)}
          </div>
        </Card>
        <div className="md:col-span-2 space-y-4">
          <Card title="Análise" action={<AnalyzeButton conversationId={id} />}>
            {!insight ? (
              <p className="text-sm text-zinc-400">{conv.needsAnalysis ? `Aguardando ${""}a conversa assentar para analisar (ou clique em "Analisar agora").` : "Conversa curta demais para análise."}</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 flex-wrap"><StageBadge stage={insight.stage} /><span className="text-xs text-zinc-400">urgência {insight.urgency} · sentimento {insight.sentiment}</span><span className="ml-auto text-xs text-zinc-400">{fmtRelative(insight.analyzedAt)}{conv.needsAnalysis ? " · há mensagens novas" : ""}</span></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="text-xs text-zinc-500">Lead</div><Score value={insight.leadScore} /></div>
                  <div><div className="text-xs text-zinc-500">Atendimento</div><Score value={insight.sellerScore} /></div>
                </div>
                <p>{insight.summary}</p>
                {insight.intent && <p><span className="text-zinc-500">Quer:</span> {insight.intent}</p>}
                {insight.interest && <p><span className="text-zinc-500">Interesse:</span> {insight.interest}</p>}
                {insight.budgetMentioned && <p><span className="text-zinc-500">Orçamento:</span> {insight.budgetMentioned}</p>}
                {insight.objections.length > 0 && <p><span className="text-zinc-500">Objeções:</span> {insight.objections.join("; ")}</p>}
                {insight.lostReason && <p><span className="text-zinc-500">Motivo da perda:</span> {insight.lostReason}</p>}
                {insight.nextStep && <p><span className="text-zinc-500">Próximo passo:</span> {insight.nextStep}</p>}
                {insight.followupNeeded && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-amber-900">
                    <div className="text-xs font-semibold">Follow up recomendado</div>
                    <div>{insight.followupSuggestion}</div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div><div className="text-xs font-semibold text-emerald-700 mb-1">Pontos fortes</div><ul className="list-disc ml-4 space-y-0.5 text-xs">{insight.sellerStrengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
                  <div><div className="text-xs font-semibold text-red-700 mb-1">Melhorar</div><ul className="list-disc ml-4 space-y-0.5 text-xs">{insight.sellerImprovements.map((s) => <li key={s}>{s}</li>)}</ul></div>
                </div>
                <div className="text-xs text-zinc-400">qualificou: {insight.askedQualifyingQuestions ? "sim" : "não"} · tentou fechar: {insight.attemptedClose ? "sim" : "não"}</div>
              </div>
            )}
          </Card>
          {conv.adContext && (
            <Card title="Origem: anúncio">
              <div className="text-sm space-y-1">
                {conv.adContext.title && <p className="font-medium">{conv.adContext.title}</p>}
                {conv.adContext.body && <p className="text-zinc-600">{conv.adContext.body}</p>}
                {conv.adContext.sourceUrl && <p className="text-xs text-zinc-400 break-all">{conv.adContext.sourceUrl}</p>}
                {conv.adContext.ctwaClid && <p className="text-xs text-zinc-400">ctwa_clid: {conv.adContext.ctwaClid}</p>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
