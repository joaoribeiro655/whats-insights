import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db, organizations } from "@/db";
import { decrypt, encrypt, maskKey } from "./crypto";
import { env } from "./env";

export async function getOrgSettings(orgId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) throw new Error("organização não encontrada");
  let apiKey: string | null = null;
  if (org.anthropicApiKeyEnc) {
    try { apiKey = decrypt(org.anthropicApiKeyEnc); } catch { apiKey = null; }
  }
  const envKey = process.env.ANTHROPIC_API_KEY ?? null;
  return {
    org,
    apiKey: apiKey ?? envKey,
    apiKeySource: apiKey ? ("banco" as const) : envKey ? ("ambiente" as const) : ("nenhuma" as const),
    apiKeyMasked: apiKey ? maskKey(apiKey) : envKey ? maskKey(envKey) : null,
    model: org.anthropicModel ?? env.anthropicModel,
    salesContext: org.salesContext ?? "",
  };
}

export async function saveOrgSettings(orgId: string, patch: { apiKey?: string | null; model?: string | null; salesContext?: string | null }) {
  const set: Partial<typeof organizations.$inferInsert> = {};
  if (patch.apiKey !== undefined) set.anthropicApiKeyEnc = patch.apiKey ? encrypt(patch.apiKey.trim()) : null;
  if (patch.model !== undefined) set.anthropicModel = patch.model?.trim() || null;
  if (patch.salesContext !== undefined) set.salesContext = patch.salesContext?.trim() || null;
  if (Object.keys(set).length) await db.update(organizations).set(set).where(eq(organizations.id, orgId));
}

/** Cliente da Anthropic com a chave da organização (banco) ou do ambiente. */
export async function anthropicClientFor(orgId: string) {
  const s = await getOrgSettings(orgId);
  if (!s.apiKey) throw new Error("Chave da Anthropic não configurada. Cole a chave em Configurações.");
  return { client: new Anthropic({ apiKey: s.apiKey }), model: s.model };
}

/** Valida a chave sem gastar tokens: consulta o modelo. */
export async function testAnthropicKey(apiKey: string, model: string) {
  const client = new Anthropic({ apiKey });
  const m = await client.models.retrieve(model);
  return { ok: true, model: m.id, displayName: m.display_name };
}
