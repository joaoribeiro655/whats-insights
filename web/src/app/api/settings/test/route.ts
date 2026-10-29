import { NextResponse } from "next/server";
import { getDefaultOrg } from "@/lib/org";
import { getOrgSettings, testAnthropicKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Testa a chave informada (ou a salva) consultando o modelo. Não gasta tokens. */
export async function POST(req: Request) {
  const org = await getDefaultOrg();
  const body = (await req.json().catch(() => ({}))) as { apiKey?: string; model?: string };
  const s = await getOrgSettings(org.id);
  const apiKey = body.apiKey?.trim() || s.apiKey;
  const model = body.model?.trim() || s.model;
  if (!apiKey) return NextResponse.json({ error: "Nenhuma chave informada" }, { status: 400 });
  try {
    const r = await testAnthropicKey(apiKey, model);
    return NextResponse.json(r);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    const msg = e.status === 401 ? "Chave inválida (401)" : e.status === 404 ? `Modelo "${model}" não encontrado` : e.message ?? "falhou";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
