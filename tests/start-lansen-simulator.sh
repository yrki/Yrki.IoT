#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# start-lansen-simulator.sh
#
# Starter hele stacken for manuell testing av WMBus-pipelinen:
#
#   Docker  : postgres, rabbitmq
#   Lokalt  : API       (med SignalR-hub)
#   Lokalt  : Service   (trenger tilgang til virtuell seriellport)
#   Lokalt  : Frontend  (Vite dev server med proxy)
#   Lokalt  : socat     (virtuelt PTY-par)
#   Lokalt  : Lansen CO2-simulator (skriver til PTY-par)
#
# Forutsetninger:
#   brew install socat
#   python3  (følger med macOS)
#   dotnet 10 SDK
#   node / npm
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TESTS_DIR="$REPO_ROOT/tests"
FRONTEND_DIR="$REPO_ROOT/src/frontend"

if [[ -z "${ENCRYPTION_MASTER_KEY:-}" ]]; then
    echo "ENCRYPTION_MASTER_KEY must be set in the environment."
    exit 1
fi

# ── Sjekk avhengigheter ───────────────────────────────────────────────────────
for cmd in socat python3 dotnet docker npm; do
    command -v "$cmd" >/dev/null 2>&1 || {
        echo "Mangler: $cmd"
        [[ "$cmd" == "socat" ]] && echo "  → brew install socat"
        exit 1
    }
done

# ── Ryddejobb ved avslutning ──────────────────────────────────────────────────
SOCAT_LOG=""
SOCAT_PID=""
SIM_PID=""
SERVICE_PID=""
API_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo "Rydder opp..."
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    [[ -n "$SERVICE_PID"  ]] && kill "$SERVICE_PID"  2>/dev/null || true
    [[ -n "$API_PID"      ]] && kill "$API_PID"      2>/dev/null || true
    [[ -n "$SIM_PID"      ]] && kill "$SIM_PID"      2>/dev/null || true
    [[ -n "$SOCAT_PID"    ]] && kill "$SOCAT_PID"    2>/dev/null || true
    [[ -n "$SOCAT_LOG"    ]] && rm -f "$SOCAT_LOG"
    echo ""
    echo "Docker-tjenester kjører fortsatt. Stop dem manuelt ved behov:"
    echo "  docker-compose stop"
}
trap cleanup EXIT INT TERM

cd "$REPO_ROOT"

# ── Bygg backend parallelt ───────────────────────────────────────────────────
echo "Bygger backend og installerer frontend-avhengigheter..."
dotnet build Yrki.IoT.slnx --nologo -v q 2>&1 &
BUILD_PID=$!

(cd "$FRONTEND_DIR" && npm install --silent) &
NPM_PID=$!

# ── Start infrastruktur i Docker (kun postgres + rabbitmq) ────────────────────
echo "Starter postgres og rabbitmq i Docker..."
docker-compose up -d postgres rabbitmq

echo "Venter på at postgres og rabbitmq er klare..."
until docker-compose exec -T postgres pg_isready -U postgres -d YrkiIoT >/dev/null 2>&1; do
    sleep 1
done
until docker-compose exec -T rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; do
    sleep 1
done
echo "Infrastruktur klar."

# Vent på at bygg er ferdig
wait "$BUILD_PID" || { echo "Backend-bygg feilet"; exit 1; }
wait "$NPM_PID"   || { echo "npm install feilet"; exit 1; }
echo "Bygg ferdig."

# ── Opprett virtuelt PTY-par med socat ────────────────────────────────────────
echo ""
echo "Oppretter virtuelt seriellport-par..."
SOCAT_LOG="$(mktemp)"
socat -d -d pty,raw,echo=0 pty,raw,echo=0 2>"$SOCAT_LOG" &
SOCAT_PID=$!

sleep 1

WRITE_PTY="$(grep 'PTY is' "$SOCAT_LOG" | head -1 | awk '{print $NF}')"
READ_PTY="$(grep  'PTY is' "$SOCAT_LOG" | tail -1 | awk '{print $NF}')"

if [[ -z "$WRITE_PTY" || -z "$READ_PTY" ]]; then
    echo "FEIL: Klarte ikke å opprette virtuelle seriellporter."
    cat "$SOCAT_LOG"
    exit 1
fi

echo "  Simulator  → $WRITE_PTY"
echo "  Service    ← $READ_PTY"

# ── Start API lokalt ─────────────────────────────────────────────────────────
echo ""
echo "Starter API..."
ConnectionStrings__DatabaseConnectionString="Host=localhost;Port=5432;Database=YrkiIoT;Username=postgres;Password=postgres" \
RabbitMq__Host=localhost \
RabbitMq__Username=guest \
RabbitMq__Password=guest \
Encryption__MasterKey="$ENCRYPTION_MASTER_KEY" \
    dotnet run --project "$REPO_ROOT/src/backend/Api/Api.csproj" --no-build --no-launch-profile --urls "http://localhost:5180" &
API_PID=$!

# ── Start Frontend (Vite dev server) ──────────────────────────────────────────
echo "Starter Frontend..."
(cd "$FRONTEND_DIR" && VITE_API_TARGET=http://localhost:5180 npm run dev) &
FRONTEND_PID=$!

# ── Start CO2-simulator ───────────────────────────────────────────────────────
echo ""
echo "Starter Lansen CO2-simulator..."
python3 "$TESTS_DIR/lansen-co2-simulator.py" "$WRITE_PTY" &
SIM_PID=$!

sleep 1

# ── Start Service lokalt ──────────────────────────────────────────────────────
echo ""
echo "Starter Service..."
echo ""
echo "  Frontend  : http://localhost:5173"
echo "  API       : http://localhost:5180  (swagger: /swagger)"
echo "  RabbitMQ  : http://localhost:15672 (guest/guest)"
echo ""
echo "Trykk Ctrl+C for å avslutte alt."
echo "──────────────────────────────────────────────────────────────────────────"

ConnectionStrings__DatabaseConnectionString="Host=localhost;Port=5432;Database=YrkiIoT;Username=postgres;Password=postgres" \
RabbitMq__Host=localhost \
RabbitMq__Username=guest \
RabbitMq__Password=guest \
Encryption__MasterKey="$ENCRYPTION_MASTER_KEY" \
WMBus__SerialPort="$READ_PTY" \
WMBus__BaudRate=9600 \
    dotnet run --project "$REPO_ROOT/src/backend/Service/Service.csproj" --no-build --no-launch-profile
