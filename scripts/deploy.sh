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

echo "==> Chromium-Laufzeitbibliotheken sicherstellen (für WhatsApp-Integration/Puppeteer)"
apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64 \
  libpango-1.0-0 libcairo2 libgtk-3-0 || \
apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
  libpango-1.0-0 libcairo2 libgtk-3-0

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

echo "==> .env vorbereiten (falls noch nicht vorhanden)"
if [[ ! -f "${APP_DIR}/.env" ]]; then
  cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
  sed -i "s#^BASE_URL=.*#BASE_URL=https://${DOMAIN}#" "${APP_DIR}/.env"
  echo "   -> ${APP_DIR}/.env angelegt. Für Google/Spotify/YouTube bitte editieren (siehe README)."
fi

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
chmod 600 "${APP_DIR}/.env"

echo "==> systemd-Service einrichten"
cat > /etc/systemd/system/fraiday.service <<EOF
[Unit]
Description=F.R.Ai.D.A.Y HUD + Gehirn
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=-${APP_DIR}/.env
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

echo "==> Bestehende Nginx-Konfigurationen für ${DOMAIN} ersetzen"
BACKUP_DIR="/etc/nginx/disabled-by-fraiday-deploy"
mkdir -p "${BACKUP_DIR}"
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
  [[ -e "${f}" ]] || continue
  # Unsere eigene Zielkonfiguration wird gleich unten neu geschrieben, die lassen wir hier aus.
  if [[ "${f}" == "/etc/nginx/sites-enabled/${DOMAIN}" ]]; then
    continue
  fi
  if grep -Eq "server_name[[:space:]]+.*\b${DOMAIN}\b" "${f}" 2>/dev/null; then
    dest="${BACKUP_DIR}/$(basename "${f}").$(date +%s).bak"
    echo "   -> ersetze bestehende Konfiguration: ${f} (gesichert nach ${dest})"
    mv "${f}" "${dest}"
  fi
done

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
echo "Integrationen:  ${APP_DIR}/.env editieren (siehe README), dann: systemctl restart fraiday"
