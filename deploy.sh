#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# --- Configuration ---
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:?Set REMOTE_HOST to your Hetzner server IP or hostname}"
REMOTE_DIR="/opt/yrki-iot"

IMAGES=(yrkiiot-api yrkiiot-service yrkiiot-frontend)

# --- ANSI colors (only when stdout is a TTY) ---
if [[ -t 1 ]]; then
  RESET=$'\033[0m'
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  CYAN=$'\033[38;5;51m'
  RED=$'\033[38;5;196m'
  GREEN=$'\033[38;5;46m'
  YELLOW=$'\033[38;5;220m'
  PURPLE=$'\033[38;5;141m'
else
  RESET=''
  BOLD=''
  DIM=''
  CYAN=''
  RED=''
  GREEN=''
  YELLOW=''
  PURPLE=''
fi

DIVIDER='━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

print_banner() {
  printf '\n'
  printf '%s' "${CYAN}${BOLD}"
  cat <<'EOF'
     __ __     _   _
    |  |  |___| |_|_|
    |_   _|  _| '_| |        Y R K I   ·   I o T
      |_| |_| |_,_|_|
EOF
  printf '%s\n' "${RESET}"
  printf '    %s%s%s\n' "${DIM}" "sensors · gateways · raw payloads · maps · realtime" "${RESET}"
  printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
}

print_step() {
  printf '\n%s▸ %s%s\n' "${BOLD}${PURPLE}" "$1" "${RESET}"
}

# --- Banner ---
print_banner

# --- Production confirmation ---
printf '\n'
printf '    %s⚠  PRODUCTION DEPLOY%s\n' "${RED}${BOLD}" "${RESET}"
printf '    %sTarget: %s%s@%s%s:%s%s\n' "${DIM}" "${BOLD}" "${REMOTE_USER}" "${REMOTE_HOST}" "${RESET}${DIM}" "${REMOTE_DIR}" "${RESET}"
printf '\n'
printf '    This will build all images, push them to the remote\n'
printf '    server, and restart the production services.\n'
printf '\n'
printf -v prompt '    %sAre you sure you want to deploy to production? [y/N]%s ' "${YELLOW}${BOLD}" "${RESET}"
read -rp "$prompt" confirm
printf '\n'

if [[ "${confirm}" != [yY] ]]; then
  printf '    %sDeploy cancelled.%s\n\n' "${DIM}" "${RESET}"
  exit 0
fi

# --- Build ---
print_step "Building backend images locally..."
dotnet publish src/backend/Api/Api.csproj /t:PublishContainer -p:ContainerRuntimeIdentifier=linux-musl-x64
dotnet publish src/backend/Service/Service.csproj /t:PublishContainer -p:ContainerRuntimeIdentifier=linux-musl-x64

print_step "Building frontend image locally for linux/amd64..."
docker build \
  --platform linux/amd64 \
  -t yrkiiot-frontend:latest \
  -f src/frontend/dockerfile \
  .

# --- Transfer ---
print_step "Transferring images to ${REMOTE_HOST}..."
docker save "${IMAGES[@]}" | ssh "${REMOTE_USER}@${REMOTE_HOST}" 'docker load'

print_step "Syncing config to remote..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}/volumes/mosquitto/config"

rsync -avz \
  docker-compose.prod.yml \
  Caddyfile \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

# Only upload .env.prod if one doesn't already exist on the remote
if ssh -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" "test -f ${REMOTE_DIR}/.env.prod"; then
  printf '  %s.env.prod already exists on remote — keeping it.%s\n' "${DIM}" "${RESET}"
else
  if [[ -f .secrets/prod.env ]]; then
    printf '  %s⚠  Uploading .secrets/prod.env (no existing file on remote)%s\n' "${YELLOW}" "${RESET}"
    rsync -avz .secrets/prod.env "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/.env.prod"
  elif [[ -f .env.prod ]]; then
    printf '  %s⚠  Uploading .env.prod (no existing file on remote)%s\n' "${YELLOW}" "${RESET}"
    rsync -avz .env.prod "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
  else
    printf '  %s⚠  No .env.prod found locally or on remote. Create one on the server:%s\n' "${RED}" "${RESET}"
    printf '  %s   ssh %s@%s nano %s/.env.prod%s\n' "${DIM}" "${REMOTE_USER}" "${REMOTE_HOST}" "${REMOTE_DIR}" "${RESET}"
  fi
fi

rsync -avz \
  volumes/mosquitto/config/ \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/volumes/mosquitto/config/"

# --- Start ---
print_step "Starting services on remote..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" <<DEPLOY
  set -euo pipefail
  cd ${REMOTE_DIR}
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
  docker compose -f docker-compose.prod.yml --env-file .env.prod ps
DEPLOY

# --- Done ---
printf '\n'
printf '%s' "${CYAN}${BOLD}"
cat <<'EOF'
     __ __     _   _
    |  |  |___| |_|_|
    |_   _|  _| '_| |        Y R K I   ·   I o T
      |_| |_| |_,_|_|
EOF
printf '%s\n' "${RESET}"
printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '    %s✦  Deploy complete%s\n' "${GREEN}${BOLD}" "${RESET}"
printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '\n'
