# Prompt pra colar no Claude Cowork

Copie tudo abaixo da linha e cole no Cowork. Modelo de hospedagem igual ao gateway do ALVRZ CRM: Railway, direto do GitHub, sem servidor pra administrar. Escrito pra quem não é técnico.

---

Você vai colocar em produção a plataforma WhatsApp Insights, que está no repositório GitHub joaoribeiro655/whats-insights, usando o Railway (railway.com), do mesmo jeito que o gateway do meu CRM já roda lá. Leia o README.md do repositório antes de começar.

Importante sobre mim: eu não sou técnico. Então:
- Faça você mesmo tudo que for possível, de preferência pelo navegador no painel do Railway (ou pela CLI do Railway no meu computador, se for mais rápido).
- Quando precisar de mim, peça UMA coisa de cada vez, explique em uma frase o que é e por que precisa, e diga exatamente onde clicar ou o que copiar e colar.
- Não me pergunte decisões técnicas: decida você e me conte o que escolheu.
- Se algo der erro, resolva sozinho antes de me chamar.
- No final me entregue um resumo simples: o link da plataforma, a senha de acesso e o que fazer no dia a dia.

O que é o projeto: três peças que rodam no Railway: um banco Postgres, o serviço gateway (pasta gateway, Node + Baileys, lê o WhatsApp dos vendedores por QR code, somente leitura, nunca envia mensagem) e o serviço web (pasta web, Next.js, o painel). O web já tem login por senha única e já roda sozinho as análises com Claude a cada 10 minutos, então não precisa de cron nem de proxy na frente.

ETAPA 1. Conta e projeto no Railway
- Eu já tenho conta no Railway (é onde roda o gateway do meu CRM). Me peça pra entrar em railway.com e confirmar que estou logado. Se o plano for o trial, me avise que o crédito acaba e que o plano Hobby custa 5 dólares por mês com 5 dólares de uso incluídos, o que cobre esta plataforma com folga.
- Crie um projeto novo chamado whats-insights. Não mexa no projeto do CRM.
- Conecte o repositório GitHub joaoribeiro655/whats-insights ao Railway (se o Railway não enxergar o repo, me guie pra autorizar o Railway GitHub App no repositório em github.com/settings/installations).

ETAPA 2. Banco de dados
- No projeto, clique em + New → Database → PostgreSQL. Espere ficar verde. Ele cria sozinho a variável DATABASE_URL que os outros serviços vão referenciar.

ETAPA 3. Serviço gateway
- + New → GitHub Repo → joaoribeiro655/whats-insights. Renomeie o serviço pra gateway.
- Settings → Source → Root Directory: gateway. O Railway detecta o Dockerfile sozinho.
- Settings → Networking: NÃO gere domínio público. O gateway só conversa com o web pela rede privada.
- Volume: clique com o botão direito no serviço (ou Settings → Volumes) → Add Volume → mount path /app/data. Isso guarda as conexões do WhatsApp; sem isso cada deploy pede QR de novo.
- Variables (gere os segredos com openssl rand -hex 32 ou com um gerador de senha, cada um diferente, e anote porque o web usa os mesmos):
  PORT=3100
  HOST=::
  DATA_DIR=/app/data
  GATEWAY_TOKEN=<segredo 1>
  INGEST_SECRET=<segredo 2>
  INGEST_URL=http://web.railway.internal:3000/api/ingest
  DEVICE_NAME=<nome da minha empresa, me pergunte>
  SYNC_FULL_HISTORY=true
  LOG_LEVEL=info
  NODE_ENV=production
- Faça o deploy e confira nos logs a linha "gateway no ar (somente leitura)".

ETAPA 4. Serviço web
- + New → GitHub Repo → joaoribeiro655/whats-insights de novo. Renomeie pra web.
- Settings → Source → Root Directory: web.
- Settings → Networking → Generate Domain (porta 3000). Esse é o link do painel, com HTTPS automático.
- Variables:
  PORT=3000
  HOSTNAME=::
  NODE_ENV=production
  DATABASE_URL=${{Postgres.DATABASE_URL}}   (use a referência ao serviço do banco; se o serviço tiver outro nome, ajuste)
  GATEWAY_URL=http://gateway.railway.internal:3100
  GATEWAY_TOKEN=<segredo 1, igual ao do gateway>
  INGEST_SECRET=<segredo 2, igual ao do gateway>
  JOBS_SECRET=<segredo 3>
  APP_SECRET=<segredo 4>
  DASHBOARD_PASSWORD=<senha forte que você vai me entregar>
  ANALYZE_EVERY_MINUTES=10
  ANALYZE_INACTIVITY_MINUTES=120
  ANALYZE_MAX_AGE_DAYS=180
  STALLED_AFTER_MINUTES=60
  TIMEZONE=America/Sao_Paulo
  BUSINESS_HOURS_START=8
  BUSINESS_HOURS_END=18
  RETENTION_DAYS=180
  Me pergunte, de forma simples, o horário de atendimento da equipe e ajuste BUSINESS_HOURS. Deixe ANTHROPIC_API_KEY sem definir: a chave é colada na tela Configurações da própria plataforma.
- Faça o deploy. O primeiro build demora alguns minutos. As migrations do banco rodam sozinhas na subida. Nos logs tem que aparecer "[scheduler] análise automática a cada 10 min".
- Se o gateway tiver subido antes do web e estiver logando "backend indisponível, retentando", é normal: ele retenta sozinho.

ETAPA 5. Validar comigo
- Me mande o link do painel. Eu abro, digito a senha e te digo se a página Visão geral carregou.
- Me guie pra criar a chave da API da Anthropic: entrar em console.anthropic.com, criar conta se não tiver, colocar crédito (uns 10 dólares bastam pra começar), ir em API Keys, criar uma chave e copiar (começa com sk-ant-). Depois me diga pra abrir a aba Configurações da plataforma, colar a chave, clicar em Testar chave e em Salvar. Deixe o modelo em claude-haiku-5-5 (mais barato); eu troco pra claude-sonnet-5-5 ou claude-opus-5-5 depois se quiser análises mais profundas.
- Na mesma tela tem o campo contexto comercial. Me faça 4 perguntas simples (o que vendemos, preço médio, como é o processo de venda, objeções mais comuns dos clientes) e escreva o texto pra mim, que eu colo lá.
- Me diga pra ir em Vendedores, adicionar um vendedor de teste com meu nome e confirmar que apareceu um QR code em até 20 segundos. Se não aparecer, olhe os logs do gateway e do web e resolva (o erro mais comum é GATEWAY_URL ou GATEWAY_TOKEN diferente entre os dois serviços, ou HOST/HOSTNAME sem o valor ::).
- Me explique como ler o QR no meu WhatsApp: abrir o WhatsApp, tocar nos três pontinhos, Dispositivos conectados, Conectar dispositivo, apontar a câmera. Depois me peça pra alguém mandar 2 ou 3 mensagens pro meu número e eu responder. Confirme que a conversa apareceu em Conversas e que meu status ficou "Conectado".
- Me diga pra abrir essa conversa e clicar em Analisar agora. Confirme que apareceu score, etapa e sugestões.

ETAPA 6. Garantias
- Faça um redeploy do gateway e confirme que meu WhatsApp continua conectado sem novo QR (prova de que o volume está certo).
- Ative backups do Postgres no Railway (no serviço do banco, aba Backups) se o plano permitir; se não permitir, me diga em uma frase.
- Confirme que o gateway não tem domínio público e que o web pede senha antes de qualquer página.

ETAPA 7. Entrega
Me mande em linguagem simples: o link do painel, a senha, uma estimativa do custo mensal (Railway + API da Anthropic), como conectar um vendedor novo, o que fazer se um vendedor desconectar, e como a plataforma atualiza (cada push na branch main do GitHub faz o Railway fazer deploy sozinho). Guarde num arquivo no meu computador chamado "WhatsApp Insights - acesso e instruções.txt". Lembre também: a conexão por QR não é a API oficial do WhatsApp. A plataforma só lê e nunca envia, mas ainda assim existe risco de bloqueio do número se a Meta detectar, então nunca usar esse número pra disparos em massa.
