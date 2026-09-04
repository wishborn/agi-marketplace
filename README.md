# Aionima Official Marketplace

Official plugin catalog for the [Aionima](https://github.com/Civicognita/agi) autonomous AI gateway.

## Structure

```
agi-marketplace/
├── marketplace.json              # Catalog listing all plugins
├── plugins/
│   ├── plugin-node-runtime/      # Node.js runtime versions
│   ├── plugin-php-runtime/       # PHP runtime versions
│   ├── plugin-postgres/          # PostgreSQL service
│   ├── plugin-mysql/             # MariaDB service
│   ├── plugin-redis/             # Redis service
│   ├── plugin-adminer/           # Adminer DB portal
│   ├── plugin-rustdesk/          # RustDesk remote desktop
│   ├── plugin-screensaver/       # Screensaver
│   ├── plugin-xrdp/              # xrdp remote desktop
│   ├── plugin-openclaw/          # OpenClaw agent bridge
│   ├── plugin-project-webapp/     # Project type: Web App
│   ├── plugin-project-api/       # Project type: API Service
│   ├── plugin-project-staticsite/# Project type: Static Site
│   ├── plugin-project-monorepo/  # Project type: Monorepo
│   ├── plugin-project-ops/       # Project type: Ops
│   ├── plugin-project-writing/   # Project type: Writing
│   ├── plugin-project-art/       # Project type: Art
│   ├── plugin-stack-laravel/     # Stack: Laravel
│   ├── plugin-stack-nextjs/      # Stack: Next.js
│   ├── plugin-stack-nuxt/        # Stack: Nuxt
│   ├── plugin-stack-node-app/    # Stack: Node.js App
│   ├── plugin-stack-php-app/     # Stack: PHP App
│   ├── plugin-stack-react-vite/  # Stack: React (Vite)
│   ├── plugin-stack-static-hosting/ # Stack: Static Hosting
│   ├── plugin-stack-hono/        # Stack: Hono
│   └── plugin-stack-tall/        # Stack: TALL
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## How It Works

Aionima gateways discover plugins from this repo at boot time. The marketplace directory is configured in `aionima.json`:

```json
{
  "marketplace": {
    "dir": "/opt/agi-marketplace"
  }
}
```

The gateway's `discoverMarketplacePlugins()` scans `{dir}/plugins/plugin-*` for plugin manifests.

## Plugin Format

Each plugin is a directory containing:
- `package.json` with an `aionima` manifest field
- `src/index.ts` entry point exporting `activate(api)` and optionally `deactivate()`

```json
{
  "name": "@aionima/plugin-example",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "aionima": {
    "id": "example-plugin",
    "name": "Example Plugin",
    "description": "What this plugin does",
    "category": "tool",
    "permissions": [],
    "entry": "./src/index.ts",
    "aionimaVersion": ">=0.1.0"
  }
}
```

## Deployment

This repo is pulled alongside AGI, PRIME, and BOTS during deployment:
- Production: `/opt/agi-marketplace`
- Dev mode: `/opt/agi-marketplace_dev`

## Adding a Plugin

1. Create a directory under `plugins/plugin-{name}/`
2. Add `package.json` with the `aionima` manifest field
3. Add `src/index.ts` with the plugin entry point
4. Add an entry to `marketplace.json`
5. Submit a PR
