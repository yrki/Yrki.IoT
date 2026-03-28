#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# start-simulator-docker.sh
#
# Starter hele stacken i Docker — ingen lokale prosesser nødvendig.
#
#   postgres  → TimescaleDB
#   rabbitmq  → meldingskø
#   api       → ASP.NET Core API + SignalR hub
#   service   → WMBus consumer (lagrer readings, registrerer devices)
#   simulator → Lansen CO2-simulator (publiserer SensorPayload til kø)
#   frontend  → Vite prod build bak nginx
#
# Bruk:
#   ./tests/start-simulator-docker.sh          # start alt
#   ./tests/start-simulator-docker.sh --down   # stop alt
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ "${1:-}" == "--down" ]]; then
    docker-compose --profile simulator down
    exit 0
fi

echo "Starter hele stacken i Docker (inkl. simulator)..."
echo ""
docker-compose --profile simulator up --build -d

echo ""
echo "Venter på at infrastruktur er klar..."
until docker-compose exec -T postgres pg_isready -U postgres -d YrkiIoT >/dev/null 2>&1; do
    sleep 1
done
until docker-compose exec -T rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; do
    sleep 1
done

echo ""
echo "Alt kjører:"
echo ""
echo "  Frontend  : http://localhost:8080"
echo "  API       : http://localhost:8081  (swagger: /swagger)"
echo "  RabbitMQ  : http://localhost:15672 (guest/guest)"
echo ""
echo "Følg logger:"
echo "  docker-compose --profile simulator logs -f"
echo ""
echo "Stop alt:"
echo "  ./tests/start-simulator-docker.sh --down"
echo ""

docker-compose --profile simulator logs -f
