import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, sellers } from "@/db";
import { gateway } from "@/lib/gateway";

export const dynamic = "force-dynamic";

/** A tela faz polling aqui: devolve status atual e o QR (data URL) quando houver. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, id)).limit(1);
  if (!seller) return NextResponse.json({ error: "vendedor não encontrado" }, { status: 404 });
  try {
    let inst = await gateway.get(seller.instanceId).catch(() => null);
    if (!inst) inst = await gateway.create(seller.instanceId);
    if (inst.status === "open") {
      if (seller.status !== "open") await db.update(sellers).set({ status: "open", phone: inst.phone, waName: inst.name, lastStatusAt: new Date() }).where(eq(sellers.id, id));
      return NextResponse.json({ status: "open", phone: inst.phone, name: inst.name, qr: null });
    }
    const { status, qr } = await gateway.qr(seller.instanceId);
    return NextResponse.json({ status, qr, lastError: inst.lastError });
  } catch (err) {
    return NextResponse.json({ status: "gateway_offline", qr: null, error: (err as Error).message }, { status: 200 });
  }
}
