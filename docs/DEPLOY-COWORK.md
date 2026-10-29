# Prompt pra colar no Claude Cowork

Copie tudo abaixo da linha e cole no Cowork. Antes, substitua `SEU_USUARIO/whats-insights` pelo repositório certo. O Cowork vai te perguntar o que precisar (acesso ao VPS, domínio) no caminho.

---

Você vai colocar em produção a plataforma **WhatsApp Insights**, que está no repositório GitHub `SEU_USUARIO/whats-insights`. É um projeto Docker Compose com 4 serviços: `db` (Postgres), `gateway` (Node + Baileys, lê o WhatsApp dos vendedores por QR code, somente leitura), `web` (Next.js, dashboard na porta 3000) e `scheduler`. Leia o `README.md` e o `docker-compose.yml` do repositório antes de começar. Trabalhe de forma autônoma, me pergunte só o que você realmente não consegue descobrir ou decidir sozinho, e no final me entregue um resumo com a URL, o usuário e a senha de acesso.

## 1. Servidor

Pergunte se eu já tenho um VPS. Se eu tiver, peça IP, usuário e chave SSH (ou senha) e siga pro passo 2.

Se eu não tiver, me ajude a criar um na Hetzner Cloud (console.hetzner.cloud): tipo CX22 ou CPX21, Ubuntu 24.04, localização Alemanha (Nuremberg ou Falkenstein) ou a mais próxima do Brasil disponível, com a minha chave SSH pública cadastrada (se eu não tiver uma, gere com `ssh-keygen -t ed25519` no meu computador e cadastre). Me guie passo a passo pela tela, ou faça no navegador se tiver acesso a ele. Depois pegue o IP.

## 2. Preparar o servidor (via SSH, a partir do meu computador)

Conecte por SSH e, como root:

1. `apt update && apt upgrade -y`
2. Instale Docker pelo script oficial (`curl -fsSL https://get.docker.com | sh`) e confirme `docker compose version`.
3. Crie um usuário `deploy` com acesso ao grupo docker e configure o firewall `ufw` liberando só 22, 80 e 443. Mantenha a porta 3000 fechada pra internet (o acesso vai passar pelo Caddy).
4. Instale `git` e `gh` (GitHub CLI). O repositório é privado: faça `gh auth login` no servidor usando um token meu com escopo `repo` (me peça o token quando chegar aqui, e me explique como gerar em github.com/settings/tokens se eu não souber) ou configure uma deploy key. Clone em `/opt/whats-insights`.

## 3. Configurar

1. `cp .env.example .env` dentro de `/opt/whats-insights`.
2. Gere quatro segredos diferentes com `openssl rand -hex 32` e preencha `GATEWAY_TOKEN`, `INGEST_SECRET`, `JOBS_SECRET` e `APP_SECRET`. Gere também uma senha forte pra `POSTGRES_PASSWORD`.
3. Deixe `ANTHROPIC_API_KEY` vazio: a chave vai ser colada na tela Configurações da própria plataforma depois.
4. `TIMEZONE=America/Sao_Paulo`, `BUSINESS_HOURS_START=8`, `BUSINESS_HOURS_END=18`. Pergunte se quero outro horário comercial.
5. `DEVICE_NAME` é o nome que aparece em "Dispositivos conectados" no celular dos vendedores. Pergunte qual nome eu quero (ex: o nome da minha empresa).

## 4. HTTPS e proteção de acesso

O dashboard não tem login próprio ainda, então ele precisa ficar atrás de um proxy com autenticação.

1. Pergunte se eu tenho um domínio ou subdomínio pra isso (ex: `insights.minhaempresa.com.br`). Se tiver, me diga exatamente qual registro A criar apontando pro IP e espere eu confirmar. Se eu não tiver, use `IP.sslip.io` como domínio provisório (ex: `203.0.113.10.sslip.io`).
2. Suba um Caddy em Docker (adicione um serviço `caddy` no `docker-compose.yml` ou um compose separado, portas 80 e 443, volumes pra `caddy_data` e `caddy_config`) fazendo reverse proxy pra `web:3000` com HTTPS automático.
3. Proteja tudo com `basic_auth` no Caddyfile. Gere a senha com `caddy hash-password`. Usuário `admin` e uma senha forte que você vai me entregar no final.
4. Importante: a rota `/api/ingest` é chamada pelo gateway por dentro da rede Docker (`http://web:3000/api/ingest`), não passa pelo Caddy, então o basic auth não atrapalha. Confirme isso lendo o compose.

## 5. Subir e validar

1. `docker compose up -d --build` e acompanhe `docker compose logs -f web gateway` até ver "gateway no ar" e o Next pronto. As migrations do banco rodam sozinhas na subida do `web`.
2. Abra `https://DOMINIO/` e confirme que pede usuário e senha e que a página Visão geral carrega.
3. Vá em **Configurações**, me peça a chave da API da Anthropic (eu crio em console.anthropic.com → API Keys, ela começa com `sk-ant-`), cole no campo, clique em **Testar chave** e depois em **Salvar**. Preencha também o **contexto comercial** com o que eu te disser sobre meu negócio (me faça 3 ou 4 perguntas: o que vendemos, ticket médio, etapas da venda, o que é um lead bom, objeções comuns).
4. Vá em **Vendedores**, adicione um vendedor de teste e confirme que o QR code aparece em até 20 segundos. Se não aparecer, olhe `docker compose logs gateway` e resolva.
5. Me peça pra ler o QR com um número de teste no WhatsApp (Dispositivos conectados → Conectar dispositivo). Depois me peça pra mandar 2 ou 3 mensagens pra esse número de outro celular e responder. Confirme que a conversa aparece em **Conversas** e que o status do vendedor fica "Conectado".
6. Abra a conversa de teste e clique em **Analisar agora**. Confirme que a análise aparece com score, etapa e sugestões.
7. Confirme que o `scheduler` está rodando: `docker compose logs scheduler` deve mostrar respostas JSON `{"ok":true,...}` a cada 10 minutos.

## 6. Operação

1. Configure backup diário do Postgres: um cron no servidor rodando `docker compose exec -T db pg_dump -U postgres whats_insights | gzip > /opt/backups/whats_insights-$(date +%F).sql.gz` e mantendo os últimos 14 arquivos.
2. Confirme que os volumes `pgdata` e `gateway-sessions` existem (`docker volume ls`). O `gateway-sessions` guarda as sessões do WhatsApp; se ele for apagado, todos os vendedores precisam ler o QR de novo.
3. Deixe `restart: unless-stopped` nos serviços e teste um `reboot` do servidor: tudo tem que voltar sozinho e os vendedores continuarem conectados sem novo QR.
4. Me explique como atualizar no futuro: `cd /opt/whats-insights && git pull && docker compose up -d --build`.

## 7. Entrega

Me mande no final: URL, usuário e senha do basic auth, IP do servidor, onde está o `.env`, como ver logs, como fazer backup e restaurar, e a lista do que ficou pendente (por exemplo, domínio definitivo se usamos sslip.io). Lembre também que a conexão por QR não é a API oficial do WhatsApp: a plataforma só lê, nunca envia, e mesmo assim existe risco de bloqueio do número se a Meta detectar, então nunca ligar disparos nesse número.
