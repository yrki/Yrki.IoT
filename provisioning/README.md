# Provisioning

Scripts for setting up new Yrki IoT instances on Hetzner Cloud.

## Prerequisites

- A [Hetzner Cloud API token](https://console.hetzner.cloud/) (read/write)
- Docker with buildx (for cross-arch frontend builds)
- .NET SDK (for backend container builds)
- SSH key at `~/.ssh/id_ed25519.pub` or `~/.ssh/id_rsa.pub`
- Optional: [Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) for automatic DNS setup

## Secrets

All scripts read tokens and credentials from `/.secrets/` (gitignored).
This avoids passing secrets as environment variables or typing them interactively every time.

```
.secrets/
├── hetzner.token        # Hetzner Cloud API token (required)
├── cloudflare.token     # Cloudflare API token (optional, for automatic DNS)
└── prod.env             # Shared prod defaults (optional)
```

Copy the example directory to get started:

```bash
cp -r .secrets.example .secrets
# Then edit each file and replace the placeholders with real values
```

Each `.token` file contains a single line with the raw token value.
`prod.env` uses `KEY=value` format for defaults that `provision.sh` reads
(e.g. email connection string and sender address).

You can always override secrets with environment variables:

```bash
HCLOUD_TOKEN=xxx ./provisioning/provision.sh
```

## Scripts

### `provision.sh` — Create a new instance

Interactive script that:
1. Asks for domain, admin email, server size/location
2. Creates a Hetzner Cloud server (Ubuntu 24.04)
3. Installs Docker and configures the firewall
4. Builds all images locally and deploys them
5. Generates random Postgres/RabbitMQ passwords and encryption key
6. Sets up DNS via Cloudflare (if token available) or shows manual instructions

```bash
./provisioning/provision.sh
```

### `deploy-simulator.sh` — Deploy simulator with demo data

Lists available Yrki instances, lets you pick one, and deploys the geo-aware
simulator with demo data from Gjerstad municipality (~200 AXI sensors, ~7 gateways).

```bash
./provisioning/deploy-simulator.sh
```

Or skip the instance picker:

```bash
REMOTE_HOST=<server-ip> ./provisioning/deploy-simulator.sh
```

### `list-instances.sh` — List running instances

```bash
./provisioning/list-instances.sh
```

### `teardown.sh` — Delete an instance

Interactive script that lists Yrki servers and lets you pick one to delete.
Requires typing the server name to confirm.

```bash
./provisioning/teardown.sh
```

## After provisioning

### DNS

If you have a Cloudflare token, `provision.sh` creates the A record automatically.
Otherwise, add an **A record** pointing your domain to the server IP shown at the end
of provisioning. Caddy will automatically obtain a Let's Encrypt certificate once DNS propagates.

### Redeploying

Rebuild and push updated images to an existing instance:

```bash
REMOTE_HOST=<server-ip> ./deploy.sh
```

### Email (magic link login)

Set `EMAIL_CONNECTION_STRING` in `/opt/yrki-iot/.env.prod` on the server to an
[Azure Communication Services](https://learn.microsoft.com/en-us/azure/communication-services/)
connection string. Without it, login links are logged to the API container logs.

Alternatively, put defaults in `.secrets/prod.env` so `provision.sh` picks them up
automatically when creating new instances.
