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
  ORANGE=$'\033[38;5;208m'
else
  RESET='' BOLD='' DIM='' CYAN='' RED='' GREEN='' YELLOW='' PURPLE='' BLUE='' ORANGE=''
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
  printf '    %s%s%s\n' "${DIM}" "provision · deploy · monitor" "${RESET}"
  printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
}

print_step() {
  printf '\n%s▸ %s%s\n' "${BOLD}${PURPLE}" "$1" "${RESET}"
}

print_info() {
  printf '  %s%s%s\n' "${DIM}" "$1" "${RESET}"
}

print_ok() {
  printf '  %s✓ %s%s\n' "${GREEN}" "$1" "${RESET}"
}

print_warn() {
  printf '  %s⚠ %s%s\n' "${YELLOW}" "$1" "${RESET}"
}

print_error() {
  printf '  %s✗ %s%s\n' "${RED}" "$1" "${RESET}"
}

ask() {
  local prompt="$1" default="${2:-}"
  if [[ -n "$default" ]]; then
    printf '  %s%s%s [%s%s%s]: ' "${BOLD}" "$prompt" "${RESET}" "${DIM}" "$default" "${RESET}"
  else
    printf '  %s%s%s: ' "${BOLD}" "$prompt" "${RESET}"
  fi
  read -r REPLY
  [[ -z "$REPLY" && -n "$default" ]] && REPLY="$default" || true
}

# ═══════════════════════════════════════════════════════════════
#  Banner
# ═══════════════════════════════════════════════════════════════

print_banner
printf '\n'
printf '    %s▸  New Instance Provisioning%s\n' "${YELLOW}${BOLD}" "${RESET}"
printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '\n'

# ═══════════════════════════════════════════════════════════════
#  Gather configuration
# ═══════════════════════════════════════════════════════════════

print_step "Configuration"

ask "Domain name (e.g. demo.yrki.net)" ""
DOMAIN="$REPLY"
[[ -z "$DOMAIN" ]] && { print_error "Domain name is required."; exit 1; }

ask "Admin email" "thomas@yrki.no"
ADMIN_EMAIL="$REPLY"

# Read email defaults from local secrets (avoids hardcoding keys in the script)
for _envfile in "$ROOT_DIR/.secrets/prod.env" "$ROOT_DIR/.env.prod"; do
  if [[ -f "$_envfile" ]]; then
    [[ -z "${AZURE_EMAIL_CONNECTION_STRING:-}" ]] && AZURE_EMAIL_CONNECTION_STRING=$(grep -E "^EMAIL_CONNECTION_STRING=" "$_envfile" 2>/dev/null | cut -d= -f2- || echo "")
    [[ -z "${EMAIL_SENDER_ADDRESS:-}" ]] && EMAIL_SENDER_ADDRESS=$(grep -E "^EMAIL_SENDER_ADDRESS=" "$_envfile" 2>/dev/null | cut -d= -f2- || echo "")
    break
  fi
done

ask "Azure Email connection string" "${AZURE_EMAIL_CONNECTION_STRING:-}"
AZURE_EMAIL_CS="$REPLY"

ask "Email sender address" "${EMAIL_SENDER_ADDRESS:-donotreply@yrki.net}"
EMAIL_SENDER="$REPLY"

# Read Cloudflare token from .secrets if available
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -f "$ROOT_DIR/.secrets/cloudflare.token" ]]; then
  CLOUDFLARE_API_TOKEN=$(cat "$ROOT_DIR/.secrets/cloudflare.token" | tr -d '[:space:]')
fi

ask "Cloudflare API token (for automatic DNS, Enter to skip)" "${CLOUDFLARE_API_TOKEN:-}"
CLOUDFLARE_API_TOKEN="$REPLY"

# Read Hetzner token from .secrets if available
if [[ -z "${HCLOUD_TOKEN:-}" && -f "$ROOT_DIR/.secrets/hetzner.token" ]]; then
  HCLOUD_TOKEN=$(cat "$ROOT_DIR/.secrets/hetzner.token" | tr -d '[:space:]')
fi

ask "Hetzner API token" "${HCLOUD_TOKEN:-}"
HCLOUD_TOKEN="$REPLY"
[[ -z "$HCLOUD_TOKEN" ]] && { print_error "Hetzner API token is required. Get one at https://console.hetzner.cloud"; exit 1; }

ask "Location (fsn1/nbg1/hel1)" "hel1"
LOCATION="$REPLY"

# Fetch available server types from Hetzner API
print_info "Fetching available server types..."
AVAILABLE_TYPES=$(curl -s -H "Authorization: Bearer $HCLOUD_TOKEN" "https://api.hetzner.cloud/v1/server_types?per_page=50" | python3 -c "
import sys, json
data = json.load(sys.stdin)
types = []
for t in data.get('server_types', []):
    if t.get('deprecation') or 'x86' not in t.get('architecture',''):
        continue
    p = t.get('prices',[{}])[0].get('price_monthly',{}).get('gross','0')
    types.append((float(p), t['name'], t['cores'], int(t['memory']), t['disk']))
for _, name, cores, mem, disk in sorted(types)[:8]:
    print(f'{name}|{cores}c / {mem}GB RAM / {disk}GB disk')
" 2>/dev/null || echo "")

if [[ -n "$AVAILABLE_TYPES" ]]; then
  DEFAULT_TYPE=$(echo "$AVAILABLE_TYPES" | head -1 | cut -d'|' -f1)
  printf '  %sAvailable x86 server types:%s\n' "${DIM}" "${RESET}"
  while IFS='|' read -r name desc; do
    printf '    %s%-12s%s %s\n' "${BOLD}" "$name" "${RESET}" "$desc"
  done <<< "$AVAILABLE_TYPES"
  printf '\n'
else
  DEFAULT_TYPE="cpx21"
fi

ask "Server type" "$DEFAULT_TYPE"
SERVER_TYPE="$REPLY"

# Server name from domain (replace dots)
SERVER_NAME="yrki-${DOMAIN//[.]/-}"

printf '\n'
printf '  %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '  %sSummary:%s\n' "${BOLD}" "${RESET}"
printf '  Domain:      %s%s%s\n' "${GREEN}" "$DOMAIN" "${RESET}"
printf '  Admin:       %s%s%s\n' "${BLUE}" "$ADMIN_EMAIL" "${RESET}"
printf '  Email:       %s%s%s\n' "${DIM}" "${AZURE_EMAIL_CS:-(not configured)}" "${RESET}"
printf '  Sender:      %s%s%s\n' "${DIM}" "$EMAIL_SENDER" "${RESET}"
printf '  DNS:         %s%s%s\n' "${DIM}" "${CLOUDFLARE_API_TOKEN:+Cloudflare (automatic)}${CLOUDFLARE_API_TOKEN:-manual}" "${RESET}"
printf '  Server:      %s%s%s (%s)\n' "${YELLOW}" "$SERVER_NAME" "${RESET}" "$SERVER_TYPE"
printf '  Location:    %s\n' "$LOCATION"
printf '  %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '\n'

printf -v confirm_prompt '  %sProceed with provisioning? [y/N]%s ' "${YELLOW}${BOLD}" "${RESET}"
read -rp "$confirm_prompt" confirm
[[ "${confirm}" != [yY] ]] && { printf '\n  %sCancelled.%s\n\n' "${DIM}" "${RESET}"; exit 0; }

# ═══════════════════════════════════════════════════════════════
#  Find SSH key
# ═══════════════════════════════════════════════════════════════

print_step "SSH key"

SSH_KEY_FILE=""
for candidate in ~/.ssh/id_ed25519.pub ~/.ssh/id_rsa.pub; do
  if [[ -f "$candidate" ]]; then
    SSH_KEY_FILE="$candidate"
    break
  fi
done

if [[ -z "$SSH_KEY_FILE" ]]; then
  print_warn "No SSH public key found. Generating one..."
  ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -q
  SSH_KEY_FILE=~/.ssh/id_ed25519.pub
fi
print_ok "Using SSH key: $SSH_KEY_FILE"

SSH_KEY_CONTENT="$(cat "$SSH_KEY_FILE")"

# ═══════════════════════════════════════════════════════════════
#  Hetzner API helpers
# ═══════════════════════════════════════════════════════════════

hcloud_api() {
  local method="$1" path="$2" data="${3:-}"
  local url="https://api.hetzner.cloud/v1${path}"
  local args=(-s -H "Authorization: Bearer $HCLOUD_TOKEN" -H "Content-Type: application/json")
  if [[ -n "$data" ]]; then
    args+=(-X "$method" -d "$data")
  else
    args+=(-X "$method")
  fi
  curl "${args[@]}" "$url"
}

# ═══════════════════════════════════════════════════════════════
#  Upload SSH key to Hetzner (idempotent)
# ═══════════════════════════════════════════════════════════════

print_step "Uploading SSH key to Hetzner"

SSH_KEY_RESPONSE=$(hcloud_api POST /ssh_keys "{
  \"name\": \"yrki-provision-$(date +%s)\",
  \"public_key\": \"$SSH_KEY_CONTENT\"
}")

SSH_KEY_ID=$(echo "$SSH_KEY_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'ssh_key' in data:
    print(data['ssh_key']['id'])
" 2>/dev/null || echo "")

if [[ -z "$SSH_KEY_ID" ]]; then
  # Key probably already exists — look it up by matching the public key
  print_info "Key may already exist, looking it up..."
  ALL_KEYS=$(hcloud_api GET "/ssh_keys?per_page=50")
  SSH_KEY_ID=$(echo "$ALL_KEYS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
pub = '''$SSH_KEY_CONTENT'''.strip()
# Match by public key content (ignore trailing whitespace/comments)
pub_parts = pub.split()[:2]  # type + key, ignore comment
for key in data.get('ssh_keys', []):
    existing_parts = key.get('public_key','').strip().split()[:2]
    if pub_parts == existing_parts:
        print(key['id'])
        break
" 2>/dev/null || echo "")
fi

[[ -z "$SSH_KEY_ID" ]] && { print_error "Could not resolve SSH key ID. Check your Hetzner API token permissions."; exit 1; }
print_ok "SSH key ID: $SSH_KEY_ID"

# ═══════════════════════════════════════════════════════════════
#  Create server
# ═══════════════════════════════════════════════════════════════

print_step "Creating Hetzner server: $SERVER_NAME"

CREATE_RESPONSE=$(hcloud_api POST /servers "{
  \"name\": \"$SERVER_NAME\",
  \"server_type\": \"$SERVER_TYPE\",
  \"location\": \"$LOCATION\",
  \"image\": \"ubuntu-24.04\",
  \"ssh_keys\": [$SSH_KEY_ID],
  \"start_after_create\": true
}")

SERVER_IP=$(echo "$CREATE_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'server' in data:
    print(data['server']['public_net']['ipv4']['ip'])
else:
    print('ERROR:' + json.dumps(data.get('error', data)))
" 2>/dev/null || echo "")

if [[ "$SERVER_IP" == ERROR:* ]]; then
  print_error "Failed to create server: ${SERVER_IP#ERROR:}"
  exit 1
fi

[[ -z "$SERVER_IP" ]] && { print_error "Could not get server IP."; exit 1; }
print_ok "Server created: $SERVER_IP"

# ═══════════════════════════════════════════════════════════════
#  Wait for SSH
# ═══════════════════════════════════════════════════════════════

print_step "Waiting for SSH to become available..."

# Remove any stale host key for this IP (Hetzner reuses IPs across servers)
ssh-keygen -R "$SERVER_IP" 2>/dev/null || true

SSH_OPTS=(-o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR)

for i in $(seq 1 30); do
  if ssh "${SSH_OPTS[@]}" "root@${SERVER_IP}" 'echo ok' &>/dev/null; then
    break
  fi
  printf '  %s.' "${DIM}"
  sleep 5
done
printf '%s\n' "${RESET}"

if ! ssh "${SSH_OPTS[@]}" "root@${SERVER_IP}" 'echo ok' &>/dev/null; then
  print_error "SSH not reachable after 150 seconds."
  exit 1
fi

# Accept the host key properly now
ssh-keygen -R "$SERVER_IP" 2>/dev/null || true
ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes "root@${SERVER_IP}" 'echo ok' &>/dev/null || true

print_ok "SSH is ready"

# ═══════════════════════════════════════════════════════════════
#  Setup server (Docker, etc.)
# ═══════════════════════════════════════════════════════════════

print_step "Setting up server (Docker, firewall)..."

ssh -o BatchMode=yes "root@${SERVER_IP}" 'bash -s' < "${SCRIPT_DIR}/setup-remote.sh"

print_ok "Server setup complete"

# ═══════════════════════════════════════════════════════════════
#  Generate .env.prod
# ═══════════════════════════════════════════════════════════════

print_step "Checking .env.prod on remote..."

REMOTE_ENV_EXISTS=$(ssh -o BatchMode=yes "root@${SERVER_IP}" "test -f ${REMOTE_DIR}/.env.prod && echo yes || echo no")

if [[ "$REMOTE_ENV_EXISTS" == "yes" ]]; then
  print_warn ".env.prod already exists on the remote server."
  print_info "Keeping the existing file to preserve passwords and encryption keys."
  print_info "If you need to update it, edit it directly on the server:"
  print_info "  ssh root@${SERVER_IP} nano ${REMOTE_DIR}/.env.prod"
  ENV_FILE=""
else
  print_step "Generating .env.prod for $DOMAIN"

  PG_PASS=$(openssl rand -base64 18 | tr -d '/+=')
  RMQ_PASS=$(openssl rand -base64 18 | tr -d '/+=')
  ENC_KEY=$(openssl rand -base64 32)

  ENV_FILE=$(mktemp)
  cat > "$ENV_FILE" <<ENVEOF
DOMAIN=${DOMAIN}
POSTGRES_USER=yrkiiot
POSTGRES_PASSWORD=${PG_PASS}
RABBITMQ_USER=yrkiiot
RABBITMQ_PASSWORD=${RMQ_PASS}
ENCRYPTION_MASTER_KEY=${ENC_KEY}
ADMIN_EMAIL=${ADMIN_EMAIL}
EMAIL_CONNECTION_STRING=${AZURE_EMAIL_CS}
EMAIL_SENDER_ADDRESS=${EMAIL_SENDER}
MQTT_ENABLED=false
ENVEOF

  print_ok "Generated new credentials"
fi

# ═══════════════════════════════════════════════════════════════
#  Deploy
# ═══════════════════════════════════════════════════════════════

print_step "Deploying to $SERVER_IP..."

# Build images locally
printf '  Building backend images...\n'
rm -rf src/backend/Api/bin/Release src/backend/Service/bin/Release
dotnet publish src/backend/Api/Api.csproj /t:PublishContainer -p:ContainerRuntimeIdentifier=linux-x64 -v:q
dotnet publish src/backend/Service/Service.csproj /t:PublishContainer -p:ContainerRuntimeIdentifier=linux-musl-x64 -v:q

printf '  Building frontend image (linux/amd64)...\n'
docker build \
  --platform linux/amd64 \
  --build-arg VITE_ENABLE_FORECAST=true \
  --build-arg VITE_ENABLE_BUILDINGS=true \
  --build-arg VITE_ENABLE_DRIVEBY=true \
  --build-arg VITE_ENABLE_MAP=true \
  -t yrkiiot-frontend:latest \
  -f src/frontend/dockerfile \
  . --quiet

printf '  Building prophet image (linux/amd64)...\n'
docker build --platform linux/amd64 -t yrkiiot-prophet:latest src/prophet --quiet

# Transfer images
printf '  Transferring images to %s...\n' "$SERVER_IP"
docker save yrkiiot-api yrkiiot-service yrkiiot-frontend yrkiiot-prophet | ssh "root@${SERVER_IP}" 'docker load'

# Sync files
ssh "root@${SERVER_IP}" "mkdir -p ${REMOTE_DIR}/volumes/mosquitto/config"

rsync -az \
  docker-compose.prod.yml \
  Caddyfile \
  "root@${SERVER_IP}:${REMOTE_DIR}/"

rsync -az \
  volumes/mosquitto/config/ \
  "root@${SERVER_IP}:${REMOTE_DIR}/volumes/mosquitto/config/"

# Upload .env.prod (only if newly generated)
if [[ -n "${ENV_FILE:-}" ]]; then
  rsync -az "$ENV_FILE" "root@${SERVER_IP}:${REMOTE_DIR}/.env.prod"
  rm -f "$ENV_FILE"
fi

# Start services
ssh "root@${SERVER_IP}" <<DEPLOY
  set -euo pipefail
  cd ${REMOTE_DIR}
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
  docker compose -f docker-compose.prod.yml --env-file .env.prod ps
DEPLOY

print_ok "All services started"

# ═══════════════════════════════════════════════════════════════
#  DNS setup (Cloudflare automatic or manual instructions)
# ═══════════════════════════════════════════════════════════════

# Split domain into record name + zone name
# e.g. "demo.yrki.net" → name="demo", zone="yrki.net"
# e.g. "yrki.net"      → name="@",    zone="yrki.net"
IFS='.' read -ra PARTS <<< "$DOMAIN"
if [[ ${#PARTS[@]} -gt 2 ]]; then
  RECORD_NAME="${PARTS[0]}"
  ZONE_NAME="${DOMAIN#*.}"
else
  RECORD_NAME="@"
  ZONE_NAME="$DOMAIN"
fi

DNS_DONE=false

if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  print_step "Setting up DNS via Cloudflare..."

  # Find zone ID
  CF_ZONE_RESPONSE=$(curl -s \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}")

  CF_ZONE_ID=$(echo "$CF_ZONE_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
zones = data.get('result', [])
if zones:
    print(zones[0]['id'])
" 2>/dev/null || echo "")

  if [[ -z "$CF_ZONE_ID" ]]; then
    print_warn "Could not find Cloudflare zone for ${ZONE_NAME}. Falling back to manual DNS."
  else
    print_ok "Zone: ${ZONE_NAME} (${CF_ZONE_ID})"

    # Check if record already exists
    CF_EXISTING=$(curl -s \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?type=A&name=${DOMAIN}")

    CF_EXISTING_ID=$(echo "$CF_EXISTING" | python3 -c "
import sys, json
data = json.load(sys.stdin)
records = data.get('result', [])
if records:
    print(records[0]['id'])
" 2>/dev/null || echo "")

    CF_RECORD_DATA="{
      \"type\": \"A\",
      \"name\": \"${RECORD_NAME}\",
      \"content\": \"${SERVER_IP}\",
      \"ttl\": 300,
      \"proxied\": false
    }"

    if [[ -n "$CF_EXISTING_ID" ]]; then
      # Update existing record
      CF_RESULT=$(curl -s -X PUT \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$CF_RECORD_DATA" \
        "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${CF_EXISTING_ID}")
      print_ok "Updated A record: ${DOMAIN} → ${SERVER_IP}"
    else
      # Create new record
      CF_RESULT=$(curl -s -X POST \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$CF_RECORD_DATA" \
        "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records")
      print_ok "Created A record: ${DOMAIN} → ${SERVER_IP}"
    fi

    CF_SUCCESS=$(echo "$CF_RESULT" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('success', False))
" 2>/dev/null || echo "False")

    if [[ "$CF_SUCCESS" == "True" ]]; then
      DNS_DONE=true
      print_ok "DNS configured — HTTPS will be ready in ~1 minute"
    else
      print_warn "Cloudflare API call returned an error. Check manually."
    fi
  fi
fi

# ═══════════════════════════════════════════════════════════════
#  Final banner
# ═══════════════════════════════════════════════════════════════

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
printf '    %s✦  Provisioning complete!%s\n' "${GREEN}${BOLD}" "${RESET}"
printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '\n'
printf '    %sServer IP:%s   %s%s%s\n' "${BOLD}" "${RESET}" "${GREEN}" "$SERVER_IP" "${RESET}"
printf '    %sDomain:%s     %s%s%s\n' "${BOLD}" "${RESET}" "${GREEN}" "$DOMAIN" "${RESET}"
printf '    %sAdmin:%s      %s%s%s\n' "${BOLD}" "${RESET}" "${BLUE}" "$ADMIN_EMAIL" "${RESET}"

if [[ "$DNS_DONE" == true ]]; then
  printf '    %sDNS:%s        %s✓ Cloudflare A record set%s\n' "${BOLD}" "${RESET}" "${GREEN}" "${RESET}"
  printf '\n'
  printf '    %sYour instance is live at:%s\n' "${BOLD}" "${RESET}"
  printf '    %shttps://%s%s\n' "${GREEN}${BOLD}" "$DOMAIN" "${RESET}"
else
  printf '\n'
  printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
  printf '    %s DNS Setup Required %s\n' "${YELLOW}${BOLD}" "${RESET}"
  printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
  printf '\n'
  printf '    Add the following DNS record at your domain registrar:\n'
  printf '\n'
  printf '    %sType%s   %sName%s              %sValue%s\n' "${BOLD}" "${RESET}" "${BOLD}" "${RESET}" "${BOLD}" "${RESET}"
  printf '    %s──── ──────────────── ─────────────────%s\n' "${DIM}" "${RESET}"
  printf '    %sA%s      %s%-18s%s %s%s%s\n' "${GREEN}" "${RESET}" "${YELLOW}" "$RECORD_NAME" "${RESET}" "${GREEN}" "$SERVER_IP" "${RESET}"
  printf '\n'
  printf '    %sOnce DNS propagates, Caddy will automatically obtain a\n' "${DIM}"
  printf '    Let'\''s Encrypt certificate and your instance will be live at:\n'
  printf '    %s%shttps://%s%s\n' "${RESET}" "${GREEN}${BOLD}" "$DOMAIN" "${RESET}"
fi

printf '\n'
printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
printf '\n'
printf '    %sTo redeploy later:%s\n' "${BOLD}" "${RESET}"
printf '    %sREMOTE_HOST=%s ./deploy.sh%s\n' "${DIM}" "$SERVER_IP" "${RESET}"
printf '\n'
