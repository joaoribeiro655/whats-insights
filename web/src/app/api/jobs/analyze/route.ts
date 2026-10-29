import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { purgeOldMessages } from "@/lib/ingest";
import { runAnalysisBatch } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(env.jobsSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Chamado por um scheduler (docker, cron, Vercel Cron). Analisa conversas pendentes e aplica retenção. */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const url = new URL(req.url);
  const inactivityMinutes = url.searchParams.get("inactivity") ? Number(url.searchParams.get("inactivity")) : undefined;
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
  const batch = await runAnalysisBatch({ inactivityMinutes, limit });
  const purged = await purgeOldMessages(env.retentionDays);
  return NextResponse.json({ ok: true, ...batch, purged });
}

export const GET = POST;
