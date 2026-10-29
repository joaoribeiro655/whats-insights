import fs from 'node:fs/promises';
import path from 'node:path';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type WASocket,
} from 'baileys';
import { config } from './config.js';
import { logger } from './logger.js';
import { isIndividualChat, normalizeMessage } from './normalize.js';
import { outbound } from './outbound.js';

export type InstanceStatus = 'starting' | 'qr' | 'connecting' | 'open' | 'closed' | 'logged_out' | 'forbidden';

interface InstanceState {
  id: string;
  sock: WASocket | null;
  status: InstanceStatus;
  qr: string | null;
  phone: string | null;
  name: string | null;
  lastError: string | null;
  attempts: number;
  stopping: boolean;
  reconnectTimer: NodeJS.Timeout | null;
}

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const instances = new Map<string, InstanceState>();

export function isValidInstanceId(id: string) {
  return ID_RE.test(id);
}

function sessionDir(id: string) {
  return path.join(config.dataDir, 'sessions', id);
}

export function publicState(st: InstanceState) {
  return {
    id: st.id,
    status: st.status,
    phone: st.phone,
    name: st.name,
    hasQr: Boolean(st.qr),
    lastError: st.lastError,
    attempts: st.attempts,
  };
}

function emitConnection(st: InstanceState) {
  outbound.push({
    type: 'connection.update',
    instanceId: st.id,
    status: st.status,
    phone: st.phone,
    name: st.name,
    at: new Date().toISOString(),
  });
}

export function listInstances() {
  return [...instances.values()].map(publicState);
}

export function getInstance(id: string) {
  const st = instances.get(id);
  return st ? publicState(st) : null;
}

/** Cria (ou retoma) a instância. Idempotente. */
export async function ensureInstance(id: string) {
  if (!isValidInstanceId(id)) throw new Error('id inválido');
  let st = instances.get(id);
  if (st) return publicState(st);
  st = { id, sock: null, status: 'starting', qr: null, phone: null, name: null, lastError: null, attempts: 0, stopping: false, reconnectTimer: null };
  instances.set(id, st);
  await fs.mkdir(sessionDir(id), { recursive: true });
  void connect(st);
  return publicState(st);
}

async function connect(st: InstanceState) {
  if (st.stopping) return;
  const log = logger.child({ instance: st.id });
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir(st.id));
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
    const waLogger = logger.child({ instance: st.id, lib: 'baileys' });
    waLogger.level = 'warn';

    const sock = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, waLogger) },
      logger: waLogger,
      browser: Browsers.ubuntu(config.deviceName),
      // Somente leitura: nunca marcar online (senão o celular do vendedor para de notificar).
      markOnlineOnConnect: false,
      syncFullHistory: config.syncFullHistory,
      generateHighQualityLinkPreview: false,
      // Nunca reenviamos nada, então não há mensagens a recuperar.
      getMessage: async () => undefined,
      shouldSyncHistoryMessage: () => true,
    });
    st.sock = sock;
    st.status = 'connecting';

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
      if (u.qr) {
        st.qr = u.qr;
        if (st.status !== 'qr') {
          st.status = 'qr';
          emitConnection(st);
        }
      }
      if (u.connection === 'open') {
        st.status = 'open';
        st.qr = null;
        st.attempts = 0;
        st.lastError = null;
        const me = sock.user;
        st.phone = me?.id ? jidNormalizedUser(me.id).split('@')[0] : null;
        st.name = me?.name ?? null;
        log.info({ phone: st.phone }, 'conectado');
        emitConnection(st);
      }
      if (u.connection === 'close') {
        const code = (u.lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        st.lastError = u.lastDisconnect?.error?.message ?? null;
        st.sock = null;
        st.qr = null;
        log.warn({ code, err: st.lastError }, 'conexão fechada');

        if (st.stopping) return;
        if (code === DisconnectReason.loggedOut) {
          // Vendedor desconectou pelo celular: limpa a sessão e volta a pedir QR.
          st.status = 'logged_out';
          emitConnection(st);
          await fs.rm(sessionDir(st.id), { recursive: true, force: true });
          await fs.mkdir(sessionDir(st.id), { recursive: true });
          st.attempts = 0;
          scheduleReconnect(st, 1000);
          return;
        }
        if (code === DisconnectReason.forbidden) {
          // 403 costuma ser número banido. Não insistir.
          st.status = 'forbidden';
          emitConnection(st);
          return;
        }
        st.status = 'closed';
        emitConnection(st);
        const delay = code === DisconnectReason.restartRequired ? 500 : Math.min(60_000, 1000 * 2 ** Math.min(st.attempts, 6));
        st.attempts += 1;
        scheduleReconnect(st, delay);
      }
    });

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      const out = messages.map(normalizeMessage).filter((m): m is NonNullable<typeof m> => Boolean(m));
      if (!out.length) return;
      outbound.push({ type: 'messages.upsert', instanceId: st.id, source: type === 'notify' ? 'live' : 'history', messages: out, at: new Date().toISOString() });
    });

    sock.ev.on('messaging-history.set', ({ messages, contacts, isLatest }) => {
      log.info({ messages: messages.length, contacts: contacts.length, isLatest }, 'histórico recebido');
      pushContacts(st.id, contacts);
      const out = messages.map(normalizeMessage).filter((m): m is NonNullable<typeof m> => Boolean(m));
      for (let i = 0; i < out.length; i += 200) {
        outbound.push({ type: 'messages.upsert', instanceId: st.id, source: 'history', messages: out.slice(i, i + 200), at: new Date().toISOString() });
      }
    });

    sock.ev.on('contacts.upsert', (contacts) => pushContacts(st.id, contacts));
    sock.ev.on('contacts.update', (contacts) => pushContacts(st.id, contacts as { id?: string; lid?: string; phoneNumber?: string; name?: string; notify?: string }[]));
  } catch (err) {
    st.lastError = (err as Error).message;
    st.status = 'closed';
    log.error({ err }, 'falha ao iniciar socket');
    st.attempts += 1;
    scheduleReconnect(st, Math.min(60_000, 1000 * 2 ** Math.min(st.attempts, 6)));
  }
}

function pushContacts(instanceId: string, contacts: { id?: string; lid?: string; phoneNumber?: string; name?: string; notify?: string }[]) {
  const out = [];
  for (const c of contacts) {
    const ids = [c.id, c.lid, c.phoneNumber].filter(Boolean) as string[];
    if (!ids.some(isIndividualChat)) continue;
    const phoneJid = ids.find((j) => j.endsWith('@s.whatsapp.net')) ?? null;
    const lidJid = ids.find((j) => j.endsWith('@lid')) ?? null;
    if (!phoneJid && !lidJid) continue;
    if (!c.name && !c.notify && !phoneJid) continue;
    out.push({ phoneJid: phoneJid ? jidNormalizedUser(phoneJid) : null, lidJid: lidJid ? jidNormalizedUser(lidJid) : null, name: c.name ?? null, pushName: c.notify ?? null });
  }
  if (out.length) outbound.push({ type: 'contacts.upsert', instanceId, contacts: out, at: new Date().toISOString() });
}

function scheduleReconnect(st: InstanceState, delay: number) {
  if (st.reconnectTimer) clearTimeout(st.reconnectTimer);
  st.reconnectTimer = setTimeout(() => {
    st.reconnectTimer = null;
    void connect(st);
  }, delay);
}

/** Espera o Baileys emitir o QR e devolve como data URL PNG. */
export async function getQrDataUrl(id: string, timeoutMs = 15_000): Promise<{ status: InstanceStatus; qr: string | null }> {
  const st = instances.get(id);
  if (!st) throw new Error('instância não encontrada');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (st.status === 'open' || st.status === 'forbidden') return { status: st.status, qr: null };
    if (st.qr) return { status: st.status, qr: await QRCode.toDataURL(st.qr, { margin: 1, width: 512 }) };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { status: st.status, qr: null };
}

/** Desconecta de vez: faz logout no WhatsApp (some de "Dispositivos conectados") e apaga a sessão. */
export async function removeInstance(id: string) {
  const st = instances.get(id);
  if (!st) return false;
  st.stopping = true;
  if (st.reconnectTimer) clearTimeout(st.reconnectTimer);
  try {
    if (st.sock && st.status === 'open') await st.sock.logout('desconectado pela plataforma');
    else st.sock?.end(undefined);
  } catch (err) {
    logger.warn({ err, instance: id }, 'erro ao fazer logout');
  }
  instances.delete(id);
  await fs.rm(sessionDir(id), { recursive: true, force: true });
  st.status = 'logged_out';
  emitConnection(st);
  return true;
}

/** Na subida do processo, reconecta todas as sessões salvas em disco. */
export async function resumeSavedSessions() {
  const dir = path.join(config.dataDir, 'sessions');
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory() || !isValidInstanceId(e.name)) continue;
    const files = await fs.readdir(path.join(dir, e.name));
    if (!files.includes('creds.json')) continue; // nunca pareou, não vale reabrir sozinho
    logger.info({ instance: e.name }, 'retomando sessão salva');
    await ensureInstance(e.name);
  }
}

export async function shutdown() {
  for (const st of instances.values()) {
    st.stopping = true;
    if (st.reconnectTimer) clearTimeout(st.reconnectTimer);
    st.sock?.end(undefined);
  }
}
