import {
  getContentType,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
  isLidUser,
  isPnUser,
  jidNormalizedUser,
  normalizeMessageContent,
  toNumber,
  type WAMessage,
  type proto,
} from 'baileys';

export type MessageType =
  | 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker'
  | 'location' | 'contact' | 'poll' | 'other';

export interface AdContext {
  title: string | null;
  body: string | null;
  sourceType: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  mediaUrl: string | null;
  ctwaClid: string | null;
  conversionSource: string | null;
  entryPointConversionSource: string | null;
  entryPointConversionApp: string | null;
}

export interface NormalizedMessage {
  /** id da mensagem no WhatsApp (key.id) */
  waMessageId: string;
  /** jid de telefone do contato (xxx@s.whatsapp.net), se conhecido */
  phoneJid: string | null;
  /** jid LID do contato (xxx@lid), se conhecido */
  lidJid: string | null;
  fromMe: boolean;
  /** ISO 8601 */
  timestamp: string;
  type: MessageType;
  text: string | null;
  pushName: string | null;
  mediaMimetype: string | null;
  mediaDurationSeconds: number | null;
  quotedMessageId: string | null;
  adContext: AdContext | null;
  /** true se a mensagem foi apagada pra todos */
  revoked: boolean;
}

/** Diz se o chat é uma conversa 1:1 que vale a pena analisar. */
export function isIndividualChat(jid: string | undefined | null): boolean {
  if (!jid) return false;
  if (isJidGroup(jid) || isJidBroadcast(jid) || isJidNewsletter(jid) || isJidStatusBroadcast(jid)) return false;
  return Boolean(isPnUser(jid) || isLidUser(jid));
}

/** Separa remoteJid/remoteJidAlt em (telefone, lid). */
export function resolveIds(key: WAMessage['key']): { phoneJid: string | null; lidJid: string | null } {
  const a = key.remoteJid ?? null;
  const b = key.remoteJidAlt ?? null;
  let phoneJid: string | null = null;
  let lidJid: string | null = null;
  for (const j of [a, b]) {
    if (!j) continue;
    if (isPnUser(j)) phoneJid = jidNormalizedUser(j);
    else if (isLidUser(j)) lidJid = jidNormalizedUser(j);
  }
  return { phoneJid, lidJid };
}

function pickAdContext(ctx: proto.IContextInfo | null | undefined): AdContext | null {
  if (!ctx) return null;
  const ad = ctx.externalAdReply;
  const hasAd = Boolean(ad && (ad.sourceUrl || ad.sourceId || ad.title || ad.ctwaClid));
  const hasConversion = Boolean(ctx.conversionSource || ctx.entryPointConversionSource);
  if (!hasAd && !hasConversion) return null;
  return {
    title: ad?.title ?? null,
    body: ad?.body ?? null,
    sourceType: ad?.sourceType ?? null,
    sourceId: ad?.sourceId ?? null,
    sourceUrl: ad?.sourceUrl ?? null,
    mediaUrl: ad?.mediaUrl ?? null,
    ctwaClid: ad?.ctwaClid ?? null,
    conversionSource: ctx.conversionSource ?? null,
    entryPointConversionSource: ctx.entryPointConversionSource ?? null,
    entryPointConversionApp: ctx.entryPointConversionApp ?? null,
  };
}

/**
 * Converte uma WAMessage do Baileys no formato neutro que o backend entende.
 * Retorna null para mensagens sem valor analítico (reações, protocolo, etc).
 */
export function normalizeMessage(msg: WAMessage): NormalizedMessage | null {
  const key = msg.key;
  if (!key?.id || !isIndividualChat(key.remoteJid)) return null;

  const content = normalizeMessageContent(msg.message);
  const ctype = content ? getContentType(content) : undefined;
  const ts = toNumber(msg.messageTimestamp ?? 0);
  const timestamp = new Date((ts || Math.floor(Date.now() / 1000)) * 1000).toISOString();
  const { phoneJid, lidJid } = resolveIds(key);
  const base = {
    waMessageId: key.id,
    phoneJid,
    lidJid,
    fromMe: Boolean(key.fromMe),
    timestamp,
    pushName: msg.pushName ?? null,
    mediaMimetype: null as string | null,
    mediaDurationSeconds: null as number | null,
    quotedMessageId: null as string | null,
    adContext: null as AdContext | null,
    revoked: false,
  };

  // Mensagem apagada pra todos chega como protocolMessage REVOKE apontando pra key original.
  if (ctype === 'protocolMessage') {
    const p = content?.protocolMessage;
    if (p?.type === 0 /* REVOKE */ && p.key?.id) {
      return { ...base, waMessageId: p.key.id, type: 'other', text: null, revoked: true };
    }
    return null;
  }
  if (!content || !ctype) return null;

  let type: MessageType = 'other';
  let text: string | null = null;
  let ctx: proto.IContextInfo | null | undefined;

  switch (ctype) {
    case 'conversation':
      type = 'text';
      text = content.conversation ?? null;
      break;
    case 'extendedTextMessage':
      type = 'text';
      text = content.extendedTextMessage?.text ?? null;
      ctx = content.extendedTextMessage?.contextInfo;
      break;
    case 'imageMessage':
      type = 'image';
      text = content.imageMessage?.caption ?? null;
      base.mediaMimetype = content.imageMessage?.mimetype ?? null;
      ctx = content.imageMessage?.contextInfo;
      break;
    case 'videoMessage':
      type = 'video';
      text = content.videoMessage?.caption ?? null;
      base.mediaMimetype = content.videoMessage?.mimetype ?? null;
      base.mediaDurationSeconds = content.videoMessage?.seconds ?? null;
      ctx = content.videoMessage?.contextInfo;
      break;
    case 'audioMessage':
      type = 'audio';
      base.mediaMimetype = content.audioMessage?.mimetype ?? null;
      base.mediaDurationSeconds = content.audioMessage?.seconds ?? null;
      ctx = content.audioMessage?.contextInfo;
      break;
    case 'documentMessage':
      type = 'document';
      text = content.documentMessage?.caption ?? content.documentMessage?.fileName ?? null;
      base.mediaMimetype = content.documentMessage?.mimetype ?? null;
      ctx = content.documentMessage?.contextInfo;
      break;
    case 'stickerMessage':
      type = 'sticker';
      break;
    case 'locationMessage':
    case 'liveLocationMessage':
      type = 'location';
      text = content.locationMessage?.name ?? content.locationMessage?.address ?? null;
      break;
    case 'contactMessage':
    case 'contactsArrayMessage':
      type = 'contact';
      text = content.contactMessage?.displayName ?? null;
      break;
    case 'pollCreationMessage':
    case 'pollCreationMessageV2':
    case 'pollCreationMessageV3':
      type = 'poll';
      text = content.pollCreationMessage?.name ?? null;
      break;
    case 'reactionMessage':
    case 'senderKeyDistributionMessage':
    case 'messageContextInfo':
    case 'pollUpdateMessage':
      return null;
    default:
      type = 'other';
  }

  base.quotedMessageId = ctx?.stanzaId ?? null;
  base.adContext = pickAdContext(ctx);
  return { ...base, type, text };
}
