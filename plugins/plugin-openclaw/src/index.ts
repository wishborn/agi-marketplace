/**
 * OpenClaw Bridge Plugin — exposes OpenClaw agents in the AGI dashboard.
 * Provides settings + comms page with chat logs and accomplishments.
 */

import { createPlugin, defineDashboardPage, defineSettingsPage } from "@agi/sdk";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function isPrivateNetwork(ip: string): boolean {
  if (isLoopback(ip)) return true;
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const parts = v4.split(".").map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  if (ip.startsWith("fe80:")) return true;
  return false;
}

function guardPrivate(clientIp?: string): string | null {
  if (!clientIp || !isPrivateNetwork(clientIp)) {
    return "OpenClaw bridge API is only available on private networks.";
  }
  return null;
}

function getHeaderValue(headers: Record<string, string | string[] | undefined> | undefined, key: string): string | undefined {
  if (!headers) return undefined;
  const raw = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw as string | undefined;
}

function extractApiKey(
  headers: Record<string, string | string[] | undefined> | undefined,
  query: Record<string, string> | undefined,
): string | null {
  const authHeader = getHeaderValue(headers, "authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice("bearer ".length).trim();
  }
  const headerKey = getHeaderValue(headers, "x-openclaw-key") ?? getHeaderValue(headers, "x-api-key");
  if (headerKey) return headerKey.trim();
  const queryKey = query?.apiKey ?? query?.token;
  if (queryKey) return queryKey.trim();
  return null;
}

function guardApiKey(
  request: { headers?: Record<string, string | string[] | undefined>; query?: Record<string, string> },
  openclawCfg: Record<string, unknown>,
): string | null {
  const apiKey = typeof openclawCfg.apiKey === "string" ? openclawCfg.apiKey.trim() : "";
  if (!apiKey) return null;
  const token = extractApiKey(request.headers, request.query);
  if (!token || token !== apiKey) {
    return "Missing or invalid OpenClaw API key.";
  }
  return null;
}

const DATA_DIR = join(homedir(), ".agi", "openclaw");
const AGENTS_FILE = join(DATA_DIR, "agents.json");
const ACCOMPLISHMENTS_FILE = join(DATA_DIR, "accomplishments.json");
const CHAT_LOG_FILE = join(DATA_DIR, "chat.log");
const STATUS_FILE = join(DATA_DIR, "status.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(path: string, fallback: T): T {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(path: string, data: T): void {
  ensureDataDir();
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

function appendChatLine(line: string): void {
  ensureDataDir();
  appendFileSync(CHAT_LOG_FILE, `${line}\n`, "utf8");
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default createPlugin({
  async activate(api) {
    const logger = api.getLogger();

    // Settings page
    api.registerSettingsPage(
      defineSettingsPage("openclaw", "OpenClaw")
        .description("Connect OpenClaw agents to the AGI dashboard.")
        .icon("link")
        .position(60)
        .section({
          id: "openclaw-connection",
          label: "Connection",
          description: "OpenClaw endpoint and credentials.",
          configPath: "plugins.openclaw",
          fields: [
            { id: "enabled", label: "Enabled", type: "toggle", configKey: "enabled" },
            { id: "baseUrl", label: "OpenClaw Endpoint", type: "text", configKey: "baseUrl", placeholder: "https://openclaw.local" },
            { id: "apiKey", label: "API Key", type: "password", configKey: "apiKey" },
            { id: "allowInsecureTls", label: "Allow Insecure TLS", type: "toggle", configKey: "allowInsecureTls" },
          ],
        })
        .build()
    );

    // Communications page under Comms domain
    api.registerDashboardPage(
      defineDashboardPage("openclaw-comms", "OpenClaw")
        .description("Chat logs and shared accomplishments with OpenClaw agents.")
        .domain("comms")
        .routePath("openclaw")
        .widget({ type: "status-display", title: "Connection Status", statusEndpoint: "/status" })
        .widget({ type: "table", dataEndpoint: "/agents", columns: [
          { key: "id", label: "Agent" },
          { key: "name", label: "Name" },
          { key: "status", label: "Status" },
        ] })
        .widget({ type: "log-stream", title: "Chat Logs", logSource: "/communications/logs", lines: 200 })
        .widget({ type: "table", dataEndpoint: "/accomplishments", columns: [
          { key: "timestamp", label: "When", width: "180px" },
          { key: "title", label: "Accomplishment" },
          { key: "details", label: "Details" },
        ] })
        .build()
    );

    const getOpenclawConfig = (): Record<string, unknown> => {
      const cfg = api.getConfig() as { plugins?: Record<string, unknown> };
      return (cfg.plugins?.["openclaw"] ?? {}) as Record<string, unknown>;
    };

    // -------------------------------------------------------------------
    // API routes
    // -------------------------------------------------------------------

    api.registerHttpRoute("get", "/status", async (request, reply) => {
      const err = guardPrivate(request.clientIp);
      if (err) return reply.code(403).send({ error: err });

      const openclawCfg = getOpenclawConfig();
      const stored = readJson<Record<string, unknown>>(STATUS_FILE, {});

      return reply.send({
        connected: stored.connected ?? false,
        endpoint: openclawCfg.baseUrl ?? null,
        lastSync: stored.lastSync ?? null,
        error: stored.error ?? null,
      });
    });

    api.registerHttpRoute("post", "/status", async (request, reply) => {
      const err = guardPrivate(request.clientIp);
      if (err) return reply.code(403).send({ error: err });
      const authErr = guardApiKey({ headers: request.headers, query: request.query }, getOpenclawConfig());
      if (authErr) return reply.code(403).send({ error: authErr });
      const body = (request.body ?? {}) as Record<string, unknown>;
      writeJson(STATUS_FILE, {
        connected: body.connected ?? false,
        lastSync: body.lastSync ?? new Date().toISOString(),
        error: body.error ?? null,
      });
      return reply.send({ ok: true });
    });

    api.registerHttpRoute("get", "/agents", async (request, reply) => {
      const err = guardPrivate(request.clientIp);
      if (err) return reply.code(403).send({ error: err });
      const agents = readJson<Array<Record<string, unknown>>>(AGENTS_FILE, []);
      const rows = agents.map((a) => ({
        id: a.id ?? "",
        name: a.name ?? a.id ?? "",
        status: a.status ?? "unknown",
      }));
      return reply.send({ agents, rows });
    });

    api.registerHttpRoute("post", "/agents", async (request, reply) => {
      const err = guardPrivate(request.clientIp);
      if (err) return reply.code(403).send({ error: err });
      const authErr = guardApiKey({ headers: request.headers, query: request.query }, getOpenclawConfig());
      if (authErr) return reply.code(403).send({ error: authErr });
      const body = (request.body ?? {}) as { agents?: Array<Record<string, unknown>> };
      writeJson(AGENTS_FILE, body.agents ?? []);
      writeJson(STATUS_FILE, {
        connected: true,
        lastSync: new Date().toISOString(),
        error: null,
      });
      return reply.send({ ok: true, count: (body.agents ?? []).length });
    });

    api.registerHttpRoute("get", "/accomplishments", async (request, reply) => {
      const err = guardPrivate(request.clientIp);
      if (err) return reply.code(403).send({ error: err });
      const rows = readJson<Array<{ timestamp: string; title: string; details?: string }>>(ACCOMPLISHMENTS_FILE, []);
      return reply.send({ rows });
    });

    api.registerHttpRoute("post", "/accomplishments", async (request, reply) => {
      const err = guardPrivate(request.clientIp);
      if (err) return reply.code(403).send({ error: err });
      const authErr = guardApiKey({ headers: request.headers, query: request.query }, getOpenclawConfig());
      if (authErr) return reply.code(403).send({ error: authErr });
      const body = (request.body ?? {}) as { title?: string; details?: string; timestamp?: string };
      const rows = readJson<Array<{ timestamp: string; title: string; details?: string }>>(ACCOMPLISHMENTS_FILE, []);
      rows.unshift({
        timestamp: body.timestamp ?? new Date().toISOString(),
        title: body.title ?? "",
        details: body.details ?? "",
      });
      writeJson(ACCOMPLISHMENTS_FILE, rows.slice(0, 200));
      return reply.send({ ok: true });
    });

    api.registerHttpRoute("get", "/communications/logs", async (request, reply) => {
      const err = guardPrivate(request.clientIp);
      if (err) return reply.code(403).send(err);
      try {
        const text = readFileSync(CHAT_LOG_FILE, "utf8");
        return reply.send(text);
      } catch {
        return reply.send("");
      }
    });

    api.registerHttpRoute("post", "/communications/logs", async (request, reply) => {
      const err = guardPrivate(request.clientIp);
      if (err) return reply.code(403).send({ error: err });
      const authErr = guardApiKey({ headers: request.headers, query: request.query }, getOpenclawConfig());
      if (authErr) return reply.code(403).send({ error: authErr });
      const body = (request.body ?? {}) as { role?: string; source?: string; message?: string; timestamp?: string };
      const timestamp = body.timestamp ?? new Date().toISOString();
      const role = body.role ?? "info";
      const source = body.source ?? "openclaw";
      const message = body.message ?? "";
      appendChatLine(`[${timestamp}] ${source}/${role}: ${message}`.trim());
      return reply.send({ ok: true });
    });

    logger.info("OpenClaw bridge plugin ready");
  },
});
