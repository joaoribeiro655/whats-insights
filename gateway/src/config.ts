import path from 'node:path';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3100),
  host: process.env.HOST ?? '0.0.0.0',
  /** Token que o backend usa pra falar com o gateway (header x-gateway-token). */
  gatewayToken: required('GATEWAY_TOKEN'),
  /** URL do backend que recebe os eventos (POST). */
  ingestUrl: required('INGEST_URL'),
  /** Segredo compartilhado pra assinar os eventos (HMAC SHA256). */
  ingestSecret: required('INGEST_SECRET'),
  dataDir: path.resolve(process.env.DATA_DIR ?? './data'),
  /** Nome exibido em "Dispositivos conectados" no celular do vendedor. */
  deviceName: process.env.DEVICE_NAME ?? 'Insights',
  /** Pede o histórico completo no pareamento (igual ao WhatsApp Web no desktop). Sem isso o WhatsApp manda só as conversas recentes. */
  syncFullHistory: (process.env.SYNC_FULL_HISTORY ?? 'true') !== 'false',
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
