function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

export const env = {
  get databaseUrl() { return req("DATABASE_URL"); },
  get gatewayUrl() { return req("GATEWAY_URL"); },
  get gatewayToken() { return req("GATEWAY_TOKEN"); },
  get ingestSecret() { return req("INGEST_SECRET"); },
  get jobsSecret() { return req("JOBS_SECRET"); },
  /** chave que criptografa segredos salvos no banco (ex: chave da Anthropic). Cai no INGEST_SECRET se não definida. */
  get appSecret() { return process.env.APP_SECRET ?? req("INGEST_SECRET"); },
  get anthropicModel() { return process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5"; },
  /** minutos sem mensagem nova pra considerar a conversa "assentada" e analisar */
  get analyzeInactivityMinutes() { return Number(process.env.ANALYZE_INACTIVITY_MINUTES ?? 120); },
  /** quantas conversas por rodada do job */
  get analyzeBatchSize() { return Number(process.env.ANALYZE_BATCH_SIZE ?? 20); },
  /** minutos com lead esperando resposta pra marcar como "parada" */
  get stalledAfterMinutes() { return Number(process.env.STALLED_AFTER_MINUTES ?? 60); },
  get timezone() { return process.env.TIMEZONE ?? "America/Sao_Paulo"; },
  get businessHoursStart() { return Number(process.env.BUSINESS_HOURS_START ?? 8); },
  get businessHoursEnd() { return Number(process.env.BUSINESS_HOURS_END ?? 18); },
  /** dias de retenção das mensagens (LGPD). 0 = não apaga */
  get retentionDays() { return Number(process.env.RETENTION_DAYS ?? 180); },
};
