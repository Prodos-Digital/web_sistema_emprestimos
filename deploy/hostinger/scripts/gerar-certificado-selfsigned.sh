#!/usr/bin/env bash
# Gera certificado TLS autoassinado com SAN=IP (HTTPS sem domínio).
# Uso: sudo bash deploy/hostinger/scripts/gerar-certificado-selfsigned.sh 72.60.143.19
set -euo pipefail

VPS_IP="${1:?Uso: $0 <IP_PUBLICO_DA_VPS>}"

SSL_DIR="${SSL_DIR:-/etc/nginx/ssl/cedula}"
mkdir -p "$SSL_DIR"

KEY="$SSL_DIR/selfsigned.key"
CRT="$SSL_DIR/selfsigned.crt"
TMP="$(mktemp)"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

cat >"$TMP" <<EOF
[req]
default_bits       = 2048
distinguished_name = req_distinguished_name
req_extensions     = v3_req
prompt             = no

[req_distinguished_name]
CN = ${VPS_IP}

[v3_req]
subjectAltName = @alt_names
keyUsage         = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
IP.1 = ${VPS_IP}
EOF

openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout "$KEY" -out "$CRT" \
  -config "$TMP" -extensions v3_req

chmod 640 "$KEY"
chmod 644 "$CRT"

echo "OK: $CRT"
echo "OK: $KEY"
