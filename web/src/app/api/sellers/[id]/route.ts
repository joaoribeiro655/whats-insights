import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, sellers } from "@/db";
import { gateway } from "@/lib/gateway";

export const dynamic = "force-dynamic";

/** Desconecta o WhatsApp (logout + apaga sessão). Mantém o histórico no banco. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, id)).limit(1);
  if (!seller) return NextResponse.json({ error: "vendedor não encontrado" }, { status: 404 });
  try {
    await gateway.remove(seller.instanceId);
  } catch (err) {
    const msg = (err as Error).message;
    if (!msg.includes("404")) return NextResponse.json({ error: msg }, { status: 502 });
  }
  await db.update(sellers).set({ status: "logged_out", lastStatusAt: new Date() }).where(eq(sellers.id, id));
  return NextResponse.json({ ok: true });
}

/** Reabre a instância (depois de logout ou restart). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, id)).limit(1);
  if (!seller) return NextResponse.json({ error: "vendedor não encontrado" }, { status: 404 });
  const inst = await gateway.create(seller.instanceId);
  return NextResponse.json({ ok: true, instance: inst });
}
