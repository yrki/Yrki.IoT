#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# --- ANSI colors ---
if [[ -t 1 ]]; then
  RESET=$'\033[0m'
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  CYAN=$'\033[38;5;51m'
  RED=$'\033[38;5;196m'
  GREEN=$'\033[38;5;46m'
  YELLOW=$'\033[38;5;220m'
  PURPLE=$'\033[38;5;141m'
  BLUE=$'\033[38;5;75m'
else
  RESET='' BOLD='' DIM='' CYAN='' RED='' GREEN='' YELLOW='' PURPLE='' BLUE=''
fi

DIVIDER='━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

print_step() {
  printf '\n%s▸ %s%s\n' "${BOLD}${PURPLE}" "$1" "${RESET}"
}

# --- Banner ---
printf '\n'
printf '%s' "${CYAN}${BOLD}"
cat <<'EOF'
     __ __     _   _
    |  |  |___| |_|_|
    |_   _|  _| '_| |        Y R K I   ·   I o T
      |_| |_| |_,_|_|
EOF
printf '%s\n' "${RESET}"
printf '    %s%s%s\n' "${DIM}" "upgrade · redeploy · ship it" "${RESET}"
printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '\n'
printf '    %s▸  Upgrade Instance%s\n' "${YELLOW}${BOLD}" "${RESET}"
printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '\n'

# --- Read Hetzner token ---
HCLOUD_TOKEN="${HCLOUD_TOKEN:-}"
if [[ -z "$HCLOUD_TOKEN" && -f "$ROOT_DIR/.secrets/hetzner.token" ]]; then
  HCLOUD_TOKEN=$(cat "$ROOT_DIR/.secrets/hetzner.token" | tr -d '[:space:]')
fi

if [[ -z "$HCLOUD_TOKEN" ]]; then
  printf '  %sHetzner API token%s: ' "${BOLD}" "${RESET}"
  read -r HCLOUD_TOKEN
fi

[[ -z "$HCLOUD_TOKEN" ]] && { printf '  %s✗ Token required.%s\n' "${RED}" "${RESET}"; exit 1; }

# --- Fetch instances ---
printf '  %sFetching instances...%s\n' "${DIM}" "${RESET}"

SERVERS=$(curl -s -H "Authorization: Bearer $HCLOUD_TOKEN" "https://api.hetzner.cloud/v1/servers" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for s in data.get('servers', []):
    if s['name'].startswith('yrki-'):
        ip = s['public_net']['ipv4']['ip']
        status = s['status']
        st = s['server_type']['name']
        dc = s['datacenter']['name']
        print(f\"{s['name']}|{ip}|{status}|{st}|{dc}\")
" 2>/dev/null || echo "")

if [[ -z "$SERVERS" ]]; then
  printf '  %sNo Yrki instances found.%s\n\n' "${DIM}" "${RESET}"
  exit 0
fi

# --- Pick instance ---
printf '\n  %sAvailable instances:%s\n\n' "${BOLD}" "${RESET}"

i=1
while IFS='|' read -r name ip status type dc; do
  status_color="${GREEN}"
  [[ "$status" != "running" ]] && status_color="${YELLOW}"
  printf '  %s%d)%s  %s%-30s%s  %s%-16s%s %s%-8s%s  %s  %s\n' \
    "${YELLOW}" "$i" "${RESET}" \
    "${BOLD}" "$name" "${RESET}" \
    "${BLUE}" "$ip" "${RESET}" \
    "${status_color}" "$status" "${RESET}" \
    "$type" "$dc"
  ((i++))
done <<< "$SERVERS"

printf '\n  %sSelect instance to upgrade (or q to quit)%s: ' "${BOLD}" "${RESET}"
read -r choice
[[ "$choice" == "q" || -z "$choice" ]] && { printf '  %sCancelled.%s\n\n' "${DIM}" "${RESET}"; exit 0; }

TARGET_LINE=$(echo "$SERVERS" | sed -n "${choice}p")
[[ -z "$TARGET_LINE" ]] && { printf '  %s✗ Invalid selection.%s\n' "${RED}" "${RESET}"; exit 1; }

IFS='|' read -r TARGET_NAME TARGET_IP TARGET_STATUS _ _ <<< "$TARGET_LINE"

printf '\n'
printf '  %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '  %sTarget:%s  %s%s%s  (%s%s%s)\n' "${BOLD}" "${RESET}" "${GREEN}" "$TARGET_NAME" "${RESET}" "${BLUE}" "$TARGET_IP" "${RESET}"
printf '  %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '\n'

printf -v confirm_prompt '  %sDeploy latest code to %s? [y/N]%s ' "${YELLOW}${BOLD}" "$TARGET_NAME" "${RESET}"
read -rp "$confirm_prompt" confirm
[[ "${confirm}" != [yY] ]] && { printf '\n  %sCancelled.%s\n\n' "${DIM}" "${RESET}"; exit 0; }

# --- Build ---
print_step "Building backend images locally..."
rm -rf src/backend/Api/bin/Release src/backend/Service/bin/Release
dotnet publish src/backend/Api/Api.csproj /t:PublishContainer -p:ContainerRuntimeIdentifier=linux-x64 -v:q
dotnet publish src/backend/Service/Service.csproj /t:PublishContainer -p:ContainerRuntimeIdentifier=linux-musl-x64 -v:q

print_step "Building frontend image (linux/amd64)..."
docker build --platform linux/amd64 -t yrkiiot-frontend:latest -f src/frontend/dockerfile . --quiet

# --- Transfer ---
print_step "Transferring images to ${TARGET_IP}..."
docker save yrkiiot-api yrkiiot-service yrkiiot-frontend | ssh "root@${TARGET_IP}" 'docker load'

# --- Sync config ---
print_step "Syncing config..."
REMOTE_DIR="/opt/yrki-iot"

ssh "root@${TARGET_IP}" "mkdir -p ${REMOTE_DIR}/volumes/mosquitto/config"

rsync -az \
  docker-compose.prod.yml \
  Caddyfile \
  "root@${TARGET_IP}:${REMOTE_DIR}/"

rsync -az \
  volumes/mosquitto/config/ \
  "root@${TARGET_IP}:${REMOTE_DIR}/volumes/mosquitto/config/"

# Don't touch .env.prod — it was generated during provisioning
if ssh -o BatchMode=yes "root@${TARGET_IP}" "test -f ${REMOTE_DIR}/.env.prod"; then
  printf '  %s.env.prod exists — keeping it.%s\n' "${DIM}" "${RESET}"
else
  printf '  %s⚠  No .env.prod on remote. Run provision.sh first or create one manually.%s\n' "${RED}" "${RESET}"
  exit 1
fi

# --- Restart ---
print_step "Restarting services..."
ssh "root@${TARGET_IP}" <<DEPLOY
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
printf '    %s✦  Upgrade complete!%s\n' "${GREEN}${BOLD}" "${RESET}"
printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '\n'
printf '    %s%-14s%s %s%s%s\n' "${BOLD}" "Instance:" "${RESET}" "${GREEN}" "$TARGET_NAME" "${RESET}"
printf '    %s%-14s%s %s%s%s\n' "${BOLD}" "IP:" "${RESET}" "${BLUE}" "$TARGET_IP" "${RESET}"
printf '\n'
