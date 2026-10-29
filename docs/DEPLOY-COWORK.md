# Prompt pra colar no Claude Cowork

Copie tudo abaixo da linha e cole no Cowork. Ele foi escrito pra quem não é técnico: o Cowork faz o máximo sozinho e pede uma coisa de cada vez. O servidor é o plano gratuito permanente da Oracle Cloud (Always Free), então o único custo é a API da Anthropic, por uso e opcional.

---

Você vai colocar em produção a plataforma WhatsApp Insights, que está no repositório GitHub joaoribeiro655/whats-insights. Leia o README.md e o docker-compose.yml do repositório antes de começar.

Importante sobre mim: eu não sou técnico. Nunca usei servidor, SSH, Docker nem terminal. Então:
- Faça você mesmo tudo que for possível (no navegador, no terminal do meu computador e por SSH no servidor).
- Quando precisar de mim, peça UMA coisa de cada vez, explique em uma frase o que é e por que precisa, e diga exatamente onde clicar ou o que copiar e colar.
- Não me pergunte decisões técnicas: decida você e me conte o que escolheu.
- Se algo der erro, resolva sozinho antes de me chamar.
- Eu não quero pagar servidor. Use só o que é gratuito pra sempre na Oracle Cloud (Always Free). O único gasto aceito é a API da Anthropic, por uso.
- No final me entregue um resumo simples: o link da plataforma, usuário e senha, e o que fazer no dia a dia.

O que é o projeto: um Docker Compose com 4 serviços: db (Postgres), gateway (Node + Baileys, lê o WhatsApp dos vendedores por QR code, somente leitura, nunca envia mensagem), web (Next.js, dashboard na porta 3000) e scheduler (dispara as análises com Claude). Precisa rodar num servidor ligado 24h. Todas as imagens são multi arquitetura e o Baileys usa WebAssembly, então roda em ARM sem ajuste.

ETAPA 1. Criar o servidor gratuito na Oracle Cloud
1. Gere uma chave SSH no meu computador com ssh-keygen -t ed25519 (sem senha na chave). Você vai colar a chave pública na Oracle no passo 3.
2. Me guie pra criar a conta em cloud.oracle.com (botão "Start for free"). Região inicial (home region): Brazil East (Sao Paulo). Essa escolha não muda depois. A Oracle pede cartão de crédito só pra validar identidade e faz uma cobrança temporária pequena que é estornada; o plano Always Free não cobra nada enquanto só usarmos recursos gratuitos. Me avise quando eu precisar digitar o cartão ou confirmar e-mail. Se o cartão for recusado, me peça pra tentar outro cartão ou tentar de novo mais tarde (é comum).
3. Depois de logado, crie uma instância (Compute → Instances → Create instance) com estas configurações:
   - Image: Canonical Ubuntu 24.04 (a versão aarch64 aparece sozinha ao escolher o shape ARM).
   - Shape: Ampere, VM.Standard.A1.Flex, 2 OCPUs e 12 GB de memória (fica dentro do limite gratuito de 4 OCPUs e 24 GB). Confirme que o shape está marcado como "Always Free eligible".
   - Boot volume: 50 GB.
   - Networking: deixar criar a VCN e subnet novas, com IP público (Assign a public IPv4 address).
   - SSH keys: colar a chave pública gerada no passo 1.
   - Se aparecer o erro "Out of host capacity" ao criar: tente outro Availability Domain, e se continuar, tente de novo a cada 15 ou 30 minutos (a capacidade ARM gratuita libera ao longo do dia). Se depois de várias tentativas não der, me explique a opção de mudar a conta pra "Pay As You Go" (continua sem cobrar os recursos Always Free, só libera capacidade) e me deixe decidir.
4. Anote o IP público da instância. O usuário de SSH é ubuntu.

ETAPA 2. Preparar o servidor (você faz por SSH, eu não preciso fazer nada)
- Entre com ssh ubuntu@IP e use sudo pra tudo.
- sudo apt update && sudo apt upgrade -y
- Crie 4 GB de swap (fallocate, mkswap, swapon e entrada no /etc/fstab) pra o build do Next.js não ficar sem memória.
- Instale Docker pelo script oficial (curl -fsSL https://get.docker.com | sh), adicione o usuário ubuntu ao grupo docker e confirme docker compose version.
- Abra as portas 80 e 443 nos DOIS firewalls da Oracle, senão o site não abre:
  a) No painel da Oracle: Networking → Virtual Cloud Networks → sua VCN → Security Lists → Default Security List → Add Ingress Rules: origem 0.0.0.0/0, protocolo TCP, porta de destino 80; repita pra 443.
  b) Dentro do servidor, a imagem Ubuntu da Oracle vem com iptables bloqueando tudo exceto 22. Rode: sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT e o mesmo pra 443, depois sudo netfilter-persistent save (instale iptables-persistent se não existir). Não abra a porta 3000.
- Instale git. O repositório é privado, então clone com um token: me guie pra criar um Personal Access Token (classic) em github.com/settings/tokens com escopo repo, eu te colo o token, e você clona em /opt/whats-insights usando https://TOKEN@github.com/joaoribeiro655/whats-insights. Deixe a URL com token no remote pra git pull funcionar no futuro e dê permissão da pasta pro usuário ubuntu.

ETAPA 3. Configurar
- cp .env.example .env dentro de /opt/whats-insights.
- Gere quatro segredos diferentes com openssl rand -hex 32 e preencha GATEWAY_TOKEN, INGEST_SECRET, JOBS_SECRET e APP_SECRET. Gere também uma senha forte pra POSTGRES_PASSWORD.
- Deixe ANTHROPIC_API_KEY vazio. A chave vai ser colada na tela Configurações da própria plataforma depois.
- TIMEZONE=America/Sao_Paulo, BUSINESS_HOURS_START=8, BUSINESS_HOURS_END=18. Me pergunte, de forma simples, qual é o horário de atendimento da minha equipe e ajuste.
- DEVICE_NAME é o nome que vai aparecer em "Dispositivos conectados" no celular dos vendedores. Me pergunte o nome da minha empresa e use ele.

ETAPA 4. Endereço com cadeado (HTTPS) e senha de acesso
O dashboard não tem login próprio, então precisa ficar atrás de um proxy com usuário e senha.
- Me pergunte se eu tenho um domínio (um endereço tipo minhaempresa.com.br). Se eu tiver, me explique como criar um registro A chamado insights apontando pro IP do servidor no painel onde comprei o domínio, e espere eu confirmar. Se eu não tiver ou não souber, use IP.sslip.io como endereço (ex: 203.0.113.10.sslip.io), que funciona sem comprar nada.
- Suba um Caddy em Docker (adicione um serviço caddy no docker-compose.yml, portas 80 e 443, volumes caddy_data e caddy_config) fazendo reverse proxy pra web:3000 com HTTPS automático.
- Proteja com basic_auth no Caddyfile. Gere a senha com caddy hash-password. Usuário admin e uma senha forte que você vai me entregar no final.
- A rota /api/ingest é chamada pelo gateway por dentro da rede Docker (http://web:3000/api/ingest) e não passa pelo Caddy, então o basic auth não atrapalha. Confirme isso lendo o compose.

ETAPA 5. Subir e validar comigo
- docker compose up -d --build e acompanhe docker compose logs -f web gateway até ver "gateway no ar" e o Next pronto. O primeiro build demora alguns minutos. As migrations do banco rodam sozinhas.
- Me mande o link. Eu abro, coloco usuário e senha e te digo se a página Visão geral carregou.
- Me guie pra criar a chave da API da Anthropic: entrar em console.anthropic.com, criar conta se não tiver, colocar crédito (uns 10 dólares bastam pra começar), ir em API Keys, criar uma chave e copiar (começa com sk-ant-). Depois me diga pra abrir a aba Configurações da plataforma, colar a chave, clicar em Testar chave e em Salvar. Deixe o modelo em claude-haiku-5-5 por enquanto (mais barato); eu troco pra claude-sonnet-5-5 ou claude-opus-5-5 depois se quiser análises mais profundas.
- Na mesma tela tem o campo contexto comercial. Me faça 4 perguntas simples (o que vendemos, preço médio, como é o processo de venda, objeções mais comuns dos clientes) e escreva o texto pra mim, que eu colo lá.
- Me diga pra ir em Vendedores, adicionar um vendedor de teste com meu nome e confirmar que apareceu um QR code. Se não aparecer, olhe docker compose logs gateway e resolva.
- Me explique como ler o QR no meu WhatsApp: abrir o WhatsApp, tocar nos três pontinhos, Dispositivos conectados, Conectar dispositivo, apontar a câmera. Depois me peça pra alguém mandar 2 ou 3 mensagens pro meu número e eu responder. Confirme que a conversa apareceu em Conversas e que meu status ficou "Conectado".
- Me diga pra abrir essa conversa e clicar em Analisar agora. Confirme que apareceu score, etapa e sugestões.
- Confirme que o scheduler está rodando: docker compose logs scheduler deve mostrar {"ok":true,...} a cada 10 minutos.

ETAPA 6. Deixar seguro pro dia a dia (você faz)
- Backup diário do banco: cron rodando docker compose exec -T db pg_dump -U postgres whats_insights | gzip > /opt/backups/whats_insights-$(date +%F).sql.gz, mantendo os últimos 14 arquivos.
- Confirme que os volumes pgdata e gateway-sessions existem (docker volume ls). O gateway-sessions guarda as conexões do WhatsApp; se for apagado todo mundo precisa ler o QR de novo.
- Reinicie o servidor (sudo reboot) e confirme que tudo volta sozinho e que meu WhatsApp continua conectado sem novo QR.
- A Oracle desliga instâncias Always Free que ficam ociosas por 7 dias (uso de CPU muito baixo). O gateway com WhatsApp conectado normalmente evita isso, mas por garantia crie um cron que roda a cada 10 minutos um pequeno trabalho de CPU por alguns segundos (por exemplo, calcular um hash de um arquivo grande). Me explique isso em uma frase.

ETAPA 7. Entrega
Me mande em linguagem simples: o link da plataforma, usuário e senha, confirmação de que o servidor é gratuito e uma estimativa do gasto mensal com a API da Anthropic, como conectar um vendedor novo, o que fazer se um vendedor desconectar, e como atualizar a plataforma quando eu pedir mudanças (cd /opt/whats-insights && git pull && docker compose up -d --build). Guarde num arquivo no meu computador chamado "WhatsApp Insights - acesso e instruções.txt". Lembre também: a conexão por QR não é a API oficial do WhatsApp. A plataforma só lê e nunca envia, mas ainda assim existe risco de bloqueio do número se a Meta detectar, então nunca usar esse número pra disparos em massa.
