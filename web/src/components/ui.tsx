import Link from "next/link";
import { STAGE_LABEL, STATUS_LABEL } from "@/lib/format";

export function Card({ title, children, className = "", action }: { title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`bg-white border border-zinc-200 rounded-xl p-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, tone = "neutral" }: { label: string; value: string | number; hint?: string; tone?: "neutral" | "good" | "bad" | "warn" }) {
  const color = { neutral: "text-zinc-900", good: "text-emerald-700", bad: "text-red-700", warn: "text-amber-700" }[tone];
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-xs text-zinc-400 mt-1">{hint}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    open: "bg-emerald-100 text-emerald-800", qr: "bg-amber-100 text-amber-800", connecting: "bg-amber-100 text-amber-800",
    starting: "bg-zinc-100 text-zinc-700", closed: "bg-amber-100 text-amber-800", logged_out: "bg-zinc-200 text-zinc-700",
    forbidden: "bg-red-100 text-red-800", gateway_offline: "bg-red-100 text-red-800",
  };
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${tone[status] ?? "bg-zinc-100 text-zinc-700"}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return <span className="text-xs text-zinc-400">sem análise</span>;
  const tone: Record<string, string> = {
    novo: "bg-sky-100 text-sky-800", qualificando: "bg-indigo-100 text-indigo-800", proposta: "bg-violet-100 text-violet-800",
    negociacao: "bg-amber-100 text-amber-800", ganho: "bg-emerald-100 text-emerald-800", perdido: "bg-red-100 text-red-800",
    sem_resposta: "bg-orange-100 text-orange-800", nao_lead: "bg-zinc-100 text-zinc-600",
  };
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${tone[stage] ?? "bg-zinc-100"}`}>{STAGE_LABEL[stage] ?? stage}</span>;
}

export function Score({ value, label }: { value: number | null; label?: string }) {
  if (value == null) return <span className="text-xs text-zinc-400">–</span>;
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="h-1.5 flex-1 bg-zinc-200 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${value}%` }} /></div>
      <span className="text-xs tabular-nums w-7 text-right">{Math.round(value)}</span>
      {label && <span className="text-xs text-zinc-400">{label}</span>}
    </div>
  );
}

export function PeriodTabs({ current, basePath, extra = {} }: { current: number; basePath: string; extra?: Record<string, string | undefined> }) {
  const opts = [7, 14, 30, 90];
  const qs = (d: number) => {
    const p = new URLSearchParams();
    Object.entries(extra).forEach(([k, v]) => v && p.set(k, v));
    p.set("dias", String(d));
    return `${basePath}?${p.toString()}`;
  };
  return (
    <div className="flex gap-1 text-sm">
      {opts.map((d) => (
        <Link key={d} href={qs(d)} className={`px-3 py-1 rounded-md border ${d === current ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>{d} dias</Link>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-400 py-6 text-center">{children}</p>;
}
