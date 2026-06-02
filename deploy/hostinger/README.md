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

## 8. Quando tiveres domínio

1. Registo **A** → IP da VPS.
2. Atualiza `.env` do backend: `ALLOWED_HOSTS` com o hostname.
3. Atualiza `.env` do frontend: `NEXTAUTH_URL=https://teudominio.com`.
4. Opcional: `NEXT_INTEGRATION_URL` pode passar a `https://teudominio.com/integration` **se** o Node conseguir validar o certificado (Let’s Encrypt público); até lá podes manter `host.docker.internal:8005` para chamadas server-side.
5. `sudo certbot --nginx -d teudominio.com` e ajusta as directivas `ssl_certificate` no Nginx.

## Ficheiros nesta pasta

| Ficheiro | Função |
|----------|--------|
| `nginx/vhost-ip-https.conf` | Virtual host completo (HTTP→HTTPS + proxy) |
| `scripts/gerar-certificado-selfsigned.sh` | Certificado com SAN=IP |

Variáveis de ambiente: ficheiro **`.env`** na raiz de cada pasta (`back_cedula_promotora/.env`, `web_sistema_emprestimos/.env`), a partir de `.env.example`. O `docker-compose.yml` de cada projeto é o único necessário.
