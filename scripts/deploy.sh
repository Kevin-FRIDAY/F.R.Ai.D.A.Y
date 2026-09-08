#!/usr/bin/env bash
# F.R.Ai.D.A.Y — deploy script for a Debian/Ubuntu server.
#
# Sets up Node.js, pulls the app into /opt/fraiday, runs it as a
# dedicated system user under systemd, and fronts it with Nginx +
# a Let's Encrypt certificate for the given domain.
#
# Run as root (or via sudo) ON THE TARGET SERVER, not from this repo's CI:
#   sudo bash scripts/deploy.sh
#
# Review this script before running it, especially if you piped it
# straight from curl.

set -euo pipefail

APP_DIR="/opt/fraiday"
APP_USER="fraiday"
REPO_URL="https://github.com/Kevin-FRIDAY/F.R.Ai.D.A.Y.git"
BRANCH="${FRAIDAY_BRANCH:-claude/iron-man-dashboard-3mo37y}"
DOMAIN="${FRAIDAY_DOMAIN:-fraiday-ai.duckdns.org}"
PORT="${FRAIDAY_PORT:-3000}"

if [[ $EUID -ne 0 ]]; then
  echo "Bitte als root ausführen (sudo bash scripts/deploy.sh)." >&2
  exit 1
fi

echo "==> Pakete aktualisieren"
apt-get update -y

echo "==> Node.js 22 sicherstellen"
if ! command -v node >/dev/null || [[ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> Nginx & Certbot sicherstellen"
apt-get install -y nginx certbot python3-certbot-nginx git

echo "==> Dedizierten Systembenutzer '${APP_USER}' anlegen"
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "${APP_USER}"
fi

echo "==> Code nach ${APP_DIR} holen"
if [[ -d "${APP_DIR}/.git" ]]; then
  git -C "${APP_DIR}" fetch origin "${BRANCH}"
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
else
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

echo "==> Abhängigkeiten installieren"
cd "${APP_DIR}"
npm ci --omit=dev

echo "==> Datenverzeichnis vorbereiten"
mkdir -p "${APP_DIR}/server/data"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "==> systemd-Service einrichten"
cat > /etc/systemd/system/fraiday.service <<EOF
[Unit]
Description=F.R.Ai.D.A.Y HUD + Gehirn
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
Environment=NODE_ENV=production
ExecStart=$(command -v node) server/index.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/server/data
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable fraiday
systemctl restart fraiday

echo "==> Nginx als Reverse-Proxy einrichten"
cat > "/etc/nginx/sites-available/${DOMAIN}" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
nginx -t
systemctl reload nginx

echo "==> Firewall (falls ufw aktiv) öffnen"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' || true
fi

echo "==> Let's Encrypt Zertifikat holen"
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo
echo "Fertig. F.R.Ai.D.A.Y läuft unter https://${DOMAIN}"
echo "Service-Status: systemctl status fraiday"
echo "Logs:           journalctl -u fraiday -f"
