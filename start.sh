#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

echo "Running backend build and tests..."
dotnet test Yrki.IoT.slnx

echo "Running frontend tests..."
(
  cd src/frontend
  npm test
)

echo "Building frontend..."
(
  cd src/frontend
  npm run build
)

echo "Starting docker compose..."
docker-compose up --build -d

echo ""
echo "Services are running:"
echo "  Frontend:      http://localhost:8080"
echo "  API:           http://localhost:8081"
echo "  Swagger:       http://localhost:8081/swagger"
echo "  PostgreSQL:    localhost:5432"
echo "  RabbitMQ AMQP: localhost:5672"
echo "  RabbitMQ UI:   http://localhost:15672"
echo "  Mosquitto:     localhost:1883"
