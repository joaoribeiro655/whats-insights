import { NextResponse } from "next/server";
import { analyzeConversation } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const out = await analyzeConversation(id);
    if (!out) return NextResponse.json({ error: "conversa curta demais ou sem mensagens do contato" }, { status: 422 });
    return NextResponse.json({ ok: true, insight: out });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
