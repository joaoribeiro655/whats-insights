"use client";

import { useState } from "react";

interface Props { apiKeyMasked: string | null; apiKeySource: "banco" | "ambiente" | "nenhuma"; model: string; salesContext: string }

export function SettingsForm(initial: Props) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial.model);
  const [salesContext, setSalesContext] = useState(initial.salesContext);
  const [masked, setMasked] = useState(initial.apiKeyMasked);
  const [source, setSource] = useState(initial.apiKeySource);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save"); setMsg(null);
    const res = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey: apiKey || undefined, model, salesContext }) });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setMsg({ ok: false, text: data.error ?? "erro ao salvar" }); return; }
    setMasked(data.apiKeyMasked); setSource(data.apiKeySource); setApiKey("");
    setMsg({ ok: true, text: "Configurações salvas." });
  }

  async function test() {
    setBusy("test"); setMsg(null);
    const res = await fetch("/api/settings/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey: apiKey || undefined, model }) });
    const data = await res.json();
    setBusy(null);
    setMsg(res.ok ? { ok: true, text: `Chave válida. Modelo: ${data.displayName ?? data.model}.` } : { ok: false, text: data.error ?? "falhou" });
  }

  async function clear() {
    if (!confirm("Remover a chave salva?")) return;
    const res = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clearApiKey: true }) });
    const data = await res.json();
    setMasked(data.apiKeyMasked); setSource(data.apiKeySource);
    setMsg({ ok: true, text: "Chave removida." });
  }

  const input = "w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white";
  return (
    <form onSubmit={save} className="space-y-6 max-w-2xl">
      <section className="space-y-2">
        <label className="block text-sm font-medium">Chave da API da Anthropic</label>
        <p className="text-xs text-zinc-500">
          Crie em <span className="font-mono">console.anthropic.com</span> → API Keys. A chave fica criptografada no banco e é usada só pela análise das conversas.
          {masked && <> Chave atual: <span className="font-mono">{masked}</span> ({source === "banco" ? "salva na plataforma" : "do ambiente do servidor"}).</>}
        </p>
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={masked ? "cole uma nova chave pra substituir" : "sk-ant-..."} className={`${input} font-mono`} autoComplete="off" />
        <div className="flex gap-2">
          <button type="button" onClick={test} disabled={busy !== null} className="text-sm px-3 py-1.5 rounded-md border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50">{busy === "test" ? "Testando…" : "Testar chave"}</button>
          {source === "banco" && <button type="button" onClick={clear} className="text-sm px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50">Remover chave salva</button>}
        </div>
      </section>
      <section className="space-y-2">
        <label className="block text-sm font-medium">Modelo</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} className={`${input} font-mono`} />
        <p className="text-xs text-zinc-500">Padrão: claude-opus-5-5. Pra baratear use claude-sonnet-5-5.</p>
      </section>
      <section className="space-y-2">
        <label className="block text-sm font-medium">Contexto comercial (entra no prompt da análise)</label>
        <textarea value={salesContext} onChange={(e) => setSalesContext(e.target.value)} rows={8} className={input} placeholder={"Ex: Vendemos consórcio de imóveis e veículos. Ticket médio R$ 80 mil. Etapas: contato → simulação → proposta → assinatura. Resposta ideal em até 10 min. Objeções comuns: taxa de administração, prazo de contemplação."} />
        <p className="text-xs text-zinc-500">Quanto mais específico (produto, preços, script, o que é um lead bom), melhor a nota do lead e as sugestões pro vendedor.</p>
      </section>
      <div className="flex items-center gap-3">
        <button disabled={busy !== null} className="text-sm px-4 py-2 rounded-md bg-zinc-900 text-white disabled:opacity-50">{busy === "save" ? "Salvando…" : "Salvar"}</button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
