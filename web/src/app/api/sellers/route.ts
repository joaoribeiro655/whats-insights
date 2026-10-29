import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db, sellers } from "@/db";
import { gateway } from "@/lib/gateway";
import { getDefaultOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

/** Cria o vendedor e já abre a instância no gateway (que começa a gerar QR). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "nome obrigatório" }, { status: 400 });
  const org = await getDefaultOrg();
  const instanceId = randomUUID();
  const [seller] = await db.insert(sellers).values({ orgId: org.id, name, instanceId }).returning();
  try {
    await gateway.create(instanceId);
  } catch (err) {
    return NextResponse.json({ seller, warning: `gateway indisponível: ${(err as Error).message}` }, { status: 201 });
  }
  return NextResponse.json({ seller }, { status: 201 });
}
