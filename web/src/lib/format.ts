import { env } from "./env";

export function fmtSeconds(s: number | null | undefined) {
  if (s == null) return "–";
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} d`;
}

export function fmtDate(d: Date | string | null | undefined, withTime = true) {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: env.timezone, day: "2-digit", month: "2-digit", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : { year: "2-digit" }),
  }).format(date);
}

export function fmtRelative(d: Date | string | null | undefined) {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.round(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h atrás`;
  return `${Math.round(diff / 86400)} d atrás`;
}

export function fmtPhone(phone: string | null | undefined) {
  if (!phone) return "–";
  const m = phone.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${phone}`;
}

export const STAGE_LABEL: Record<string, string> = {
  novo: "Novo", qualificando: "Qualificando", proposta: "Proposta", negociacao: "Negociação",
  ganho: "Ganho", perdido: "Perdido", sem_resposta: "Sem resposta", nao_lead: "Não é lead",
};

export const STATUS_LABEL: Record<string, string> = {
  starting: "Iniciando", qr: "Aguardando QR", connecting: "Conectando", open: "Conectado",
  closed: "Reconectando", logged_out: "Desconectado", forbidden: "Bloqueado", gateway_offline: "Gateway offline",
};
