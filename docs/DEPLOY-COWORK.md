# Prompt pra colar no Claude Cowork

Copie tudo abaixo da linha e cole no Cowork. Ele foi escrito pra quem não é técnico: o Cowork faz o máximo sozinho e pede uma coisa de cada vez.

---

Você vai colocar em produção a plataforma WhatsApp Insights, que está no repositório GitHub joaoribeiro655/whats-insights. Leia o README.md e o docker-compose.yml do repositório antes de começar.

Importante sobre mim: eu não sou técnico. Nunca usei VPS, SSH, Docker nem terminal. Então:
- Faça você mesmo tudo que for possível (no navegador, no terminal do meu computador e por SSH no servidor).
- Quando precisar de mim, peça UMA coisa de cada vez, explique em uma frase o que é e por que precisa, e diga exatamente onde clicar ou o que copiar e colar.
- Não me pergunte decisões técnicas: decida você e me conte o que escolheu.
- Se algo der erro, resolva sozinho antes de me chamar.
- No final me entregue um resumo simples: o link da plataforma, usuário e senha, e o que fazer no dia a dia.

O que é o projeto: um Docker Compose com 4 serviços: db (Postgres), gateway (Node + Baileys, lê o WhatsApp dos vendedores por QR code, somente leitura, nunca envia mensagem), web (Next.js, dashboard na porta 3000) e scheduler (dispara as análises com Claude). Ele precisa rodar num servidor ligado 24h.

ETAPA 1. Contratar o servidor (VPS)
Eu não tenho servidor. Me ajude a criar uma conta na Hetzner Cloud (console.hetzner.cloud) e criar um servidor: tipo CX22 (ou CPX21 se CX22 não existir), imagem Ubuntu 24.04, localização Nuremberg ou Falkenstein (Alemanha). Antes de criar o servidor, gere uma chave SSH no meu computador com ssh-keygen -t ed25519 (sem senha na chave) e cadastre a chave pública na Hetzner, pra você conseguir entrar no servidor sem senha. Me diga quando eu precisar colocar cartão ou confirmar e-mail. Ao final pegue o IP do servidor.

ETAPA 2. Preparar o servidor (você faz por SSH, eu não preciso fazer nada)
- apt update && apt upgrade -y
- Instale Docker pelo script oficial (curl -fsSL https://get.docker.com | sh) e confirme docker compose version.
- Configure o firewall ufw liberando só as portas 22, 80 e 443. A porta 3000 fica fechada pra internet.
- Instale git. O repositório é privado, então clone com um token: me guie pra criar um Personal Access Token (classic) em github.com/settings/tokens com escopo repo, eu te colo o token, e você clona em /opt/whats-insights usando https://TOKEN@github.com/joaoribeiro655/whats-insights. Depois guarde a URL com token no remote pra git pull funcionar no futuro.

ETAPA 3. Configurar
- cp .env.example .env dentro de /opt/whats-insights.
- Gere quatro segredos diferentes com openssl rand -hex 32 e preencha GATEWAY_TOKEN, INGEST_SECRET, JOBS_SECRET e APP_SECRET. Gere também uma senha forte pra POSTGRES_PASSWORD.
- Deixe ANTHROPIC_API_KEY vazio. A chave vai ser colada na tela Configurações da própria plataforma depois.
- TIMEZONE=America/Sao_Paulo, BUSINESS_HOURS_START=8, BUSINESS_HOURS_END=18. Me pergunte, de forma simples, qual é o horário de atendimento da minha equipe e ajuste.
- DEVICE_NAME é o nome que vai aparecer em "Dispositivos conectados" no celular dos vendedores. Me pergunte o nome da minha empresa e use ele.

ETAPA 4. Endereço com cadeado (HTTPS) e senha de acesso
O dashboard não tem login próprio, então ele precisa ficar atrás de um proxy com usuário e senha.
- Me pergunte se eu tenho um domínio (um endereço tipo minhaempresa.com.br). Se eu tiver, me explique como criar um registro A chamado insights apontando pro IP do servidor no painel onde comprei o domínio, e espere eu confirmar. Se eu não tiver ou não souber, use IP.sslip.io como endereço (ex: 203.0.113.10.sslip.io), que funciona sem comprar nada.
- Suba um Caddy em Docker (adicione um serviço caddy no docker-compose.yml, portas 80 e 443, volumes caddy_data e caddy_config) fazendo reverse proxy pra web:3000 com HTTPS automático.
- Proteja com basic_auth no Caddyfile. Gere a senha com caddy hash-password. Usuário admin e uma senha forte que você vai me entregar no final.
- A rota /api/ingest é chamada pelo gateway por dentro da rede Docker (http://web:3000/api/ingest) e não passa pelo Caddy, então o basic auth não atrapalha. Confirme isso lendo o compose.

ETAPA 5. Subir e validar comigo
- docker compose up -d --build e acompanhe docker compose logs -f web gateway até ver "gateway no ar" e o Next pronto. As migrations do banco rodam sozinhas.
- Me mande o link. Eu abro, coloco usuário e senha e te digo se a página Visão geral carregou.
- Me guie pra criar a chave da API da Anthropic: entrar em console.anthropic.com, criar conta se não tiver, colocar crédito (uns 20 dólares bastam pra começar), ir em API Keys, criar uma chave e copiar (começa com sk-ant-). Depois me diga pra abrir a aba Configurações da plataforma, colar a chave, clicar em Testar chave e em Salvar.
- Na mesma tela tem o campo contexto comercial. Me faça 4 perguntas simples (o que vendemos, preço médio, como é o processo de venda, objeções mais comuns dos clientes) e escreva o texto pra mim, que eu colo lá.
- Me diga pra ir em Vendedores, adicionar um vendedor de teste com meu nome e confirmar que apareceu um QR code. Se não aparecer, olhe docker compose logs gateway e resolva.
- Me explique como ler o QR no meu WhatsApp: abrir o WhatsApp, tocar nos três pontinhos, Dispositivos conectados, Conectar dispositivo, apontar a câmera. Depois me peça pra alguém mandar 2 ou 3 mensagens pro meu número e eu responder. Confirme que a conversa apareceu em Conversas e que meu status ficou "Conectado".
- Me diga pra abrir essa conversa e clicar em Analisar agora. Confirme que apareceu score, etapa e sugestões.
- Confirme que o scheduler está rodando: docker compose logs scheduler deve mostrar {"ok":true,...} a cada 10 minutos.

ETAPA 6. Deixar seguro pro dia a dia (você faz)
- Backup diário do banco: cron rodando docker compose exec -T db pg_dump -U postgres whats_insights | gzip > /opt/backups/whats_insights-$(date +%F).sql.gz, mantendo os últimos 14 arquivos.
- Confirme que os volumes pgdata e gateway-sessions existem (docker volume ls). O gateway-sessions guarda as conexões do WhatsApp; se for apagado todo mundo precisa ler o QR de novo.
- Reinicie o servidor (reboot) e confirme que tudo volta sozinho e que meu WhatsApp continua conectado sem novo QR.

ETAPA 7. Entrega
Me mande em linguagem simples: o link da plataforma, usuário e senha, quanto custa por mês (servidor + estimativa da API da Anthropic), como conectar um vendedor novo, o que fazer se um vendedor desconectar, e como atualizar a plataforma quando eu pedir mudanças (cd /opt/whats-insights && git pull && docker compose up -d --build). Guarde num arquivo no meu computador chamado "WhatsApp Insights - acesso e instruções.txt". Lembre também: a conexão por QR não é a API oficial do WhatsApp. A plataforma só lê e nunca envia, mas ainda assim existe risco de bloqueio do número se a Meta detectar, então nunca usar esse número pra disparos em massa.
