import { NextResponse } from "next/server";
import { getDefaultOrg } from "@/lib/org";
import { getOrgSettings, saveOrgSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const org = await getDefaultOrg();
  const s = await getOrgSettings(org.id);
  return NextResponse.json({ apiKeyMasked: s.apiKeyMasked, apiKeySource: s.apiKeySource, model: s.model, salesContext: s.salesContext });
}

export async function POST(req: Request) {
  const org = await getDefaultOrg();
  const body = (await req.json().catch(() => ({}))) as { apiKey?: string | null; model?: string | null; salesContext?: string | null; clearApiKey?: boolean };
  if (body.apiKey && !body.apiKey.trim().startsWith("sk-ant-")) {
    return NextResponse.json({ error: "A chave da Anthropic começa com sk-ant-" }, { status: 400 });
  }
  await saveOrgSettings(org.id, {
    apiKey: body.clearApiKey ? null : body.apiKey?.trim() ? body.apiKey : undefined,
    model: body.model, salesContext: body.salesContext,
  });
  const s = await getOrgSettings(org.id);
  return NextResponse.json({ ok: true, apiKeyMasked: s.apiKeyMasked, apiKeySource: s.apiKeySource, model: s.model });
}
