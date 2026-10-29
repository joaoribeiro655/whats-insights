"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AnalyzeButton({ conversationId }: { conversationId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  async function run() {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/conversations/${conversationId}/analyze`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "falhou"); return; }
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={run} disabled={busy} className="text-xs px-3 py-1.5 rounded-md border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50">{busy ? "Analisando…" : "Analisar agora"}</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
