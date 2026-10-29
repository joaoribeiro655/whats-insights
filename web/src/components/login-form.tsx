"use client";

import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "falhou"); return; }
    window.location.href = next.startsWith("/") ? next : "/";
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha de acesso" autoFocus className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm" />
      <button disabled={busy || !password} className="w-full text-sm px-4 py-2 rounded-md bg-zinc-900 text-white disabled:opacity-50">{busy ? "Entrando…" : "Entrar"}</button>
      {err && <p className="text-sm text-red-700">{err}</p>}
    </form>
  );
}
