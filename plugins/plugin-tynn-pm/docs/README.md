# Tynn (PM Provider Plugin)

Tynn-the-service as a marketplace plugin — register a `"tynn"` PmProvider for
full MCP-backed PM experience, plus a per-project MCP server template, plus a
future Kanban MApp for visual task management.

## What this plugin provides

- **PmProvider `"tynn"`** — the canonical Aionima PM workflow shape, backed
  by tynn.ai's MCP server. Replaces the tynn-lite file-based fallback for
  projects that opt in.
- **MCP server template `"tynn"`** — surfaces in the per-project MCP tab
  dropdown so the owner can configure a tynn server (URL, bearer token)
  alongside other MCP servers without YAML editing.
- **Kanban MApp** *(future iteration — deferred per s127 t490)* — visual
  per-project task management via the MApp marketplace.

## ADF classification

Per CLAUDE.md § 1.5, this plugin extends two ADF elements:

- **0UX** — future Kanban MApp (per-project task management surface)
- **0AGENT** — PmProvider registration extends the agent's tool palette
  with the canonical PM workflow tools

## Why a plugin and not baked-in

`tynn-lite` (file-based, zero-config) stays baked-in as the always-available
fallback. This plugin is the **upgrade path** — installing it lets projects
opt into the full tynn-the-service experience.

The architecture mirrors the broader Aionima plugin contract: pluggable
storage, canonical workflow. See `agi/docs/agents/tynn-and-related-concepts.md`.

## Status

Currently a scaffold. Implementation tasks tracked in tynn s127:

- ✅ t486 — Plugin scaffold (this commit)
- ✅ t487 — ADF classification declared (`adf: ["0UX", "0AGENT"]`)
- ⏳ t488 — PmProvider registration via `api.registerPmProvider()`
- ⏳ t489 — MCP server template via `api.registerMcpServerTemplate()`
- ⏳ t490 — Kanban MApp (deferred to future iteration)
- ⏳ t491 — User-facing docs at `agi/docs/human/plugins-pm.md`
