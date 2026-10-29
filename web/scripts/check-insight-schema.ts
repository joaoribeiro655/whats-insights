import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { InsightSchema, buildTranscript } from "@/lib/insights";
const fmt = zodOutputFormat(InsightSchema);
console.log("output_config.format type:", fmt.type, "| schema keys:", Object.keys((fmt as unknown as { schema: { properties: object } }).schema.properties));
const sample = { lead: { score: 72, stage: "negociacao", intent: "fechar consórcio de 80 mil", interest: "consórcio", urgency: "media", budget_mentioned: "R$ 500/mês", objections: ["taxa de administração alta"], lost_reason: null, sentiment: "positivo" },
  seller: { score: 65, strengths: ["respondeu rápido"], improvements: ["não deixar lead sem resposta por 2h"], asked_qualifying_questions: true, attempted_close: false },
  summary: "Lead veio de anúncio e pediu simulação.", next_step: "enviar simulação", followup_needed: true, followup_suggestion: "Mandar a simulação de 500/mês agora." };
console.log("parse ok:", InsightSchema.safeParse(sample).success);
console.log(buildTranscript([{ direction: "in", type: "text", text: "oi", sentAt: new Date("2026-10-29T15:00:00Z"), mediaDurationSeconds: null }, { direction: "out", type: "audio", text: null, sentAt: new Date("2026-10-29T15:05:00Z"), mediaDurationSeconds: 42 }], "America/Sao_Paulo"));
