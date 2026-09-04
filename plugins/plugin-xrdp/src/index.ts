/**
 * plugin-xrdp — xrdp remote desktop server management.
 *
 * Registers:
 * - 2 system services (xrdp, xrdp-sesman)
 * - HTTP routes for status, logs, connection info, active sessions
 * - Settings page with service control, connection info, sessions, and logs
 * - Knowledge namespace, agent tool, skill, actions
 */

import { createPlugin } from "@agi/sdk";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SERVER_IP = "192.168.0.144";
const RDP_PORT = 3389;

function exec(cmd: string, args: string[], timeout = 5000): Promise<string> {
  return new Promise((resolve) => {
    import("node:child_process").then(({ execFile }) => {
      execFile(cmd, args, { timeout }, (err, stdout) => {
        resolve(err ? "" : stdout.trim());
      });
    });
  });
}

function getServiceStatus(unit: string): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    import("node:child_process").then(({ execFile }) => {
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
  });
}

interface XrdpSession {
  pid: string;
  user: string;
  display: string;
  geometry: string;
  startTime: string;
}

async function getActiveSessions(): Promise<XrdpSession[]> {
  const sessions: XrdpSession[] = [];

  // Parse Xvnc/Xorg processes spawned by xrdp-sesman for active sessions
  const xvncOutput = await exec("bash", ["-c",
    "ps -eo pid,user,args 2>/dev/null | grep '[X]vnc\\|[X]org.*xrdp' | grep -v grep || true",
  ]);

  for (const line of xvncOutput.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[0] || "";
    const user = parts[1] || "";
    const args = parts.slice(2).join(" ");

    // Extract display number
    const displayMatch = args.match(/:(\d+)/);
    const display = displayMatch ? `:${displayMatch[1]}` : "unknown";

    // Extract geometry
    const geoMatch = args.match(/-geometry\s+(\S+)/);
    const geometry = geoMatch?.[1] ?? "unknown";

    // Get start time
    const startTime = await exec("ps", ["-o", "lstart=", "-p", pid]);

    sessions.push({ pid, user, display, geometry, startTime });
  }

  return sessions;
}

export default createPlugin({
  async activate(api) {
    const log = api.getLogger();

    // -----------------------------------------------------------------------
    // System Services — xrdp and xrdp-sesman
    // -----------------------------------------------------------------------

    api.registerSystemService({
      id: "xrdp",
      name: "xrdp Server",
      description: "RDP protocol listener — accepts incoming Remote Desktop connections on port 3389",
      unitName: "xrdp.service",
      installCommand: "sudo apt install -y xrdp && sudo adduser xrdp ssl-cert && sudo systemctl enable --now xrdp",
      installedCheck: "which xrdp",
      agentAware: true,
      agentDescription: `xrdp RDP server on ${SERVER_IP}:${RDP_PORT}. Provides isolated desktop sessions over RDP. Each connection gets its own X11 display, separate from the physical monitor.`,
    });

    api.registerSystemService({
      id: "xrdp-sesman",
      name: "xrdp Session Manager",
      description: "Manages user sessions — authenticates users and spawns desktop environments",
      unitName: "xrdp-sesman.service",
      installedCheck: "which xrdp-sesman",
      agentAware: true,
      agentDescription: "xrdp session manager (sesman). Authenticates users via PAM and spawns Xvnc/Xorg sessions with the configured window manager.",
    });

    // -----------------------------------------------------------------------
    // HTTP Routes
    // -----------------------------------------------------------------------

    // GET /status — per-service status
    api.registerHttpRoute("GET", "/status", async (_req, reply) => {
      const [xrdp, sesman] = await Promise.all([
        getServiceStatus("xrdp.service"),
        getServiceStatus("xrdp-sesman.service"),
      ]);

      // Check if xrdp is installed
      const installed = await exec("which", ["xrdp"]);

      reply.send({ xrdp, sesman, installed: !!installed });
    });

    // GET /sessions — active RDP sessions
    api.registerHttpRoute("GET", "/sessions", async (_req, reply) => {
      const sessions = await getActiveSessions();
      reply.send({ sessions });
    });

    // GET /connection-info — how to connect
    api.registerHttpRoute("GET", "/connection-info", async (_req, reply) => {
      // Read port from xrdp.ini
      let port = RDP_PORT;
      try {
        const { readFile } = await import("node:fs/promises");
        const ini = await readFile("/etc/xrdp/xrdp.ini", "utf-8");
        const portMatch = ini.match(/^port=(\d+)/m);
        if (portMatch?.[1]) port = parseInt(portMatch[1], 10);
      } catch {
        // fall back to default
      }

      // Check TLS certificate
      let tlsExpiry = "";
      try {
        const certInfo = await exec("openssl", [
          "x509", "-enddate", "-noout", "-in", "/etc/xrdp/cert.pem",
        ]);
        const match = certInfo.match(/notAfter=(.+)/);
        if (match?.[1]) tlsExpiry = match[1];
      } catch {
        // no cert info
      }

      reply.send({
        serverIp: SERVER_IP,
        port,
        protocol: "RDP",
        tlsExpiry,
        connectionString: `${SERVER_IP}:${port}`,
        clients: [
          "Windows: built-in Remote Desktop Connection (mstsc.exe)",
          "macOS: Microsoft Remote Desktop (App Store)",
          "Linux: Remmina, xfreerdp, or rdesktop",
          "iOS/Android: Microsoft Remote Desktop app",
        ],
      });
    });

    // GET /logs/:service — tail logs
    api.registerHttpRoute("GET", "/logs/:service", async (req, reply) => {
      const { service } = req.params;
      const lines = Number(req.query.lines) || 100;

      if (service === "xrdp") {
        const result = await exec("journalctl", [
          "-u", "xrdp.service", "-n", String(lines), "--no-pager",
        ]);
        reply.send({ logs: result || "No logs available" });
      } else if (service === "sesman") {
        const result = await exec("journalctl", [
          "-u", "xrdp-sesman.service", "-n", String(lines), "--no-pager",
        ]);
        reply.send({ logs: result || "No logs available" });
      } else {
        reply.code(400).send({ error: `Unknown service: ${service}. Use xrdp or sesman.` });
      }
    });

    // POST /disconnect/:pid — kill a specific session
    api.registerHttpRoute("POST", "/disconnect/:pid", async (req, reply) => {
      const pid = req.params.pid ?? "";
      if (!/^\d+$/.test(pid)) {
        reply.code(400).send({ error: "Invalid PID" });
        return;
      }

      try {
        await exec("sudo", ["kill", pid]);
        reply.send({ ok: true });
      } catch {
        reply.code(500).send({ error: "Failed to terminate session" });
      }
    });

    // -----------------------------------------------------------------------
    // Settings Page
    // -----------------------------------------------------------------------

    api.registerSettingsPage({
      id: "xrdp",
      label: "xrdp",
      description: "xrdp remote desktop server — isolated RDP sessions",
      icon: "monitor",
      position: 51,
      sections: [
        {
          id: "xrdp-services",
          label: "Services",
          type: "service-control",
          serviceIds: ["xrdp", "xrdp-sesman"],
          configPath: "plugins.xrdp",
          fields: [],
        },
        {
          id: "xrdp-connection",
          label: "Connection Info",
          type: "custom",
          configPath: "plugins.xrdp",
          fields: [],
        },
        {
          id: "xrdp-sessions",
          label: "Active Sessions",
          type: "custom",
          configPath: "plugins.xrdp",
          fields: [],
        },
        {
          id: "xrdp-logs",
          label: "Logs",
          type: "custom",
          configPath: "plugins.xrdp",
          fields: [],
        },
      ],
    });

    // -----------------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------------

    api.registerAction({
      id: "xrdp-restart",
      label: "Restart xrdp",
      description: "Restart both xrdp and xrdp-sesman services",
      scope: { type: "global" },
      handler: { kind: "shell", command: "sudo systemctl restart xrdp xrdp-sesman" },
      confirm: "Restart xrdp? Active RDP sessions will be disconnected.",
      group: "xrdp",
    });

    api.registerAction({
      id: "xrdp-view-logs",
      label: "View xrdp Logs",
      scope: { type: "global" },
      handler: { kind: "shell", command: "journalctl -u xrdp.service -n 50 --no-pager" },
      group: "xrdp",
    });

    // -----------------------------------------------------------------------
    // Agent Tool
    // -----------------------------------------------------------------------

    api.registerAgentTool({
      name: "xrdp-status",
      description: "Check xrdp and xrdp-sesman service status plus active RDP sessions",
      inputSchema: {
        type: "object",
        properties: {},
      },
      handler: async () => {
        const check = (unit: string): Promise<string> =>
          new Promise((resolve) => {
            import("node:child_process").then(({ execFile }) => {
              execFile("systemctl", ["is-active", unit], { timeout: 5000 }, (err, stdout) => {
                resolve(err ? "stopped" : stdout.trim());
              });
            });
          });

        const [xrdp, sesman] = await Promise.all([
          check("xrdp.service"),
          check("xrdp-sesman.service"),
        ]);

        const sessions = await getActiveSessions();

        return {
          xrdp: { status: xrdp, unit: "xrdp.service" },
          sesman: { status: sesman, unit: "xrdp-sesman.service" },
          serverIp: SERVER_IP,
          port: RDP_PORT,
          activeSessions: sessions.length,
          sessions,
        };
      },
    });

    // -----------------------------------------------------------------------
    // Knowledge Namespace
    // -----------------------------------------------------------------------

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    api.registerKnowledge({
      id: "xrdp",
      label: "xrdp",
      description: "xrdp remote desktop server setup and configuration",
      contentDir: resolve(__dirname, "../docs"),
      topics: [
        { title: "Setup Guide", path: "setup.md", description: "How to connect and manage xrdp" },
      ],
    });

    // -----------------------------------------------------------------------
    // Skill
    // -----------------------------------------------------------------------

    api.registerSkill({
      name: "xrdp",
      domain: "utility",
      triggers: ["xrdp", "rdp", "remote desktop", "remote session", "isolated desktop"],
      content: [
        `xrdp is installed on Nexus (${SERVER_IP}), listening on port ${RDP_PORT}.`,
        "Unlike RustDesk (which mirrors the physical display), xrdp provides ISOLATED desktop sessions.",
        "Each RDP connection gets its own X11 display, separate from the physical monitor.",
        "Services: xrdp.service (RDP listener), xrdp-sesman.service (session manager).",
        "Config: /etc/xrdp/xrdp.ini (server), /etc/xrdp/sesman.ini (sessions), /etc/xrdp/startwm.sh (desktop launcher).",
        "Connect with any RDP client: mstsc.exe (Windows), Remmina (Linux), Microsoft Remote Desktop (macOS/mobile).",
        `Connection string: ${SERVER_IP}:${RDP_PORT}`,
        "Users authenticate with their Linux system credentials.",
        "To allow a user to use xrdp, they need a Linux account on the machine.",
      ].join("\n"),
    });

    log.info("plugin-xrdp activated");
  },
});
