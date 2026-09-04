/**
 * plugin-chrome-devtools-mcp — register Chrome DevTools MCP server template.
 *
 * Chrome DevTools for Agents (chrome-devtools-mcp) is a stdio-transport MCP
 * server published to npm by the Chrome DevTools team. It exposes Chrome's
 * full DevTools surface to coding agents: performance trace recording,
 * network request inspection, screenshots with source-mapped stack traces,
 * console messages, full browser automation via Puppeteer.
 *
 * Source: https://github.com/ChromeDevTools/chrome-devtools-mcp
 *
 * Why a plugin: Aionima's core gateway has no opinion about which MCP
 * servers an owner uses. Per-project MCP server config lives in
 * project.json's mcp.servers block; the gateway connects to whatever's
 * configured. This plugin's only job is to surface "Chrome DevTools" in
 * the dashboard's MCP-tab template dropdown so owners pick it from a list
 * instead of typing the spawn command from memory.
 *
 * ADF classification: 0AGENT (extends the agent's tool palette via the
 * MCP server's exposed tools). No 0UX surface — the dashboard's existing
 * MCP-tab is the configuration point; this plugin doesn't add a tab of
 * its own.
 *
 * Two variants documented in plugin docs but only the full mode is
 * registered as the default template. Owners who prefer slim mode edit
 * the spawn command after install: replace `["npx", "-y",
 * "chrome-devtools-mcp@latest"]` with `["npx", "-y",
 * "chrome-devtools-mcp@latest", "--slim", "--headless"]`.
 */

import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    const log = api.getLogger();

    api.registerMcpServerTemplate({
      id: "chrome-devtools",
      name: "Chrome DevTools",
      description:
        "Chrome DevTools for Agents — record performance traces, inspect network " +
        "requests, take screenshots, read console messages with source-mapped " +
        "stack traces, automate browser actions via Puppeteer. Stdio transport; " +
        "spawned via `npx -y chrome-devtools-mcp@latest` per Chrome DevTools' " +
        "official MCP server (github.com/ChromeDevTools/chrome-devtools-mcp).",
      transport: "stdio",
      defaultCommand: [
        "npx",
        "-y",
        "chrome-devtools-mcp@latest",
        "--no-usage-statistics",
      ],
      // No default env vars; the server reads CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS
      // and CI from process.env when set. Owners who want to customize
      // (e.g., set --slim --headless for non-interactive environments)
      // edit the spawn command in their project's mcp.servers block.
      defaultEnv: {},
    });

    log.info("plugin-chrome-devtools-mcp activated — Chrome DevTools template registered");
  },
});
