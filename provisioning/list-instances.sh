#!/usr/bin/env bash
set -euo pipefail

# --- ANSI colors ---
if [[ -t 1 ]]; then
  RESET=$'\033[0m'
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  CYAN=$'\033[38;5;51m'
  GREEN=$'\033[38;5;46m'
  YELLOW=$'\033[38;5;220m'
  BLUE=$'\033[38;5;75m'
else
  RESET='' BOLD='' DIM='' CYAN='' GREEN='' YELLOW='' BLUE=''
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
printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '    %s▸  Active Instances%s\n' "${BOLD}" "${RESET}"
printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '\n'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HCLOUD_TOKEN="${HCLOUD_TOKEN:-}"
if [[ -z "$HCLOUD_TOKEN" && -f "$ROOT_DIR/.secrets/hetzner.token" ]]; then
  HCLOUD_TOKEN=$(cat "$ROOT_DIR/.secrets/hetzner.token" | tr -d '[:space:]')
fi

if [[ -z "$HCLOUD_TOKEN" ]]; then
  printf '  %sHetzner API token%s: ' "${BOLD}" "${RESET}"
  read -r HCLOUD_TOKEN
fi

[[ -z "$HCLOUD_TOKEN" ]] && { printf '  ✗ Token required.\n'; exit 1; }

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

printf '  %s%-30s %-16s %-8s %-8s %s%s\n' "${DIM}" "NAME" "IP" "STATUS" "TYPE" "LOCATION" "${RESET}"
printf '  %s────────────────────────────── ──────────────── ──────── ──────── ────────%s\n' "${DIM}" "${RESET}"

while IFS='|' read -r name ip status type dc; do
  status_color="${GREEN}"
  [[ "$status" != "running" ]] && status_color="${YELLOW}"
  printf '  %s%-30s%s %s%-16s%s %s%-8s%s %-8s %s\n' \
    "${BOLD}" "$name" "${RESET}" \
    "${BLUE}" "$ip" "${RESET}" \
    "${status_color}" "$status" "${RESET}" \
    "$type" "$dc"
done <<< "$SERVERS"

printf '\n  %sRedeploy with: REMOTE_HOST=<ip> ./deploy.sh%s\n\n' "${DIM}" "${RESET}"
