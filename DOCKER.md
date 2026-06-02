# Docker Compose (frontend isolado)

Nesta pasta o `docker-compose.yml` sobe só o **Next.js** (porta 3000).

## Ligação ao backend

O Django corre **noutro processo** (por exemplo o compose em `back_cedula_promotora/` ou um servidor à parte).

1. (Opcional) `cp .env.example .env` e edite. Sem `.env`, o compose usa valores por defeito para subir rápido; **em produção** defina `NEXTAUTH_SECRET` e URLs reais.

2. Ajuste `NEXT_INTEGRATION_URL`:
   - **Backend no mesmo host**, exposto na porta 8005: o compose já define `host.docker.internal` (Linux com Docker 20.10+ e Docker Desktop).
   - **Backend noutra máquina ou domínio**: use a URL HTTPS completa até `/integration`.

3. `NEXTAUTH_URL` deve ser a URL **pública** onde os utilizadores abrem o site (ex.: `https://app.seudominio.com`).

4. Subir:

   ```bash
   docker compose up -d --build
   ```

## Ordem recomendada

1. Subir primeiro o backend (Postgres + API).  
2. Depois subir o front.

## Hostinger

Use VPS com Docker. Alojamento partilhado em geral **não** suporta Docker Compose.
