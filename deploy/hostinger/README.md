# Deploy na VPS Hostinger (Docker + Nginx + HTTPS sem domínio)

Objetivo: **só 22, 80 e 443** expostos (padrão que evita bloqueios na Hostinger), serviços Docker **só em `127.0.0.1`** (definido no `docker-compose.yml` de cada pasta — variáveis `BACKEND_PUBLISH` / `FRONTEND_PUBLISH` se precisares de `0.0.0.0`), e **HTTPS** com certificado **autoassinado** até teres domínio + Let’s Encrypt.

## Visão geral

| Camada | O quê |
|--------|--------|
| Internet → VPS | Nginx em **:443** (TLS) e **:80** → redireciona para HTTPS |
| Nginx → Docker | `127.0.0.1:3000` (Next), `127.0.0.1:8005` (Django) |
| Browser | `https://SEU_IP` (aceitar aviso do certificado autoassinado uma vez) |

O ficheiro `nginx/vhost-ip-https.conf` encaminha `/` para o Next e `/integration`, `/admin`, `/static` para o Django no mesmo IP.

## 1. Pacotes na VPS (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y nginx openssl git ca-certificates
```

Instala Docker conforme a documentação oficial (repositório Docker, não apenas `docker.io` antigo, se quiseres suporte estável).

## 2. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

No **hPanel → VPS → Firewall**, garante **80** e **443** permitidos.

**Não** abras 3000 ou 8005 na firewall pública.

## 3. Repositório e backend

```bash
sudo mkdir -p /opt && sudo chown "$USER":"$USER" /opt
cd /opt
git clone <URL_DO_REPO> cedulapromotora
cd cedulapromotora/back_cedula_promotora

cp .env.example .env
nano .env   # IP em ALLOWED_HOSTS, segredos, BEHIND_HTTPS_PROXY=true se usar Nginx HTTPS
```

```bash
docker compose up -d --build
```

## 4. Frontend

```bash
cd /opt/cedulapromotora/web_sistema_emprestimos
cp .env.example .env
nano .env
```

Importante:

- `NEXTAUTH_URL` = `https://` + **o mesmo IP** que o browser usa (sem barra final).
- `NEXT_INTEGRATION_URL` = `http://host.docker.internal:8005/integration` — tráfego **interno** do contentor para o Gunicorn em loopback, **sem** TLS (evita erros de certificado no Node).

```bash
docker compose up -d --build
```

## 5. Certificado TLS autoassinado (sem domínio)

```bash
cd /opt/cedulapromotora/web_sistema_emprestimos
sudo bash deploy/hostinger/scripts/gerar-certificado-selfsigned.sh SEU.IP.PUBLICO
```

Isto cria `/etc/nginx/ssl/cedula/selfsigned.crt` e `.key`.

## 6. Nginx

Desativa o site por defeito se ocupar a porta 80:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

Copia o virtual host (o mesmo ficheiro existe em `back_cedula_promotora/deploy/hostinger/nginx/`):

```bash
sudo cp deploy/hostinger/nginx/vhost-ip-https.conf /etc/nginx/sites-available/cedula.conf
sudo ln -sf /etc/nginx/sites-available/cedula.conf /etc/nginx/sites-enabled/cedula.conf
sudo nginx -t && sudo systemctl reload nginx
```

## 7. Verificação

- `curl -k -I https://127.0.0.1/` no servidor (ignora verificação do certificado).
- No teu PC: `https://SEU_IP` → aviso de certificado → continuar → página do Next.

### 502 Bad Gateway em `/admin/` ou `/integration/`

O Nginx não está a conseguir falar com o Gunicorn em **127.0.0.1:8005** (ou o Next em **3000**).

1. **Na VPS**, confirma que o backend está a correr e a escutar:

   ```bash
   cd /caminho/para/back_cedula_promotora
   docker compose ps
   docker compose logs backend --tail 80
   sudo ss -tlnp | grep 8005
   curl -sS -o /dev/null -w "%{http_code}\n" -H "Host: 72.60.143.19" http://127.0.0.1:8005/admin/
   ```

   Se `curl` falhar ou não aparecer `8005` em `ss`, o problema é o Docker/Django, não o Nginx.

2. **Nginx no host vs reverse proxy em Docker (causa muito comum de 502)**

   Se `which nginx` der **not found**, mas `sudo ss -tlnp | grep ':443'` mostrar **`docker-proxy`**, então **HTTPS está a ser servido por um contentor**, não pelo `nginx` do `apt`.

   Nesse caso, no ficheiro de config **desse** contentor, `proxy_pass http://127.0.0.1:8005` aponta para o **loopback do contentor**, onde **não** corre o Gunicorn → **502**. O `curl` no **host** a `http://127.0.0.1:8005` pode dar 302 mesmo assim.

   **Como ver o contentor:**

   ```bash
   docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
   ```

   **Caminhos de correção (escolhe um):**

   - **A (recomendado no guia):** instalar Nginx no host (`apt install nginx`), copiar o `vhost-ip-https.conf`, e **parar ou alterar** o stack Docker que ocupa as portas **80/443** (senão há conflito de binding).
   - **B (tudo em Docker):** meter o reverse proxy e o `backend` na **mesma rede Docker** e usar `proxy_pass http://nome_do_servico_backend:8005` (nome do serviço no `docker-compose.yml`).
   - **C (atalho):** no `.env` do backend usar `BACKEND_PUBLISH=0.0.0.0:8005` e no proxy do contentor tentar **`http://172.17.0.1:8005`** (IP habitual do host na bridge `docker0`; confirma com `ip -4 addr show docker0`). **Bloqueia** a porta 8005 na firewall pública (UFW) para não expor a API à internet. Nota: com `127.0.0.1:8005` no host, outro contentor **não** consegue usar `172.17.0.1:8005` de forma fiável; por isso **C** exige publicar em `0.0.0.0:8005` ou usar **B**.

   **Next noutro `docker compose` (login 401 / `host.docker.internal` timeout):** no host, `curl http://127.0.0.1:8005/integration/auth/login/` pode funcionar, mas **dentro** do contentor `wget http://host.docker.internal:8005/...` dá *timed out* — o mesmo problema: publica o backend com **`BACKEND_PUBLISH=0.0.0.0:8005`** e reinicia o compose do backend.

3. Log de erros: se existir Nginx no host, `sudo nginx -T 2>&1 | grep error_log` mostra o caminho. Se o TLS for num contentor: `docker logs <nome>`.

## 8. Domínio `faturamentocedulapromotora.com.br` + HTTPS (Let's Encrypt)

Objetivo: **HTTPS válido no browser** (sem aviso), NextAuth com `NEXTAUTH_URL` em HTTPS, e-mail do proprietário no login (`cedulapromotora@gmail.com`).

### DNS

1. Na Hostinger (ou gestor DNS), cria registo **A**: `faturamentocedulapromotora.com.br` → **IP público da VPS**.
2. Espera a propagação (pode levar até algumas horas). Testa: `dig +short faturamentocedulapromotora.com.br`

### Backend (`back_cedula_promotora/.env`)

Inclui o hostname em `ALLOWED_HOSTS` (junto com `host.docker.internal` e o IP se ainda precisares):

```env
ALLOWED_HOSTS=localhost,127.0.0.1,host.docker.internal,faturamentocedulapromotora.com.br
BEHIND_HTTPS_PROXY=true
```

`docker compose up -d` na pasta do backend.

### Frontend (`web_sistema_emprestimos/.env`)

Exemplo (ajusta `NEXTAUTH_SECRET`):

```env
NEXTAUTH_URL=https://faturamentocedulapromotora.com.br
NEXT_INTEGRATION_URL=http://host.docker.internal:8005/integration
NEXT_PUBLIC_APP_URL=https://faturamentocedulapromotora.com.br
NEXT_PUBLIC_OWNER_EMAIL=cedulapromotora@gmail.com
```

`NEXT_PUBLIC_*` entram no **build** do Docker: após alterar, **`docker compose build --no-cache`** (ou `up -d --build`).

### Certbot + Nginx

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
```

**Primeiro certificado:** com o Nginx a servir só HTTP no domínio (ou com o bloco `:443` do ficheiro abaixo **comentado** até existirem os ficheiros em `/etc/letsencrypt/live/...`), usa por exemplo:

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d faturamentocedulapromotora.com.br \
  --email cedulapromotora@gmail.com --agree-tos --non-interactive
```

Ou `sudo certbot --nginx -d faturamentocedulapromotora.com.br` (o plugin pode editar o teu site).

Depois ativa o virtual host completo:

```bash
sudo cp deploy/hostinger/nginx/vhost-faturamentocedulapromotora.com.br.conf \
  /etc/nginx/sites-available/faturamento-cedula.conf
sudo ln -sf /etc/nginx/sites-available/faturamento-cedula.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Renovação: `sudo certbot renew` (cron do sistema costuma instalar-se automaticamente).

### Resumo de URLs

| O quê | URL |
|--------|-----|
| Frontend | `https://faturamentocedulapromotora.com.br` |
| API (browser) | `https://faturamentocedulapromotora.com.br/integration/...` |
| Admin Django | `https://faturamentocedulapromotora.com.br/admin/` |

## Ficheiros nesta pasta

| Ficheiro | Função |
|----------|--------|
| `nginx/vhost-ip-https.conf` | HTTPS por **IP** (certificado autoassinado) |
| `nginx/vhost-faturamentocedulapromotora.com.br.conf` | HTTPS **Let's Encrypt** + proxy Next + Django |
| `scripts/gerar-certificado-selfsigned.sh` | Certificado com SAN=IP |

Variáveis: **`.env`** em cada pasta do projeto. O `docker-compose.yml` do frontend passa **build args** para `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_OWNER_EMAIL` (ver `Dockerfile`).
