# Provisioning

Scripts for setting up new Yrki IoT instances on Hetzner Cloud.

## Prerequisites

- A [Hetzner Cloud API token](https://console.hetzner.cloud/) (read/write)
- Docker with buildx (for cross-arch frontend builds)
- .NET SDK (for backend container builds)
- SSH key at `~/.ssh/id_ed25519.pub` or `~/.ssh/id_rsa.pub`

## Scripts

### `provision.sh` — Create a new instance

Interactive script that:
1. Asks for domain, admin email, Hetzner token, server size/location
2. Creates a Hetzner Cloud server (Ubuntu 24.04)
3. Installs Docker and configures the firewall
4. Builds all images locally and deploys them
5. Generates random Postgres/RabbitMQ passwords and encryption key
6. Shows DNS instructions

```bash
./provisioning/provision.sh
```

Or with pre-set token:
```bash
HCLOUD_TOKEN=your-token-here ./provisioning/provision.sh
```

### `list-instances.sh` — List running instances

```bash
HCLOUD_TOKEN=your-token ./provisioning/list-instances.sh
```

### `teardown.sh` — Delete an instance

Interactive script that lists Yrki servers and lets you pick one to delete.
Requires typing the server name to confirm.

```bash
HCLOUD_TOKEN=your-token ./provisioning/teardown.sh
```

## After provisioning

### DNS

Add an **A record** pointing your domain to the server IP shown at the end of provisioning.
Caddy will automatically obtain a Let's Encrypt certificate once DNS propagates.

### Redeploying

Use the main `deploy.sh` with the server IP:

```bash
REMOTE_HOST=<server-ip> ./deploy.sh
```

### Email (magic link login)

Set `EMAIL_CONNECTION_STRING` in `/opt/yrki-iot/.env.prod` on the server to an
[Azure Communication Services](https://learn.microsoft.com/en-us/azure/communication-services/)
connection string. Without it, login links are logged to the API container logs.
