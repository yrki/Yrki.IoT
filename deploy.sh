#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:?Set REMOTE_HOST to your Hetzner server IP or hostname}"
REMOTE_DIR="/opt/yrki-iot"

# All container images are built locally and pushed via 'docker save | docker
# load' so the remote Hetzner box never has to run npm/dotnet/build steps.
# Building the frontend on a 2-core / 4 GB Hetzner box takes 3-7 minutes; the
# Mac builds it in a fraction of that even via QEMU emulation.
IMAGES=(yrkiiot-api yrkiiot-service yrkiiot-frontend)

echo "==> Building backend images locally..."
dotnet publish src/backend/Api/Api.csproj /t:PublishContainer -p:ContainerRuntimeIdentifier=linux-musl-x64
dotnet publish src/backend/Service/Service.csproj /t:PublishContainer -p:ContainerRuntimeIdentifier=linux-musl-x64

echo "==> Building frontend image locally for linux/amd64..."
docker build \
  --platform linux/amd64 \
  -t yrkiiot-frontend:latest \
  -f src/frontend/dockerfile \
  .

echo "==> Transferring images to ${REMOTE_HOST}..."
docker save "${IMAGES[@]}" | ssh "${REMOTE_USER}@${REMOTE_HOST}" 'docker load'

echo "==> Syncing config to remote..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}/volumes/mosquitto/config"

rsync -avz \
  docker-compose.prod.yml \
  Caddyfile \
  .env.prod \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

rsync -avz \
  volumes/mosquitto/config/ \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/volumes/mosquitto/config/"

echo "==> Starting services on remote..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" <<DEPLOY
  set -euo pipefail
  cd ${REMOTE_DIR}
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
  docker compose -f docker-compose.prod.yml --env-file .env.prod ps
DEPLOY

echo "==> Deploy complete"
