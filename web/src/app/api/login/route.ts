import { NextResponse } from "next/server";
import { AUTH_COOKIE, dashboardPassword, expectedToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const pw = dashboardPassword();
  if (!pw) return NextResponse.json({ error: "DASHBOARD_PASSWORD não configurada no servidor" }, { status: 503 });
  const given = body.password ?? "";
  // comparação em tempo constante
  let diff = given.length ^ pw.length;
  for (let i = 0; i < Math.max(given.length, pw.length); i++) diff |= (given.charCodeAt(i) || 0) ^ (pw.charCodeAt(i) || 0);
  if (diff !== 0) {
    await new Promise((r) => setTimeout(r, 400)); // freia força bruta
    return NextResponse.json({ error: "senha incorreta" }, { status: 401 });
  }
  const token = (await expectedToken())!;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
