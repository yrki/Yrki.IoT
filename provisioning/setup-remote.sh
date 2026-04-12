#!/usr/bin/env bash
# This script runs on the REMOTE server via SSH.
# It installs Docker, Docker Compose, and configures the firewall.
set -euo pipefail

echo "==> Installing Docker..."
if ! command -v docker &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release >/dev/null

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  echo "Docker installed."
else
  echo "Docker already installed."
fi

echo "==> Configuring firewall..."
if command -v ufw &>/dev/null; then
  ufw --force reset >/dev/null 2>&1 || true
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow ssh >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 1883/tcp >/dev/null
  ufw --force enable >/dev/null
  echo "Firewall configured (SSH, HTTP, HTTPS, MQTT)."
else
  echo "ufw not found, skipping firewall."
fi

echo "==> Creating app directory..."
mkdir -p /opt/yrki-iot/volumes/mosquitto/config

echo "==> Server setup complete."
