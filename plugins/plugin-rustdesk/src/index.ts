/**
 * plugin-rustdesk — RustDesk remote desktop server full management.
 *
 * Registers:
 * - 3 system services (signal, relay, client)
 * - HTTP routes for status, logs, connection info, password
 * - Settings page with service control, connection info, logs, password sections
 * - Knowledge namespace, agent tool, skill, actions
 */

import { createPlugin } from "@agi/sdk";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PUBLIC_KEY = "MMmP0fzH5Rtn0dG6cgDI4Tu9gDduHLwdP9wNEOJmbF8=";
const SERVER_IP = "192.168.0.144";
const CLIENT_ID = "87478693";

export default createPlugin({
  async activate(api) {
    const log = api.getLogger();

    // -----------------------------------------------------------------------
    // System Services — signal, relay, and client
    // -----------------------------------------------------------------------

    api.registerSystemService({
      id: "rustdesk-signal",
      name: "RustDesk Signal Server",
      description: "Client registration, ID assignment, and connection brokering (hbbs)",
      unitName: "rustdesksignal.service",
      agentAware: true,
      agentDescription: `RustDesk signal server (hbbs) runs on ${SERVER_IP}. It handles client registration and connection brokering. Clients connect with key: ${PUBLIC_KEY}`,
    });

    api.registerSystemService({
      id: "rustdesk-relay",
      name: "RustDesk Relay Server",
      description: "Traffic relay when direct P2P connections fail (hbbr)",
      unitName: "rustdeskrelay.service",
      agentAware: true,
      agentDescription: "RustDesk relay server (hbbr) relays traffic when P2P connections cannot be established.",
    });

    api.registerSystemService({
      id: "rustdesk-client",
      name: "RustDesk Client",
      description: `Local RustDesk client service (ID: ${CLIENT_ID})`,
      unitName: "rustdesk.service",
      agentAware: true,
      agentDescription: `Local RustDesk client. ID: ${CLIENT_ID}.`,
    });

    // -----------------------------------------------------------------------
    // HTTP Routes — RustDesk-specific operations
    // -----------------------------------------------------------------------

    // GET /status — detailed per-service status
    api.registerHttpRoute("GET", "/status", async (_req, reply) => {
      const { execFile } = await import("node:child_process");
      const getStatus = (unit: string): Promise<Record<string, string>> =>
        new Promise((resolve) => {
          execFile(
            "systemctl",
            ["show", unit, "--property=ActiveState,SubState,MainPID,MemoryCurrent,ActiveEnterTimestamp"],
            { timeout: 5000 },
            (err, stdout) => {
              if (err) {
                resolve({ ActiveState: "unknown", SubState: "unknown" });
                return;
              }
              const props: Record<string, string> = {};
              for (const line of stdout.trim().split("\n")) {
                const eq = line.indexOf("=");
                if (eq > 0) props[line.slice(0, eq)] = line.slice(eq + 1);
              }
              resolve(props);
            },
          );
        });

      const [signal, relay, client] = await Promise.all([
        getStatus("rustdesksignal.service"),
        getStatus("rustdeskrelay.service"),
        getStatus("rustdesk.service"),
      ]);

      reply.send({ signal, relay, client });
    });

    // GET /logs/:service — tail logs
    api.registerHttpRoute("GET", "/logs/:service", async (req, reply) => {
      const { service } = req.params;
      const lines = Number(req.query.lines) || 100;

      const { execFile } = await import("node:child_process");

      if (service === "signal" || service === "relay") {
        const logFile = service === "signal"
          ? "/var/log/rustdesk/signalserver.log"
          : "/var/log/rustdesk/relayserver.log";

        const result = await new Promise<string>((resolve) => {
          execFile("tail", ["-n", String(lines), logFile], { timeout: 5000 }, (err, stdout) => {
            resolve(err ? `Error reading log: ${err.message}` : stdout);
          });
        });

        reply.send({ logs: result });
      } else if (service === "client") {
        const result = await new Promise<string>((resolve) => {
          execFile(
            "journalctl",
            ["-u", "rustdesk.service", "-n", String(lines), "--no-pager"],
            { timeout: 5000 },
            (err, stdout) => {
              resolve(err ? `Error reading journal: ${err.message}` : stdout);
            },
          );
        });

        reply.send({ logs: result });
      } else {
        reply.code(400).send({ error: `Unknown service: ${service}. Use signal, relay, or client.` });
      }
    });

    // GET /connection-info — server connection details
    api.registerHttpRoute("GET", "/connection-info", async (_req, reply) => {
      const { readFile } = await import("node:fs/promises");
      const { execFile } = await import("node:child_process");

      let publicKey = PUBLIC_KEY;
      try {
        publicKey = (await readFile("/opt/rustdesk/id_ed25519.pub", "utf-8")).trim();
      } catch {
        // fall back to hardcoded
      }

      let clientId = CLIENT_ID;
      try {
        clientId = await new Promise<string>((resolve) => {
          execFile("sudo", ["timeout", "5", "rustdesk", "--get-id"], { timeout: 8000 }, (err, stdout) => {
            resolve(err ? CLIENT_ID : stdout.trim() || CLIENT_ID);
          });
        });
      } catch {
        // fall back to hardcoded
      }

      reply.send({
        serverIp: SERVER_IP,
        publicKey,
        clientId,
        ports: ["21114-21119/tcp", "21116/udp"],
      });
    });

    // POST /password — set permanent password
    api.registerHttpRoute("POST", "/password", async (req, reply) => {
      const body = req.body as { password?: string };
      if (!body.password || typeof body.password !== "string" || body.password.length < 1) {
        reply.code(400).send({ error: "Password is required" });
        return;
      }

      const { execFile } = await import("node:child_process");
      try {
        await new Promise<void>((resolve, reject) => {
          execFile("sudo", ["rustdesk", "--password", body.password!], { timeout: 10000 }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        reply.send({ ok: true });
      } catch (err) {
        reply.code(500).send({ error: `Failed to set password: ${err instanceof Error ? err.message : "unknown error"}` });
      }
    });

    // -----------------------------------------------------------------------
    // Settings Page — full management UI
    // -----------------------------------------------------------------------

    api.registerSettingsPage({
      id: "rustdesk",
      label: "RustDesk",
      description: "RustDesk remote desktop server — full management",
      icon: "monitor",
      position: 50,
      sections: [
        {
          id: "rustdesk-services",
          label: "Services",
          type: "service-control",
          serviceIds: ["rustdesk-signal", "rustdesk-relay", "rustdesk-client"],
          configPath: "plugins.rustdesk",
          fields: [],
        },
        {
          id: "rustdesk-connection",
          label: "Connection Info",
          type: "custom",
          configPath: "plugins.rustdesk",
          fields: [],
        },
        {
          id: "rustdesk-logs",
          label: "Logs",
          type: "custom",
          configPath: "plugins.rustdesk",
          fields: [],
        },
        {
          id: "rustdesk-password",
          label: "Password",
          type: "custom",
          configPath: "plugins.rustdesk",
          fields: [],
        },
      ],
    });

    // -----------------------------------------------------------------------
    // Actions — service control
    // -----------------------------------------------------------------------

    api.registerAction({
      id: "rustdesk-restart-all",
      label: "Restart All",
      description: "Restart both signal and relay servers",
      scope: { type: "global" },
      handler: { kind: "shell", command: "sudo systemctl restart rustdesksignal rustdeskrelay" },
      confirm: "Restart both RustDesk servers? Active connections will be interrupted.",
      group: "RustDesk",
    });

    api.registerAction({
      id: "rustdesk-view-logs",
      label: "View Signal Log",
      scope: { type: "global" },
      handler: { kind: "shell", command: "tail -50 /var/log/rustdesk/signalserver.log" },
      group: "RustDesk",
    });

    // -----------------------------------------------------------------------
    // Agent Tool — check RustDesk status
    // -----------------------------------------------------------------------

    api.registerAgentTool({
      name: "rustdesk-status",
      description: "Check the status of RustDesk signal, relay, and client services",
      inputSchema: {
        type: "object",
        properties: {},
      },
      handler: async () => {
        const { execFile } = await import("node:child_process");
        const check = (unit: string): Promise<string> =>
          new Promise((resolve) => {
            execFile("systemctl", ["is-active", unit], { timeout: 5000 }, (err, stdout) => {
              resolve(err ? "stopped" : stdout.trim());
            });
          });

        const [signal, relay, client] = await Promise.all([
          check("rustdesksignal.service"),
          check("rustdeskrelay.service"),
          check("rustdesk.service"),
        ]);

        return {
          signal: { status: signal, unit: "rustdesksignal.service" },
          relay: { status: relay, unit: "rustdeskrelay.service" },
          client: { status: client, unit: "rustdesk.service" },
          serverIp: SERVER_IP,
          publicKey: PUBLIC_KEY,
          clientId: CLIENT_ID,
        };
      },
    });

    // -----------------------------------------------------------------------
    // Knowledge Namespace — RustDesk setup documentation
    // -----------------------------------------------------------------------

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    api.registerKnowledge({
      id: "rustdesk",
      label: "RustDesk",
      description: "RustDesk self-hosted server setup and configuration",
      contentDir: resolve(__dirname, "../docs"),
      topics: [
        { title: "Server Setup", path: "setup.md", description: "How to configure RustDesk server and clients" },
      ],
    });

    // -----------------------------------------------------------------------
    // Skill — RustDesk context for the agent
    // -----------------------------------------------------------------------

    api.registerSkill({
      name: "rustdesk",
      domain: "utility",
      triggers: ["rustdesk", "remote desktop", "remote access"],
      content: [
        "RustDesk is self-hosted on Nexus (192.168.0.144).",
        "Signal server (hbbs): rustdesksignal.service",
        "Relay server (hbbr): rustdeskrelay.service",
        "Client: rustdesk.service",
        `Public key: ${PUBLIC_KEY}`,
        "Binaries and authoritative keys: /opt/rustdesk/",
        "Logs: /var/log/rustdesk/",
        "Ports: 21114-21119/tcp, 21116/udp",
        `Client ID: ${CLIENT_ID}`,
        "WARNING: /home/wishborn/data/ contains STALE keys from Docker setup — do not use.",
      ].join("\n"),
    });

    log.info("plugin-rustdesk activated");
  },
});
