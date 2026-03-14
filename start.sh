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
docker-compose up --build
