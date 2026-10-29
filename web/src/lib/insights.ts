import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { and, asc, eq, lt, sql as dsql } from "drizzle-orm";
import { z } from "zod";
import { contacts, conversationInsights, conversations, db, messages, organizations, sellers } from "@/db";
import { env } from "./env";
import { anthropicClientFor } from "./settings";

export const InsightSchema = z.object({
  lead: z.object({
    score: z.number().int().min(0).max(100).describe("0 a 100: probabilidade de virar venda"),
    stage: z.enum(["novo", "qualificando", "proposta", "negociacao", "ganho", "perdido", "sem_resposta", "nao_lead"])
      .describe("nao_lead = conversa pessoal, fornecedor, spam ou algo que não é um cliente em potencial"),
    intent: z.string().describe("o que o lead quer, em uma frase"),
    interest: z.string().nullable().describe("produto/serviço de interesse"),
    urgency: z.enum(["baixa", "media", "alta"]),
    budget_mentioned: z.string().nullable().describe("valor ou faixa de orçamento citada, se houver"),
    objections: z.array(z.string()).describe("objeções levantadas pelo lead"),
    lost_reason: z.string().nullable().describe("motivo de perda, se perdido"),
    sentiment: z.enum(["negativo", "neutro", "positivo"]),
  }),
  seller: z.object({
    score: z.number().int().min(0).max(100).describe("qualidade do atendimento, 0 a 100"),
    strengths: z.array(z.string()).max(4),
    improvements: z.array(z.string()).max(4).describe("melhorias concretas e acionáveis"),
    asked_qualifying_questions: z.boolean(),
    attempted_close: z.boolean().describe("tentou fechar ou propor um próximo passo claro"),
  }),
  summary: z.string().describe("resumo da conversa em até 3 frases"),
  next_step: z.string().nullable().describe("próximo passo combinado ou recomendado"),
  followup_needed: z.boolean().describe("true se o vendedor precisa agir agora (lead sem resposta, promessa pendente, etc)"),
  followup_suggestion: z.string().nullable().describe("sugestão objetiva do que o vendedor deve fazer/dizer"),
});
export type Insight = z.infer<typeof InsightSchema>;

const SYSTEM = `Você é um analista sênior de vendas por WhatsApp. Você recebe a transcrição de uma conversa entre um VENDEDOR e um CONTATO e devolve uma avaliação estruturada, em português do Brasil, objetiva e útil para o gestor comercial.

Regras:
- Avalie o lead (intenção, etapa do funil, urgência, objeções) e o atendimento do vendedor (tempo de resposta, clareza, perguntas de qualificação, condução ao fechamento, tom).
- Seja justo: mensagens de áudio aparecem como [áudio Xs] e não têm texto; não penalize o vendedor por conteúdo que você não vê, mas registre se ele depende demais de áudio.
- Se a conversa não for comercial (amigo, família, fornecedor, spam), marque stage = nao_lead, score baixo e seja breve.
- "followup_needed" deve ser true quando a última mensagem é do contato e ficou sem resposta, ou quando há uma promessa do vendedor pendente.
- Melhorias devem ser concretas ("responder em até 10 min no primeiro contato", "perguntar prazo e orçamento antes de mandar preço"), nunca genéricas.
- Nunca invente fatos que não estão na transcrição.`;

function fmtDuration(s: number | null) {
  if (!s) return "";
  return s >= 60 ? `${Math.round(s / 60)}min` : `${s}s`;
}

export function buildTranscript(rows: { direction: string; type: string; text: string | null; sentAt: Date; mediaDurationSeconds: number | null }[], tz: string) {
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return rows.map((m) => {
    const who = m.direction === "out" ? "VENDEDOR" : "CONTATO";
    let body = m.text ?? "";
    if (m.type === "audio") body = `[áudio ${fmtDuration(m.mediaDurationSeconds)}]`;
    else if (m.type === "image") body = `[imagem]${m.text ? ` ${m.text}` : ""}`;
    else if (m.type === "video") body = `[vídeo]${m.text ? ` ${m.text}` : ""}`;
    else if (m.type === "document") body = `[documento${m.text ? `: ${m.text}` : ""}]`;
    else if (m.type === "sticker") body = "[figurinha]";
    else if (m.type === "location") body = `[localização${m.text ? `: ${m.text}` : ""}]`;
    else if (m.type === "contact") body = `[contato${m.text ? `: ${m.text}` : ""}]`;
    else if (!body) body = `[${m.type}]`;
    return `[${fmt.format(m.sentAt)}] ${who}: ${body}`;
  }).join("\n");
}

export async function analyzeConversation(conversationId: string) {
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conv) throw new Error("conversa não encontrada");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, conv.orgId)).limit(1);
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, conv.sellerId)).limit(1);
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, conv.contactId)).limit(1);
  const rows = await db.select().from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.revoked, false)))
    .orderBy(asc(messages.sentAt));
  if (rows.length < 2 || !rows.some((r) => r.direction === "in")) {
    await db.update(conversations).set({ needsAnalysis: false, analyzedMessageCount: rows.length, analyzedAt: new Date() }).where(eq(conversations.id, conversationId));
    return null;
  }

  const transcript = buildTranscript(rows, env.timezone);
  const adInfo = conv.adContext
    ? `Origem: anúncio (click to WhatsApp). Título: ${conv.adContext.title ?? "-"} | Texto: ${conv.adContext.body ?? "-"} | URL: ${conv.adContext.sourceUrl ?? "-"}`
    : "Origem: não identificada (contato direto, indicação ou histórico).";
  const firstResp = conv.firstResponseSeconds != null ? `${Math.round(conv.firstResponseSeconds / 60)} min` : "ainda sem resposta";

  const userPrompt = [
    org?.salesContext ? `Contexto da empresa:\n${org.salesContext}\n` : "",
    `Vendedor: ${seller?.name ?? "-"}`,
    `Contato: ${contact?.name ?? contact?.pushName ?? contact?.phone ?? "-"}`,
    adInfo,
    `Tempo até a primeira resposta do vendedor: ${firstResp}`,
    `Total de mensagens: ${rows.length} (${conv.inboundCount} do contato, ${conv.outboundCount} do vendedor)`,
    "",
    "Transcrição:",
    transcript,
  ].filter((l) => l !== "").join("\n");

  const { client, model } = await anthropicClientFor(conv.orgId);
  const response = await client.messages.parse({
    model,
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: zodOutputFormat(InsightSchema), effort: "medium" },
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    // Marca como analisada pra não ficar em loop; gestor vê "sem análise" na tela.
    await db.update(conversations).set({ needsAnalysis: false, analyzedMessageCount: rows.length, analyzedAt: new Date() }).where(eq(conversations.id, conversationId));
    return null;
  }
  const out = response.parsed_output;

  const values = {
    orgId: conv.orgId, sellerId: conv.sellerId, conversationId, model, analyzedAt: new Date(), messageCount: rows.length,
    leadScore: out.lead.score, stage: out.lead.stage, intent: out.lead.intent, interest: out.lead.interest, urgency: out.lead.urgency,
    budgetMentioned: out.lead.budget_mentioned, objections: out.lead.objections, lostReason: out.lead.lost_reason, sentiment: out.lead.sentiment,
    summary: out.summary, nextStep: out.next_step, followupNeeded: out.followup_needed, followupSuggestion: out.followup_suggestion,
    sellerScore: out.seller.score, sellerStrengths: out.seller.strengths, sellerImprovements: out.seller.improvements,
    askedQualifyingQuestions: out.seller.asked_qualifying_questions, attemptedClose: out.seller.attempted_close,
    raw: out as unknown as Record<string, unknown>,
    inputTokens: response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0),
    outputTokens: response.usage.output_tokens,
  };
  await db.insert(conversationInsights).values(values)
    .onConflictDoUpdate({ target: conversationInsights.conversationId, set: values });
  await db.update(conversations).set({ needsAnalysis: false, analyzedMessageCount: rows.length, analyzedAt: new Date() }).where(eq(conversations.id, conversationId));
  return out;
}

/** Seleciona conversas "assentadas" com mensagens novas e analisa em lote (concorrência limitada). */
export async function runAnalysisBatch(opts: { limit?: number; inactivityMinutes?: number; concurrency?: number } = {}) {
  const limit = opts.limit ?? env.analyzeBatchSize;
  const inactivity = opts.inactivityMinutes ?? env.analyzeInactivityMinutes;
  const concurrency = opts.concurrency ?? 3;
  const cutoff = new Date(Date.now() - inactivity * 60_000);

  const pending = await db.select({ id: conversations.id }).from(conversations)
    .where(and(eq(conversations.needsAnalysis, true), lt(conversations.lastMessageAt, cutoff), dsql`${conversations.inboundCount} > 0`))
    .orderBy(asc(conversations.lastMessageAt)).limit(limit);

  const results: { id: string; ok: boolean; error?: string }[] = [];
  let idx = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
    while (idx < pending.length) {
      const { id } = pending[idx++];
      try {
        await analyzeConversation(id);
        results.push({ id, ok: true });
      } catch (err) {
        results.push({ id, ok: false, error: (err as Error).message });
      }
    }
  }));
  return { selected: pending.length, results };
}
