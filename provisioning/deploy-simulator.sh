#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

REMOTE_DIR="/opt/yrki-iot"

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

DIVIDER='━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━��━━━━━━━━━━━━━━━━━━━━━'

print_step()  { printf '\n%s▸ %s%s\n' "${BOLD}${PURPLE}" "$1" "${RESET}"; }
print_info()  { printf '  %s%s%s\n' "${DIM}" "$1" "${RESET}"; }
print_ok()    { printf '  %s✓ %s%s\n' "${GREEN}" "$1" "${RESET}"; }
print_warn()  { printf '  %s⚠ %s%s\n' "${YELLOW}" "$1" "${RESET}"; }
print_error() { printf '  %s✗ %s%s\n' "${RED}" "$1" "${RESET}"; }

# ══════════��════════════════════════════════════════════════════
#  Banner
# ════════════���════════════════════════════════���═════════════════

printf '\n'
printf '%s' "${CYAN}${BOLD}"
cat <<'EOF'
     __ __     _   _
    |  |  |___| |_|_|
    |_   _|  _| '_| |        Y R K I   ·   I o T
      |_| |_| |_,_|_|
EOF
printf '%s\n' "${RESET}"
printf '    %s%s%s\n' "${DIM}" "deploy simulator + demo data" "${RESET}"
printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"

# ═══���══════════════════���═══════════════════════════════════��════
#  Select instance
# ═══════════════════════���════════════════════════════��══════════

REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_USER="${REMOTE_USER:-root}"

if [[ -z "$REMOTE_HOST" ]]; then
  print_step "Fetching Yrki instances..."

  HCLOUD_TOKEN="${HCLOUD_TOKEN:-}"
  if [[ -z "$HCLOUD_TOKEN" && -f "$ROOT_DIR/.secrets/hetzner.token" ]]; then
    HCLOUD_TOKEN=$(cat "$ROOT_DIR/.secrets/hetzner.token" | tr -d '[:space:]')
  fi

  if [[ -z "$HCLOUD_TOKEN" ]]; then
    printf '  %sHetzner API token%s: ' "${BOLD}" "${RESET}"
    read -r HCLOUD_TOKEN
  fi

  [[ -z "$HCLOUD_TOKEN" ]] && { print_error "Hetzner API token required."; exit 1; }

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
    print_error "No Yrki instances found. Run provision.sh first."
    exit 1
  fi

  # Build arrays for selection
  declare -a NAMES=() IPS=() STATUSES=() TYPES=() DCS=()
  while IFS='|' read -r name ip status type dc; do
    NAMES+=("$name")
    IPS+=("$ip")
    STATUSES+=("$status")
    TYPES+=("$type")
    DCS+=("$dc")
  done <<< "$SERVERS"

  printf '\n'
  printf '  %s%-4s %-30s %-16s %-8s %-8s %s%s\n' "${DIM}" "#" "NAME" "IP" "STATUS" "TYPE" "LOCATION" "${RESET}"
  printf '  %s──── ────���───────────────────────── ──────────���───── ──────── ──────── ────────%s\n' "${DIM}" "${RESET}"

  for i in "${!NAMES[@]}"; do
    sc="${GREEN}"
    [[ "${STATUSES[$i]}" != "running" ]] && sc="${YELLOW}"
    printf '  %s%-4s%s %s%-30s%s %s%-16s%s %s%-8s%s %-8s %s\n' \
      "${BOLD}" "$((i + 1))" "${RESET}" \
      "${BOLD}" "${NAMES[$i]}" "${RESET}" \
      "${BLUE}" "${IPS[$i]}" "${RESET}" \
      "${sc}" "${STATUSES[$i]}" "${RESET}" \
      "${TYPES[$i]}" "${DCS[$i]}"
  done

  printf '\n'
  printf '  %sSelect instance%s [1-%d]: ' "${BOLD}" "${RESET}" "${#NAMES[@]}"
  read -r SELECTION

  if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || (( SELECTION < 1 || SELECTION > ${#NAMES[@]} )); then
    print_error "Invalid selection."
    exit 1
  fi

  REMOTE_HOST="${IPS[$((SELECTION - 1))]}"
  SELECTED_NAME="${NAMES[$((SELECTION - 1))]}"
  print_ok "Selected: ${SELECTED_NAME} (${REMOTE_HOST})"
fi

print_info "Target: ${REMOTE_USER}@${REMOTE_HOST}"

# ═════════════════════════════════���═════════════════════════════
#  Confirmation
# ════════════��══════════════════════════════════════════════════

printf '\n'
printf '  %s⚠  This will deploy the simulator with demo data to %s%s%s\n' "${YELLOW}" "${BOLD}" "${REMOTE_HOST}" "${RESET}"
printf '  %sIt will seed ~200 sensors and ~7 gateways into the database.%s\n' "${DIM}" "${RESET}"
printf '\n'
printf '  %sAre you sure you want to continue?%s [y/N]: ' "${BOLD}" "${RESET}"
read -r CONFIRM

if [[ ! "$CONFIRM" =~ ^[yY]$ ]]; then
  print_info "Aborted."
  exit 0
fi

# ═════��════════════════════════════���════════════════════════════
#  Verify SSH + remote state
# ══════��════════════════════════════════════════════════════════

print_step "Verifying SSH connectivity..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" 'echo ok' &>/dev/null; then
  print_error "Cannot reach ${REMOTE_USER}@${REMOTE_HOST} via SSH."
  exit 1
fi
print_ok "SSH connected"

if ! ssh -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" "test -f ${REMOTE_DIR}/.env.prod"; then
  print_error "No .env.prod found on remote. Run provision.sh first."
  exit 1
fi
print_ok "Remote .env.prod found"

# ════��═════════════════════════════════��════════════════════════
#  Build simulator image
# ═════��══════════════════════════��═════════════════════════��════

print_step "Building simulator image..."
dotnet publish src/backend/Simulator/Simulator.csproj /t:PublishContainer -p:ContainerRuntimeIdentifier=linux-musl-x64 -v:q
print_ok "Simulator image built"

# ══════��═════════════════════════════════════════════════════���══
#  Transfer image
# ═════════════════════════��═══════════════════════════════════��═

print_step "Transferring simulator image to ${REMOTE_HOST}..."
docker save yrkiiot-simulator | ssh "${REMOTE_USER}@${REMOTE_HOST}" 'docker load'
print_ok "Image transferred"

print_step "Uploading compose file..."
rsync -az \
  docker-compose.simulator.yml \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

print_ok "Files uploaded"

# ═════���═══════════════���═════════════════════════════════════════
#  Start simulator
# ════════════════════════════════════════════════════════��══════

print_step "Starting simulator service..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" <<DEPLOY
  set -euo pipefail
  cd ${REMOTE_DIR}

  # Stop any existing simulator
  docker compose \
    -f docker-compose.prod.yml \
    -f docker-compose.simulator.yml \
    --env-file .env.prod \
    stop simulator 2>/dev/null || true

  docker compose \
    -f docker-compose.prod.yml \
    -f docker-compose.simulator.yml \
    --env-file .env.prod \
    rm -f simulator 2>/dev/null || true

  # Start simulator alongside existing prod services
  docker compose \
    -f docker-compose.prod.yml \
    -f docker-compose.simulator.yml \
    --env-file .env.prod \
    up -d simulator

  echo "---"
  docker compose \
    -f docker-compose.prod.yml \
    -f docker-compose.simulator.yml \
    --env-file .env.prod \
    ps
DEPLOY

print_ok "Simulator deployed and running"

# ═══════════════════════════════════════════════════════════════
#  Summary
# ════════��════════════════════���═════════════════════════════════

printf '\n    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '\n'
printf '    %s%sDone!%s\n' "${GREEN}" "${BOLD}" "${RESET}"
printf '\n'
printf '    The simulator will:\n'
printf '    1. Seed ~200 AXI water meter sensors from Gjerstad addresses\n'
printf '    2. Place ~7 gateways at high-density cluster centers\n'
printf '    3. Simulate readings with distance-based RSSI (up to 2000m range)\n'
printf '\n'
printf '    View logs: ssh %s "docker logs -f yrki-iot-simulator-1"\n' "${REMOTE_USER}@${REMOTE_HOST}"
printf '\n'
