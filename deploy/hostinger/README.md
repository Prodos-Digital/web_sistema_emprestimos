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

3. Log de erros: se existir Nginx no host, `sudo nginx -T 2>&1 | grep error_log` mostra o caminho. Se o TLS for num contentor: `docker logs <nome>`.

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
