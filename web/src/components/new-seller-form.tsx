"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewSellerForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/sellers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "erro"); return; }
    router.push(`/vendedores/${data.seller.id}`);
  }

  return (
    <form onSubmit={submit} className="flex gap-2 items-center">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do vendedor" className="border border-zinc-300 rounded-md px-3 py-1.5 text-sm w-56" required />
      <button disabled={busy} className="text-sm px-3 py-1.5 rounded-md bg-zinc-900 text-white disabled:opacity-50">{busy ? "Criando…" : "Adicionar e gerar QR"}</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </form>
  );
}
