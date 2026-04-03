#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:?Set REMOTE_HOST to your Hetzner server IP or hostname}"
REMOTE_DIR="/opt/yrki-iot"

IMAGES=(yrkiiot-api yrkiiot-service)

echo "==> Building backend images locally..."
dotnet publish src/backend/Api/Api.csproj /t:PublishContainer -p:ContainerRuntimeIdentifier=linux-musl-x64
dotnet publish src/backend/Service/Service.csproj /t:PublishContainer -p:ContainerRuntimeIdentifier=linux-musl-x64

echo "==> Transferring backend images to ${REMOTE_HOST}..."
docker save "${IMAGES[@]}" | ssh "${REMOTE_USER}@${REMOTE_HOST}" 'docker load'

echo "==> Syncing config and frontend source..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}/volumes/mosquitto/config ${REMOTE_DIR}/src/frontend"

rsync -avz \
  docker-compose.prod.yml \
  Caddyfile \
  .env.prod \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

rsync -avz \
  volumes/mosquitto/config/ \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/volumes/mosquitto/config/"

rsync -avz --delete \
  src/frontend/ \
  --exclude 'node_modules' \
  --exclude 'dist' \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/src/frontend/"

echo "==> Building frontend and starting services on remote..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" << DEPLOY
  cd ${REMOTE_DIR}
  docker build -t yrkiiot-frontend -f src/frontend/dockerfile .
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
  docker compose -f docker-compose.prod.yml --env-file .env.prod ps
DEPLOY

echo "==> Deploy complete"
