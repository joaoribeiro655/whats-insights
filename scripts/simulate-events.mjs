// Simula o gateway: envia eventos assinados pro /api/ingest. Uso: node scripts/simulate-events.mjs <instanceId> [ingestUrl] [secret]
import { createHmac } from 'node:crypto';

const [instanceId, ingestUrl = 'http://localhost:3000/api/ingest', secret = 'devsecret'] = process.argv.slice(2);
if (!instanceId) { console.error('informe o instanceId'); process.exit(1); }

const now = Date.now();
const iso = (minAgo) => new Date(now - minAgo * 60_000).toISOString();
const msg = (o) => ({ waMessageId: o.id, phoneJid: o.phone ? `${o.phone}@s.whatsapp.net` : null, lidJid: o.lid ? `${o.lid}@lid` : null,
  fromMe: Boolean(o.fromMe), timestamp: iso(o.min), type: o.type ?? 'text', text: o.text ?? null, pushName: o.push ?? null,
  mediaMimetype: null, mediaDurationSeconds: o.dur ?? null, quotedMessageId: null, adContext: o.ad ?? null, revoked: Boolean(o.revoked) });

const ad = { title: 'Consórcio sem juros · parcelas a partir de R$ 390', body: 'Fale com um consultor', sourceType: 'ad', sourceId: '120210', sourceUrl: 'https://fb.me/abc', mediaUrl: null, ctwaClid: 'clid-1', conversionSource: 'FB_Ads', entryPointConversionSource: 'ctwa_ad', entryPointConversionApp: 'facebook' };

const events = [
  { type: 'connection.update', instanceId, status: 'open', phone: '5511999990000', name: 'Loja Teste', at: iso(0) },
  { type: 'contacts.upsert', instanceId, contacts: [{ phoneJid: '5511988880001@s.whatsapp.net', lidJid: '1001@lid', name: 'Mariana Souza', pushName: 'Mari' }], at: iso(0) },
  // Lead 1: veio de anúncio, respondido em 12 min, negociação em andamento, última msg do lead há 90 min (parada)
  { type: 'messages.upsert', instanceId, source: 'history', at: iso(0), messages: [
    msg({ id: 'm1', phone: '5511988880001', lid: '1001', min: 300, text: 'Oi, vi o anúncio do consórcio. Como funciona?', push: 'Mari', ad }),
    msg({ id: 'm2', phone: '5511988880001', fromMe: true, min: 288, text: 'Oi Mariana! Funciona assim: você escolhe o valor da carta e paga parcelas sem juros. Qual valor você tem em mente?' }),
    msg({ id: 'm3', phone: '5511988880001', min: 280, text: 'Uns 80 mil. Mas achei a taxa de administração alta' }),
    msg({ id: 'm4', phone: '5511988880001', fromMe: true, min: 270, type: 'audio', dur: 42 }),
    msg({ id: 'm5', phone: '5511988880001', min: 90, text: 'Consigo pagar 500 por mês? Me manda a simulação' }),
  ] },
  // Lead 2: chegou só por LID (telefone desconhecido ainda), sem resposta do vendedor há 3h
  { type: 'messages.upsert', instanceId, source: 'live', at: iso(0), messages: [
    msg({ id: 'm10', lid: '2002', min: 180, text: 'Boa tarde, vocês fazem financiamento de moto?', push: 'Carlos' }),
  ] },
  // Lead 3: ganho, respondido rápido, mensagem apagada no meio
  { type: 'messages.upsert', instanceId, source: 'live', at: iso(0), messages: [
    msg({ id: 'm20', phone: '5521977770003', min: 1500, text: 'Quero fechar o plano de 50 mil', push: 'Roberto' }),
    msg({ id: 'm21', phone: '5521977770003', fromMe: true, min: 1497, text: 'Boa Roberto! Te mando o contrato agora.' }),
    msg({ id: 'm22', phone: '5521977770003', fromMe: true, min: 1496, text: 'ops mensagem errada' }),
    msg({ id: 'm22', phone: '5521977770003', fromMe: true, min: 1495, revoked: true }),
    msg({ id: 'm23', phone: '5521977770003', min: 1400, text: 'Assinei, obrigado!' }),
    msg({ id: 'm24', phone: '5521977770003', fromMe: true, min: 1398, text: 'Perfeito, bem vindo!' }),
  ] },
  // Lead 2 de novo, agora o telefone apareceu junto com o LID (deve fundir no mesmo contato)
  { type: 'messages.upsert', instanceId, source: 'live', at: iso(0), messages: [
    msg({ id: 'm11', phone: '5531966660002', lid: '2002', min: 170, text: 'Alô?', push: 'Carlos' }),
  ] },
  // Duplicata (gateway reenviou o lote): não pode duplicar
  { type: 'messages.upsert', instanceId, source: 'live', at: iso(0), messages: [ msg({ id: 'm10', lid: '2002', min: 180, text: 'Boa tarde, vocês fazem financiamento de moto?', push: 'Carlos' }) ] },
];

const body = JSON.stringify({ events });
const ts = String(Date.now());
const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
const res = await fetch(ingestUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gateway-timestamp': ts, 'x-gateway-signature': `sha256=${sig}` }, body });
console.log(res.status, await res.text());

// assinatura errada deve dar 401
const bad = await fetch(ingestUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gateway-timestamp': ts, 'x-gateway-signature': 'sha256=00' }, body });
console.log('assinatura inválida ->', bad.status);
