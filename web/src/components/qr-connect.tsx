"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABEL } from "@/lib/format";

interface QrState { status: string; qr: string | null; phone?: string | null; name?: string | null; lastError?: string | null; error?: string }

/** Faz polling do QR até conectar. Quando conectar, recarrega a página (server component atualiza). */
export function QrConnect({ sellerId, initialStatus }: { sellerId: string; initialStatus: string }) {
  const [state, setState] = useState<QrState>({ status: initialStatus, qr: null });
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/sellers/${sellerId}/qr`, { cache: "no-store" });
        const data = (await res.json()) as QrState;
        if (!alive) return;
        setState(data);
        if (data.status === "open") { router.refresh(); return; }
      } catch {
        if (alive) setState((s) => ({ ...s, status: "gateway_offline" }));
      }
      timer = setTimeout(tick, 4000);
    };
    void tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [sellerId, router]);

  async function disconnect() {
    if (!confirm("Desconectar o WhatsApp deste vendedor? O histórico já coletado continua no banco.")) return;
    setBusy(true);
    await fetch(`/api/sellers/${sellerId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }
  async function reconnect() {
    setBusy(true);
    await fetch(`/api/sellers/${sellerId}`, { method: "POST" });
    setBusy(false);
    setState({ status: "starting", qr: null });
  }

  if (state.status === "open") {
    return (
      <div className="flex items-center gap-4">
        <div className="text-sm">
          <div className="font-medium text-emerald-700">Conectado</div>
          <div className="text-zinc-500">{state.name ?? ""} {state.phone ? `· +${state.phone}` : ""}</div>
        </div>
        <button onClick={disconnect} disabled={busy} className="ml-auto text-sm px-3 py-1.5 rounded-md border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50">Desconectar</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      <div className="w-64 h-64 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center justify-center overflow-hidden">
        {state.qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.qr} alt="QR code do WhatsApp" className="w-full h-full" />
        ) : (
          <span className="text-xs text-zinc-400 px-4 text-center">{STATUS_LABEL[state.status] ?? state.status}…</span>
        )}
      </div>
      <div className="text-sm space-y-2 flex-1">
        <p className="font-medium">Como conectar</p>
        <ol className="list-decimal ml-5 space-y-1 text-zinc-600">
          <li>No celular do vendedor, abra o WhatsApp.</li>
          <li>Toque em <b>Mais opções</b> (⋮) → <b>Dispositivos conectados</b> → <b>Conectar dispositivo</b>.</li>
          <li>Aponte a câmera para o QR code ao lado.</li>
        </ol>
        <p className="text-xs text-zinc-400">O QR expira em ~1 min e é renovado sozinho. A conexão é somente leitura: a plataforma nunca envia mensagens.</p>
        {state.status === "gateway_offline" && <p className="text-xs text-red-600">Gateway fora do ar. Verifique o serviço <code>gateway</code>.</p>}
        {state.status === "forbidden" && <p className="text-xs text-red-600">O WhatsApp recusou a conexão (403). Pode indicar bloqueio do número.</p>}
        {state.lastError && state.status !== "qr" && <p className="text-xs text-zinc-400">Último erro: {state.lastError}</p>}
        {(state.status === "logged_out" || state.status === "forbidden") && (
          <button onClick={reconnect} disabled={busy} className="text-sm px-3 py-1.5 rounded-md bg-zinc-900 text-white disabled:opacity-50">Gerar novo QR</button>
        )}
      </div>
    </div>
  );
}
