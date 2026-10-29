#!/bin/sh
# Run on the VPS as the deploy user, inside the checkout (/srv/zito1950): pulls main, rebuilds, restarts.
# Requires ./.env (mode 600). The shop data lives in the shop-data volume and survives rebuilds.
set -eu
cd "$(dirname "$0")/.."
git fetch -q origin main
git reset -q --hard origin/main
# Docker copies host file modes into the image, where the app runs as `node`: tracked files must be world-readable
# whatever the login umask is (.env stays 600 and is excluded from the build context).
git ls-files -z | xargs -0 chmod go+r
find . -path ./.git -prune -o -type d -exec chmod go+rx {} +
SITE_URL=$(sed -n 's/^APP_ORIGIN=//p' .env)/
docker compose build -q --build-arg VITE_SITE_URL="$SITE_URL"
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
for i in $(seq 1 30); do
  curl -fsS -o /dev/null http://127.0.0.1:8080/api/payments/config && { echo "deployed $(git rev-parse --short HEAD)"; exit 0; }
  sleep 2
done
docker compose logs --tail 50 web
exit 1
