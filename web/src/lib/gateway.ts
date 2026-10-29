import { env } from "./env";

export interface GatewayInstance {
  id: string;
  status: string;
  phone: string | null;
  name: string | null;
  hasQr: boolean;
  lastError: string | null;
  attempts: number;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.gatewayUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-gateway-token": env.gatewayToken, ...(init.headers ?? {}) },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`gateway ${path} -> ${res.status}: ${await res.text().catch(() => "")}`);
  return (await res.json()) as T;
}

export const gateway = {
  create: (id: string) => call<GatewayInstance>("/instances", { method: "POST", body: JSON.stringify({ id }) }),
  get: (id: string) => call<GatewayInstance>(`/instances/${id}`),
  qr: (id: string) => call<{ status: string; qr: string | null }>(`/instances/${id}/qr`),
  remove: (id: string) => call<{ ok: boolean }>(`/instances/${id}`, { method: "DELETE" }),
  health: () => call<{ ok: boolean; instances: number; outboundQueue: number }>("/health"),
};
