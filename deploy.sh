#!/usr/bin/env bash
# Bitta skript bilan serverga o'rnatish (Ubuntu/Debian VPS yoki Docker o'rnatilgan kompyuter).
# Ishlatish:  bash deploy.sh
set -e
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker o'rnatilmoqda..."
  curl -fsSL https://get.docker.com | sh
fi

rand() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

if [ ! -f .env ]; then
  echo "Birinchi sozlash. Parollarni o'ylab toping (kamida 8 belgi)."
  read -r -p "Admin paroli: " ADMIN_PASSWORD
  read -r -p "Bo'lim boshlig'i paroli: " OPERATOR_PASSWORD
  cat > .env <<ENV
ADMIN_PASSWORD=$ADMIN_PASSWORD
OPERATOR_PASSWORD=$OPERATOR_PASSWORD
SESSION_SECRET=$(rand 48)
DB_PASSWORD=$(rand 24)
PORT=3000
ENV
  chmod 600 .env
  echo ".env fayli yaratildi."
fi

docker compose up -d --build
echo
echo "Tayyor! Brauzerda oching:  http://SERVER_IP:3000"
echo "Loglarni ko'rish:  docker compose logs -f app"
echo "To'xtatish:        docker compose down"
