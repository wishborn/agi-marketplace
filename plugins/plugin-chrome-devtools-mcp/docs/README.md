# Chrome DevTools (MCP server template)

Surfaces the [Chrome DevTools MCP server](https://github.com/ChromeDevTools/chrome-devtools-mcp)
in Aionima's per-project MCP-tab dropdown. After install, configure it from
the project's MCP tab — no manual spawn-command typing.

## What this plugin provides

- **MCP server template `"chrome-devtools"`** — stdio transport, spawned via
  `npx -y chrome-devtools-mcp@latest`. Surfaces in the per-project MCP-tab
  dropdown alongside Aionima's built-in templates and any other plugin-
  registered ones.

The template's `defaultCommand` includes `--no-usage-statistics` so Google's
optional telemetry stays off by default. Owners can edit the spawn command
post-install to opt in.

## What Chrome DevTools MCP gives the agent

Once configured + connected, the agent gains tools for:

- **Performance** — record traces, extract actionable insights, fetch CrUX
  field data (configurable: `--no-performance-crux` to disable)
- **Network** — inspect requests, modify, replay
- **Screenshots** — full page or viewport, source-mapped stack traces
- **Console** — read messages, errors, warnings
- **Browser automation** — navigate, click, type, evaluate via Puppeteer

See [Chrome DevTools MCP tool reference](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
for the full surface.

## Slim vs full mode

By default the template registers full mode (all tools, requires display).
For non-interactive environments or smaller agent tool palettes, edit the
spawn command after install:

```json
{
  "id": "chrome-devtools",
  "transport": "stdio",
  "command": ["npx", "-y", "chrome-devtools-mcp@latest", "--slim", "--headless"]
}
```

See the upstream [slim tool reference](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/slim-tool-reference.md).

## ADF classification

- **0AGENT** — the registered MCP server extends the agent's tool palette

No 0UX surface; the dashboard's existing MCP tab is the configuration
point.

## Requirements

- Node.js v20.19+ (matches Aionima's existing requirement)
- Chrome current stable or newer (the MCP server connects to your local Chrome)
- The `npx` binary (ships with npm)

## Privacy notes

- `--no-usage-statistics` is included in `defaultCommand` so Google's
  telemetry doesn't fire by default. Add `CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS=1`
  to project env to enforce regardless of command-line flags.
- Browser content is exposed to the MCP client; avoid sharing sensitive
  browsing data in the connected Chrome session.
- Per Aionima's plugin contract, this plugin only declares `network` +
  `config.read` permissions. It doesn't read project files, doesn't write
  anywhere, doesn't make outbound requests of its own.

## See also

- Upstream: [github.com/ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- Aionima MCP architecture: `agi/docs/agents/magic-apps.md` + s127 plugin scaffolding
- Plugin Marketplace docs: `agi/docs/human/plugins.md`
