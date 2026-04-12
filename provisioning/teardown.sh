#!/usr/bin/env bash
set -euo pipefail

# --- ANSI colors ---
if [[ -t 1 ]]; then
  RESET=$'\033[0m'
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  CYAN=$'\033[38;5;51m'
  RED=$'\033[38;5;196m'
  GREEN=$'\033[38;5;46m'
  YELLOW=$'\033[38;5;220m'
else
  RESET='' BOLD='' DIM='' CYAN='' RED='' GREEN='' YELLOW=''
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
printf '    %s▸  Teardown Instance%s\n' "${RED}${BOLD}" "${RESET}"
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

[[ -z "$HCLOUD_TOKEN" ]] && { printf '  %s✗ Token required.%s\n' "${RED}" "${RESET}"; exit 1; }

# List servers
printf '  %sFetching servers...%s\n' "${DIM}" "${RESET}"
SERVERS=$(curl -s -H "Authorization: Bearer $HCLOUD_TOKEN" "https://api.hetzner.cloud/v1/servers" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for s in data.get('servers', []):
    if s['name'].startswith('yrki-'):
        ip = s['public_net']['ipv4']['ip']
        print(f\"{s['id']}|{s['name']}|{ip}|{s['server_type']['name']}|{s['datacenter']['name']}\")
" 2>/dev/null || echo "")

if [[ -z "$SERVERS" ]]; then
  printf '  %sNo Yrki servers found.%s\n\n' "${DIM}" "${RESET}"
  exit 0
fi

printf '\n  %sYrki servers:%s\n\n' "${BOLD}" "${RESET}"
i=1
while IFS='|' read -r id name ip type dc; do
  printf '  %s%d)%s  %s%-30s%s  %s%s%s  %s  %s\n' "${YELLOW}" "$i" "${RESET}" "${BOLD}" "$name" "${RESET}" "${DIM}" "$ip" "${RESET}" "$type" "$dc"
  ((i++))
done <<< "$SERVERS"

printf '\n  %sEnter number to delete (or q to quit)%s: ' "${BOLD}" "${RESET}"
read -r choice
[[ "$choice" == "q" || -z "$choice" ]] && { printf '  %sCancelled.%s\n\n' "${DIM}" "${RESET}"; exit 0; }

TARGET_LINE=$(echo "$SERVERS" | sed -n "${choice}p")
[[ -z "$TARGET_LINE" ]] && { printf '  %s✗ Invalid selection.%s\n' "${RED}" "${RESET}"; exit 1; }

IFS='|' read -r TARGET_ID TARGET_NAME TARGET_IP _ _ <<< "$TARGET_LINE"

printf '\n  %s⚠  This will PERMANENTLY DELETE server %s (%s)%s\n' "${RED}${BOLD}" "$TARGET_NAME" "$TARGET_IP" "${RESET}"
printf '  %sAll data on this server will be lost.%s\n\n' "${DIM}" "${RESET}"
printf -v del_prompt '  %sType the server name to confirm:%s ' "${YELLOW}${BOLD}" "${RESET}"
read -rp "$del_prompt" confirm_name

if [[ "$confirm_name" != "$TARGET_NAME" ]]; then
  printf '  %sName does not match. Cancelled.%s\n\n' "${DIM}" "${RESET}"
  exit 0
fi

printf '  Deleting %s...\n' "$TARGET_NAME"
curl -s -X DELETE -H "Authorization: Bearer $HCLOUD_TOKEN" "https://api.hetzner.cloud/v1/servers/$TARGET_ID" >/dev/null

printf '  %s✓ Server %s deleted.%s\n' "${RED}" "$TARGET_NAME" "${RESET}"

# Try to clean up Cloudflare DNS
CF_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
if [[ -z "$CF_TOKEN" && -f "$ROOT_DIR/.secrets/cloudflare.token" ]]; then
  CF_TOKEN=$(cat "$ROOT_DIR/.secrets/cloudflare.token" | tr -d '[:space:]')
fi

if [[ -n "$CF_TOKEN" ]]; then
  # Extract domain from server name: yrki-demo-yrki-net → demo.yrki.net
  DOMAIN_GUESS=$(echo "$TARGET_NAME" | sed 's/^yrki-//' | tr '-' '.')

  # Find all A records pointing to this IP across all zones
  CF_ZONES=$(curl -s -H "Authorization: Bearer $CF_TOKEN" "https://api.cloudflare.com/client/v4/zones?per_page=50" | python3 -c "
import sys, json
for z in json.load(sys.stdin).get('result', []):
    print(z['id'] + '|' + z['name'])
" 2>/dev/null || echo "")

  DELETED_DNS=false
  while IFS='|' read -r zone_id zone_name; do
    [[ -z "$zone_id" ]] && continue
    RECORDS=$(curl -s -H "Authorization: Bearer $CF_TOKEN" \
      "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records?type=A&content=${TARGET_IP}" | python3 -c "
import sys, json
for r in json.load(sys.stdin).get('result', []):
    print(r['id'] + '|' + r['name'])
" 2>/dev/null || echo "")
    while IFS='|' read -r rec_id rec_name; do
      [[ -z "$rec_id" ]] && continue
      curl -s -X DELETE -H "Authorization: Bearer $CF_TOKEN" \
        "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records/${rec_id}" >/dev/null
      printf '  %s✓ Removed DNS record: %s → %s%s\n' "${GREEN}" "$rec_name" "$TARGET_IP" "${RESET}"
      DELETED_DNS=true
    done <<< "$RECORDS"
  done <<< "$CF_ZONES"

  if [[ "$DELETED_DNS" != true ]]; then
    printf '  %sNo Cloudflare DNS records found for %s.%s\n' "${DIM}" "$TARGET_IP" "${RESET}"
  fi
else
  printf '  %sDon'\''t forget to remove the DNS record for %s.%s\n' "${DIM}" "$TARGET_IP" "${RESET}"
fi

printf '\n'
