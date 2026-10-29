import { createHmac } from 'node:crypto';
import { config } from './config.js';
import { logger } from './logger.js';
import type { NormalizedMessage } from './normalize.js';

export type GatewayEvent =
  | { type: 'connection.update'; instanceId: string; status: string; phone: string | null; name: string | null; at: string }
  | { type: 'messages.upsert'; instanceId: string; source: 'live' | 'history'; messages: NormalizedMessage[]; at: string }
  | { type: 'contacts.upsert'; instanceId: string; contacts: { phoneJid: string | null; lidJid: string | null; name: string | null; pushName: string | null }[]; at: string };

const MAX_QUEUE = 50_000;
const FLUSH_MS = 400;
const MAX_BATCH = 100;
const MAX_ATTEMPTS = 12;

/**
 * Fila em memória que entrega eventos ao backend em lotes, assinados com HMAC.
 * Retenta com backoff exponencial; depois de MAX_ATTEMPTS descarta e loga.
 */
class Outbound {
  private queue: GatewayEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private sending = false;

  push(ev: GatewayEvent) {
    if (this.queue.length >= MAX_QUEUE) {
      logger.error({ dropped: ev.type }, 'fila de saída cheia, descartando evento');
      return;
    }
    this.queue.push(ev);
    if (!this.timer) this.timer = setTimeout(() => void this.flush(), FLUSH_MS);
  }

  private async flush() {
    this.timer = null;
    if (this.sending) return;
    this.sending = true;
    try {
      while (this.queue.length) {
        const batch = this.queue.splice(0, MAX_BATCH);
        await this.deliver(batch);
      }
    } finally {
      this.sending = false;
      if (this.queue.length && !this.timer) this.timer = setTimeout(() => void this.flush(), FLUSH_MS);
    }
  }

  private async deliver(batch: GatewayEvent[]) {
    const body = JSON.stringify({ events: batch });
    const ts = String(Date.now());
    const sig = createHmac('sha256', config.ingestSecret).update(`${ts}.${body}`).digest('hex');
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(config.ingestUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-gateway-timestamp': ts,
            'x-gateway-signature': `sha256=${sig}`,
          },
          body,
          signal: AbortSignal.timeout(30_000),
        });
        if (res.ok) return;
        // 4xx (exceto 408/429) é erro nosso, não adianta retentar.
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          logger.error({ status: res.status, text: await res.text().catch(() => '') }, 'backend rejeitou o lote');
          return;
        }
        logger.warn({ status: res.status, attempt }, 'backend indisponível, retentando');
      } catch (err) {
        logger.warn({ err: (err as Error).message, attempt }, 'falha ao entregar lote');
      }
      await new Promise((r) => setTimeout(r, Math.min(300_000, 1000 * 2 ** attempt)));
    }
    logger.error({ size: batch.length }, 'lote descartado após esgotar tentativas');
  }

  size() {
    return this.queue.length;
  }
}

export const outbound = new Outbound();
