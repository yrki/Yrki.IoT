#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

# --- ANSI colors (only when stdout is a TTY) ---
if [[ -t 1 ]]; then
  RESET=$'\033[0m'
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  CYAN=$'\033[38;5;51m'
  BLUE=$'\033[38;5;75m'
  GREEN=$'\033[38;5;46m'
  YELLOW=$'\033[38;5;220m'
  ORANGE=$'\033[38;5;208m'
  MAGENTA=$'\033[38;5;201m'
  PURPLE=$'\033[38;5;141m'
  PINK=$'\033[38;5;213m'
  TEAL=$'\033[38;5;87m'
else
  RESET=''
  BOLD=''
  DIM=''
  CYAN=''
  BLUE=''
  GREEN=''
  YELLOW=''
  ORANGE=''
  MAGENTA=''
  PURPLE=''
  PINK=''
  TEAL=''
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
  printf '\n'
}

print_step() {
  printf '\n%s▸ %s%s\n' "${BOLD}${PURPLE}" "$1" "${RESET}"
}

print_services() {
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
  printf '    %s✦  Services are up and running%s\n' "${BOLD}" "${RESET}"
  printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
  printf '\n'
  printf '    %s%-16s%s %s%s%s\n' "${BOLD}" "Frontend"      "${RESET}" "${GREEN}"   "http://localhost:8080"          "${RESET}"
  printf '    %s%-16s%s %s%s%s\n' "${BOLD}" "API"           "${RESET}" "${BLUE}"    "http://localhost:8081"          "${RESET}"
  printf '    %s%-16s%s %s%s%s\n' "${BOLD}" "Swagger"       "${RESET}" "${MAGENTA}" "http://localhost:8081/swagger"  "${RESET}"
  printf '    %s%-16s%s %s%s%s\n' "${BOLD}" "PostgreSQL"    "${RESET}" "${YELLOW}"  "localhost:5432"                 "${RESET}"
  printf '    %s%-16s%s %s%s%s\n' "${BOLD}" "RabbitMQ AMQP" "${RESET}" "${ORANGE}"  "localhost:5672"                 "${RESET}"
  printf '    %s%-16s%s %s%s%s\n' "${BOLD}" "RabbitMQ UI"   "${RESET}" "${PINK}"    "http://localhost:15672"         "${RESET}"
  printf '    %s%-16s%s %s%s%s\n' "${BOLD}" "Mosquitto"     "${RESET}" "${TEAL}"    "localhost:1883"                 "${RESET}"
  printf '    %s%-16s%s %s%s%s\n' "${BOLD}" "Prophet"       "${RESET}" "${PURPLE}"  "http://localhost:8090"          "${RESET}"
  printf '\n'
  printf '    %s%s%s\n' "${CYAN}" "${DIVIDER}" "${RESET}"
  printf '\n'
}

print_banner

print_step "Running backend build and tests..."
dotnet test Yrki.IoT.slnx

print_step "Running frontend tests..."
(
  cd src/frontend
  npm test
)

print_step "Building frontend..."
(
  cd src/frontend
  npm run build
)

print_step "Starting docker compose..."
docker-compose up --build -d --force-recreate api service simulator frontend prophet

print_services
