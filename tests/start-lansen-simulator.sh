#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# start-lansen-simulator.sh
#
# Starter hele stacken for manuell testing av WMBus-pipelinen:
#
#   Docker  : postgres, rabbitmq, api, frontend
#   Lokalt  : Service  (trenger tilgang til virtuell seriellport)
#   Lokalt  : socat    (virtuelt PTY-par)
#   Lokalt  : Lansen CO2-simulator (skriver til PTY-par)
#
# Forutsetninger:
#   brew install socat
#   python3  (følger med macOS)
#   dotnet 10 SDK
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TESTS_DIR="$REPO_ROOT/tests"

# ── Sjekk avhengigheter ───────────────────────────────────────────────────────
for cmd in socat python3 dotnet docker; do
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

cleanup() {
    echo ""
    echo "Rydder opp lokale prosesser..."
    [[ -n "$SERVICE_PID" ]] && kill "$SERVICE_PID" 2>/dev/null || true
    [[ -n "$SIM_PID"     ]] && kill "$SIM_PID"     2>/dev/null || true
    [[ -n "$SOCAT_PID"   ]] && kill "$SOCAT_PID"   2>/dev/null || true
    [[ -n "$SOCAT_LOG"   ]] && rm -f "$SOCAT_LOG"
    echo ""
    echo "Docker-tjenester kjører fortsatt. Stop dem manuelt ved behov:"
    echo "  docker-compose stop"
}
trap cleanup EXIT INT TERM

cd "$REPO_ROOT"

# ── Start alle Docker-tjenester unntatt service ───────────────────────────────
echo "Starter postgres, rabbitmq, api og frontend i Docker..."
docker-compose up -d postgres rabbitmq api frontend

echo "Venter på at postgres og rabbitmq er klare..."
until docker-compose exec -T postgres pg_isready -U postgres -d YrkiIoT >/dev/null 2>&1; do
    sleep 1
done
until docker-compose exec -T rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; do
    sleep 1
done
echo "Infrastruktur klar."

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

# ── Start CO2-simulator ───────────────────────────────────────────────────────
echo ""
echo "Starter Lansen CO2-simulator (hvert ${INTERVAL_S:-20}s)..."
python3 "$TESTS_DIR/lansen-co2-simulator.py" "$WRITE_PTY" &
SIM_PID=$!

sleep 1

# ── Start Service lokalt ──────────────────────────────────────────────────────
echo ""
echo "Starter Service lokalt..."
echo ""
echo "  Frontend  : http://localhost:8080"
echo "  API       : http://localhost:8081  (swagger: /swagger)"
echo "  RabbitMQ  : http://localhost:15672 (guest/guest)"
echo ""
echo "Trykk Ctrl+C for å avslutte simulator og service."
echo "──────────────────────────────────────────────────────────────────────────"

ConnectionStrings__DatabaseConnectionString="Host=localhost;Port=5432;Database=YrkiIoT;Username=postgres;Password=postgres" \
RabbitMq__Host=localhost \
RabbitMq__Port=5672 \
RabbitMq__Username=guest \
RabbitMq__Password=guest \
WMBus__SerialPort="$READ_PTY" \
WMBus__BaudRate=9600 \
    dotnet run --project "$REPO_ROOT/src/backend/Service/Service.csproj" &
SERVICE_PID=$!

wait "$SERVICE_PID"
