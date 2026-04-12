#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- ANSI colors ---
if [[ -t 1 ]]; then
  RESET=$'\033[0m'
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  CYAN=$'\033[38;5;51m'
  RED=$'\033[38;5;196m'
  GREEN=$'\033[38;5;46m'
  YELLOW=$'\033[38;5;220m'
  BLUE=$'\033[38;5;75m'
else
  RESET='' BOLD='' DIM='' CYAN='' RED='' GREEN='' YELLOW='' BLUE=''
fi

DIVIDER='━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

printf '\n'
printf '%s' "${CYAN}${BOLD}"
cat <<'EOF'
     __ __     _   _
    |  |  |___| |_|_|
    |_   _|  _| '_| |        Y R K I   ·   I o T
      |_| |_| |_,_|_|
EOF
printf '%s\n' "${RESET}"
printf '    %s%s%s\n' "${DIM}" "ssh · connect · manage" "${RESET}"
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

printf '\n  %sSelect instance (or q to quit)%s: ' "${BOLD}" "${RESET}"
read -r choice
[[ "$choice" == "q" || -z "$choice" ]] && { printf '  %sCancelled.%s\n\n' "${DIM}" "${RESET}"; exit 0; }

TARGET_LINE=$(echo "$SERVERS" | sed -n "${choice}p")
[[ -z "$TARGET_LINE" ]] && { printf '  %s✗ Invalid selection.%s\n' "${RED}" "${RESET}"; exit 1; }

IFS='|' read -r TARGET_NAME TARGET_IP _ _ _ <<< "$TARGET_LINE"

printf '\n  %sConnecting to %s%s%s (%s%s%s)...%s\n\n' \
  "${DIM}" "${GREEN}" "$TARGET_NAME" "${DIM}" "${BLUE}" "$TARGET_IP" "${DIM}" "${RESET}"

exec ssh "root@${TARGET_IP}"
