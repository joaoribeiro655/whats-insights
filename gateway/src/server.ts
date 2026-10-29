import { timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import { config } from './config.js';
import { logger } from './logger.js';
import { outbound } from './outbound.js';
import { ensureInstance, getInstance, getQrDataUrl, isValidInstanceId, listInstances, removeInstance } from './wa.js';

function tokenOk(header: unknown) {
  if (typeof header !== 'string') return false;
  const a = Buffer.from(header);
  const b = Buffer.from(config.gatewayToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildServer() {
  const app = Fastify({ loggerInstance: logger });

  app.get('/health', async () => ({ ok: true, instances: listInstances().length, outboundQueue: outbound.size() }));

  app.addHook('onRequest', async (req, reply) => {
    if (req.url === '/health') return;
    if (!tokenOk(req.headers['x-gateway-token'])) {
      return reply.code(401).send({ error: 'token inválido' });
    }
  });

  app.get('/instances', async () => ({ instances: listInstances() }));

  app.post<{ Body: { id?: string } }>('/instances', async (req, reply) => {
    const id = req.body?.id;
    if (!id || !isValidInstanceId(id)) return reply.code(400).send({ error: 'id inválido (use [a-zA-Z0-9_-], até 64 chars)' });
    return ensureInstance(id);
  });

  app.get<{ Params: { id: string } }>('/instances/:id', async (req, reply) => {
    const st = getInstance(req.params.id);
    if (!st) return reply.code(404).send({ error: 'instância não encontrada' });
    return st;
  });

  app.get<{ Params: { id: string } }>('/instances/:id/qr', async (req, reply) => {
    if (!getInstance(req.params.id)) return reply.code(404).send({ error: 'instância não encontrada' });
    return getQrDataUrl(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/instances/:id', async (req, reply) => {
    const ok = await removeInstance(req.params.id);
    if (!ok) return reply.code(404).send({ error: 'instância não encontrada' });
    return { ok: true };
  });

  return app;
}
