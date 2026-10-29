# WhatsApp Insights

Plataforma que conecta o WhatsApp dos vendedores por **QR code próprio** (protocolo do WhatsApp Web via Baileys) e usa a conexão **apenas para ler** as conversas e gerar insights sobre os leads e sobre o atendimento. Nenhuma mensagem é enviada, marcada como lida ou alterada pela plataforma.

## Arquitetura

```
WhatsApp do vendedor ──QR──▶ gateway/ (Node + Baileys, 1 sessão por vendedor)
                                 │  webhook assinado (HMAC) em lotes, com retry
                                 ▼
                            web/ (Next.js 16)
                              ├─ POST /api/ingest        grava contatos, conversas e mensagens no Postgres
                              ├─ POST /api/jobs/analyze  analisa conversas "assentadas" com Claude (saída estruturada)
                              └─ dashboard               visão geral, vendedores (QR), conversas, leads
```

| Pasta | O que é |
|---|---|
| `gateway/` | Serviço Node de vida longa. Mantém o socket do Baileys, gera o QR como PNG, persiste a sessão em disco, reconecta com backoff e entrega eventos ao backend. Expõe uma API HTTP mínima protegida por token. |
| `web/` | Next.js App Router + Drizzle + Postgres. Recebe os eventos, calcula métricas (tempo de resposta, conversas paradas, horário comercial, origem por anúncio) e roda a análise com Claude. |
| `scripts/simulate-events.mjs` | Simula o gateway mandando eventos assinados pro `/api/ingest` (útil pra desenvolver sem WhatsApp). |

## Garantias de "somente leitura"

- O gateway **não tem** rota de envio. `sendMessage`, `readMessages`, `sendPresenceUpdate` nunca são chamados.
- `markOnlineOnConnect: false`: o celular do vendedor continua recebendo notificações normalmente.
- `getMessage` devolve `undefined`: nada é reenviado sob demanda.
- A única ação de escrita no WhatsApp é o **logout** quando o gestor desconecta o vendedor pela tela.

## Rodando com Docker (produção simples)

```bash
cp .env.example .env   # gere GATEWAY_TOKEN, INGEST_SECRET e JOBS_SECRET com: openssl rand -hex 32
docker compose up -d --build
```

Abra `http://localhost:3000/vendedores`, adicione um vendedor e leia o QR no celular dele (WhatsApp → Dispositivos conectados → Conectar dispositivo). O volume `gateway-sessions` guarda a sessão: reiniciar não pede QR de novo, só logout pelo celular.

O serviço `scheduler` chama `/api/jobs/analyze` a cada 10 min. Pode trocar por cron do VPS ou Vercel Cron:

```bash
curl -X POST -H "authorization: Bearer $JOBS_SECRET" https://seu-dominio/api/jobs/analyze
```

## Rodando local (desenvolvimento)

```bash
# banco
createdb whats_insights

# web
cd web && cp .env.example .env.local   # ajuste DATABASE_URL e segredos
npm install && npx drizzle-kit migrate && npm run dev

# gateway (outro terminal)
cd gateway && cp .env.example .env && npm install
GATEWAY_TOKEN=... INGEST_URL=http://localhost:3000/api/ingest INGEST_SECRET=... npm run dev
```

Sem WhatsApp à mão, simule eventos: crie um vendedor pela tela, pegue o `instanceId` dele no banco e rode

```bash
node scripts/simulate-events.mjs <instanceId> http://localhost:3000/api/ingest <INGEST_SECRET>
```

## O que a plataforma mede

**Sem IA (direto do banco):** leads novos, tempo até a primeira resposta (mediana), tempo médio de resposta, taxa de resposta, conversas paradas (lead falou por último e ficou sem retorno), % de mensagens fora do horário comercial, origem por anúncio (click to WhatsApp, com título e `ctwa_clid`).

**Com Claude (por conversa, quando ela fica `ANALYZE_INACTIVITY_MINUTES` sem mensagem nova):** score do lead (0 a 100), etapa do funil, intenção, interesse, urgência, orçamento citado, objeções, motivo de perda, sentimento, resumo, próximo passo, follow up recomendado, nota do atendimento (0 a 100), pontos fortes e melhorias concretas, se qualificou e se tentou fechar. O prompt usa o campo `organizations.sales_context` (produto, ticket, script) se você preencher.

Modelo padrão: `claude-opus-5-5` (`ANTHROPIC_MODEL` troca). A análise usa saída estruturada (Zod) e cache de prompt no system prompt.

## Variáveis de ambiente

Veja `.env.example` na raiz (Docker), `web/.env.example` e `gateway/.env.example`.

## Riscos e cuidados

- **Banimento.** Baileys não é oficial. Só leitura reduz muito o risco, mas ele existe. Nunca use essa conexão pra disparar mensagens.
- **LGPD.** Você armazena conversas de terceiros. Tenha consentimento do vendedor, política clara, e use `RETENTION_DAYS` (mensagens antigas são apagadas pelo job; insights e métricas ficam).
- **Autenticação do dashboard** ainda não existe (MVP). Coloque atrás de um proxy com auth ou adicione login antes de expor na internet. Todas as tabelas já têm `org_id`, então o multi tenant é só trocar `getDefaultOrg()` pela org do usuário logado.
- **Baileys 7 (rc) e LID.** Contatos podem chegar primeiro como `@lid` sem telefone; a ingestão funde os registros quando o telefone aparece.
