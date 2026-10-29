import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ingestEvents, type GatewayEvent } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verify(body: string, ts: string | null, sig: string | null) {
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() - Number(ts)) > 15 * 60_000) return false; // anti replay (15 min)
  const expected = `sha256=${createHmac("sha256", env.ingestSecret).update(`${ts}.${body}`).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!verify(body, req.headers.get("x-gateway-timestamp"), req.headers.get("x-gateway-signature"))) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }
  let events: GatewayEvent[];
  try {
    const parsed = JSON.parse(body) as { events?: GatewayEvent[] };
    events = Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }
  try {
    const result = await ingestEvents(events);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("ingest falhou", err);
    // 500 faz o gateway retentar o lote.
    return NextResponse.json({ error: "falha interna" }, { status: 500 });
  }
}
