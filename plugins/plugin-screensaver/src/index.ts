/**
 * plugin-screensaver — Drifting-panel screensaver with system stats and sparkle effects.
 *
 * Registers:
 * - Settings page with idle timeout, enable/disable toggle, and custom screensaver path
 * - HTTP routes for screensaver config and registration management
 * - Gateway startup hook to auto-register xss-lock when enabled
 * - Gateway shutdown hook to clean up xss-lock
 */

import { createPlugin, type AionimaPluginAPI } from "@agi/sdk";
import { join } from "node:path";
import { execFile as execFileCb } from "node:child_process";

const DEFAULT_IDLE_SECONDS = 180; // 3 minutes

/**
 * Detect the active X11 DISPLAY even when running as a systemd service.
 * Checks process.env first, then queries logged-in user sessions via `w`,
 * and falls back to `:0`.
 */
/** Cached XAUTHORITY path detected from the user's session. */
let detectedXauthority: string | undefined;

async function detectDisplay(): Promise<string> {
  if (process.env.DISPLAY) return process.env.DISPLAY;

  // Try to find DISPLAY from a graphical session's process environment.
  // This works even when loginctl doesn't expose the Display property (common on Ubuntu/GDM).
  try {
    const pgrep = await new Promise<string>((resolve) => {
      // Look for a process that typically holds DISPLAY: gnome-session, gnome-shell, plasmashell, xfce4-session
      execFileCb("pgrep", ["-u", String(process.getuid?.()), "-f", "gnome-session|gnome-shell|plasmashell|xfce4-session|mate-session|cinnamon-session"], { timeout: 3000 }, (err, stdout) => {
        resolve(err ? "" : stdout.trim());
      });
    });
    const pid = pgrep.split("\n")[0];
    if (pid) {
      const { readFile } = await import("node:fs/promises");
      const environ = await readFile(`/proc/${pid}/environ`, "utf-8").catch(() => "");
      const match = environ.match(/DISPLAY=([^\0]+)/);
      const xauthMatch = environ.match(/XAUTHORITY=([^\0]+)/);
      if (xauthMatch?.[1]) detectedXauthority = xauthMatch[1];
      if (match?.[1]) return match[1];
    }
  } catch {
    // Process sniffing failed
  }

  // Fallback: check loginctl sessions for a Display property
  try {
    const sessions = await new Promise<string>((resolve, reject) => {
      execFileCb("loginctl", ["list-sessions", "--no-legend", "--no-pager"], { timeout: 3000 }, (err, stdout) => {
        if (err) reject(err); else resolve(stdout);
      });
    });
    for (const line of sessions.trim().split("\n")) {
      const sessionId = line.trim().split(/\s+/)[0];
      if (!sessionId) continue;
      const props = await new Promise<string>((resolve) => {
        execFileCb("loginctl", ["show-session", sessionId, "--property=Display,Type"], { timeout: 3000 }, (err, stdout) => {
          resolve(err ? "" : stdout);
        });
      });
      const displayMatch = props.match(/Display=(.+)/);
      const typeMatch = props.match(/Type=(x11|wayland)/);
      if (displayMatch?.[1] && typeMatch) {
        return displayMatch[1];
      }
    }
  } catch {
    // loginctl not available or failed
  }

  // Fallback: check if :0 is alive via xdpyinfo
  try {
    await new Promise<void>((resolve, reject) => {
      execFileCb("xdpyinfo", ["-display", ":0"], { timeout: 3000, env: { ...process.env, DISPLAY: ":0" } }, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    return ":0";
  } catch {
    // :0 isn't responding
  }

  // Last resort
  return ":0";
}

type ScreensaverSpeed = "slow" | "normal" | "fast";
type ScreensaverDesign = "hud-bar" | "orbital" | "matrix";

interface ScreensaverConfig {
  enabled: boolean;
  idleSeconds: number;
  speed: ScreensaverSpeed;
  design: ScreensaverDesign;
  /** Path to a custom screensaver Electron app (3rd-party replacement). Empty = use built-in. */
  customPath: string;
}

const VALID_SPEEDS: ScreensaverSpeed[] = ["slow", "normal", "fast"];
const VALID_DESIGNS: ScreensaverDesign[] = ["hud-bar", "orbital", "matrix"];

function getScreensaverConfig(api: AionimaPluginAPI): ScreensaverConfig {
  const raw = api.getConfig() as Record<string, unknown>;
  const pluginConfig = (raw?.plugins as Record<string, unknown>)?.screensaver as Record<string, unknown> | undefined;
  const speed = typeof pluginConfig?.speed === "string" && VALID_SPEEDS.includes(pluginConfig.speed as ScreensaverSpeed)
    ? pluginConfig.speed as ScreensaverSpeed : "normal";
  const design = typeof pluginConfig?.design === "string" && VALID_DESIGNS.includes(pluginConfig.design as ScreensaverDesign)
    ? pluginConfig.design as ScreensaverDesign : "hud-bar";
  return {
    enabled: pluginConfig?.enabled !== false,
    idleSeconds: typeof pluginConfig?.idleSeconds === "number" ? pluginConfig.idleSeconds : DEFAULT_IDLE_SECONDS,
    speed,
    design,
    customPath: typeof pluginConfig?.customPath === "string" ? pluginConfig.customPath : "",
  };
}

export default createPlugin({
  async activate(api) {
    const log = api.getLogger();
    const workspaceRoot = api.getWorkspaceRoot();

    // Path to the built-in screensaver Electron app
    const builtinAppDir = join(workspaceRoot, "apps", "screensaver");
    const builtinMainJs = join(builtinAppDir, "dist", "main.js");

    // Track the xss-lock child process
    let xssLockPid: number | null = null;
    let detectedDisplay: string | null = null;

    // -------------------------------------------------------------------
    // Resolve which screensaver binary to use
    // -------------------------------------------------------------------

    function resolveScreensaverCommand(config: ScreensaverConfig): { electron: string; main: string } | null {
      if (config.customPath) {
        // 3rd-party screensaver: expect an Electron app with dist/main.js
        return {
          electron: join(config.customPath, "node_modules", ".bin", "electron"),
          main: join(config.customPath, "dist", "main.js"),
        };
      }
      return {
        electron: join(builtinAppDir, "node_modules", ".bin", "electron"),
        main: builtinMainJs,
      };
    }

    // -------------------------------------------------------------------
    // xss-lock management
    // -------------------------------------------------------------------

    async function startXssLock(): Promise<{ pid: number } | { error: string }> {
      const config = getScreensaverConfig(api);
      if (!config.enabled) return { error: "Screensaver is disabled" };

      // Kill existing if running
      await stopXssLock();

      const cmd = resolveScreensaverCommand(config);
      if (!cmd) return { error: "No screensaver app configured" };

      const { execFile, spawn } = await import("node:child_process");

      // Detect the machine's display and X authority
      detectedDisplay = await detectDisplay();
      const displayEnv: Record<string, string | undefined> = { ...process.env, DISPLAY: detectedDisplay };
      if (detectedXauthority) displayEnv.XAUTHORITY = detectedXauthority;

      // Check xss-lock availability
      const hasXssLock = await new Promise<boolean>((resolve) => {
        execFile("which", ["xss-lock"], { timeout: 3000 }, (err) => resolve(!err));
      });
      if (!hasXssLock) return { error: "xss-lock is not installed (sudo apt install xss-lock)" };

      // Check xset availability
      const hasXset = await new Promise<boolean>((resolve) => {
        execFile("which", ["xset"], { timeout: 3000 }, (err) => resolve(!err));
      });

      // Set idle timeout via xset
      if (hasXset) {
        await new Promise<void>((resolve) => {
          execFile("xset", ["s", String(config.idleSeconds), "0"], { timeout: 3000, env: displayEnv }, () => resolve());
        });
      }

      // Check if electron binary exists
      const { existsSync } = await import("node:fs");
      if (!existsSync(cmd.electron)) return { error: `Electron binary not found at ${cmd.electron}` };
      if (!existsSync(cmd.main)) return { error: `Screensaver main.js not found at ${cmd.main}. Run: cd apps/screensaver && pnpm build` };

      // Spawn xss-lock
      const child = spawn("xss-lock", ["--", cmd.electron, cmd.main], {
        detached: true,
        stdio: "ignore",
        env: displayEnv,
      });

      child.unref();
      xssLockPid = child.pid ?? null;

      if (!xssLockPid) return { error: "Failed to spawn xss-lock" };

      log.info(`xss-lock started (PID: ${xssLockPid}, idle: ${config.idleSeconds}s)`);
      return { pid: xssLockPid };
    }

    async function stopXssLock(): Promise<void> {
      if (xssLockPid) {
        try {
          process.kill(xssLockPid, "SIGTERM");
          log.info(`xss-lock stopped (PID: ${xssLockPid})`);
        } catch {
          // Already dead
        }
        xssLockPid = null;
      }

      // Also kill any orphan xss-lock processes we spawned previously
      const { execFile } = await import("node:child_process");
      await new Promise<void>((resolve) => {
        execFile("pkill", ["-f", "xss-lock.*apps/screensaver"], { timeout: 3000 }, () => resolve());
      });
    }

    // -------------------------------------------------------------------
    // HTTP Routes
    // -------------------------------------------------------------------

    // GET /config — current screensaver settings
    api.registerHttpRoute("GET", "/config", async (_req, reply) => {
      const config = getScreensaverConfig(api);
      reply.send({
        ...config,
        running: xssLockPid !== null,
        pid: xssLockPid,
        display: detectedDisplay,
        builtinAppDir,
      });
    });

    // POST /start — activate xss-lock
    api.registerHttpRoute("POST", "/start", async (_req, reply) => {
      const result = await startXssLock();
      if ("error" in result) {
        reply.code(400).send(result);
      } else {
        reply.send({ ok: true, pid: result.pid });
      }
    });

    // POST /stop — deactivate xss-lock
    api.registerHttpRoute("POST", "/stop", async (_req, reply) => {
      await stopXssLock();
      reply.send({ ok: true });
    });

    // POST /preview — launch screensaver immediately for testing
    api.registerHttpRoute("POST", "/preview", async (_req, reply) => {
      const config = getScreensaverConfig(api);
      const cmd = resolveScreensaverCommand(config);
      if (!cmd) {
        reply.code(400).send({ error: "No screensaver configured" });
        return;
      }

      const { existsSync } = await import("node:fs");
      if (!existsSync(cmd.electron) || !existsSync(cmd.main)) {
        reply.code(400).send({ error: "Screensaver not built. Run: cd apps/screensaver && pnpm build" });
        return;
      }

      const { spawn } = await import("node:child_process");
      const display = detectedDisplay ?? await detectDisplay();
      const previewEnv: Record<string, string | undefined> = { ...process.env, DISPLAY: display };
      if (detectedXauthority) previewEnv.XAUTHORITY = detectedXauthority;
      const child = spawn(cmd.electron, [cmd.main], {
        detached: true,
        stdio: "ignore",
        env: previewEnv,
      });
      child.unref();
      reply.send({ ok: true, pid: child.pid });
    });

    // -------------------------------------------------------------------
    // Settings Page
    // -------------------------------------------------------------------

    api.registerSettingsPage({
      id: "screensaver",
      label: "Screensaver",
      description: "Screen saver with drifting panels, system stats, and sparkle effects",
      icon: "monitor",
      position: 60,
      sections: [
        {
          id: "screensaver-general",
          label: "General",
          configPath: "plugins.screensaver",
          fields: [
            {
              id: "enabled",
              label: "Enable Screensaver",
              type: "toggle",
              description: "Register with xss-lock to activate on idle",
              defaultValue: true,
              configKey: "plugins.screensaver.enabled",
            },
            {
              id: "idleSeconds",
              label: "Idle Timeout",
              type: "number",
              description: "Seconds of inactivity before the screensaver activates",
              defaultValue: DEFAULT_IDLE_SECONDS,
              placeholder: "180",
              configKey: "plugins.screensaver.idleSeconds",
            },
            {
              id: "speed",
              label: "Drift Speed",
              type: "select",
              description: "How fast the screensaver elements move across the screen",
              defaultValue: "normal",
              options: [
                { label: "Slow", value: "slow" },
                { label: "Normal", value: "normal" },
                { label: "Fast", value: "fast" },
              ],
              configKey: "plugins.screensaver.speed",
            },
            {
              id: "design",
              label: "Design",
              type: "select",
              description: "Visual style of the screensaver",
              defaultValue: "hud-bar",
              options: [
                { label: "HUD Bar — horizontal stats bar with ring charts", value: "hud-bar" },
                { label: "Orbital — logo center with orbiting stat satellites", value: "orbital" },
                { label: "Matrix — digital rain with monospace stats", value: "matrix" },
              ],
              configKey: "plugins.screensaver.design",
            },
          ],
        },
        {
          id: "screensaver-custom",
          label: "Custom Screensaver",
          description: "Replace the built-in screensaver with a 3rd-party Electron app",
          configPath: "plugins.screensaver",
          fields: [
            {
              id: "customPath",
              label: "Custom Screensaver Path",
              type: "text",
              description: "Absolute path to a custom screensaver Electron app. Leave empty to use the built-in screensaver.",
              placeholder: "/path/to/custom-screensaver",
              configKey: "plugins.screensaver.customPath",
            },
          ],
        },
        {
          id: "screensaver-control",
          label: "Control",
          type: "custom",
          configPath: "plugins.screensaver",
          fields: [],
        },
      ],
    });

    // -------------------------------------------------------------------
    // Actions
    // -------------------------------------------------------------------

    api.registerAction({
      id: "screensaver-preview",
      label: "Preview Screensaver",
      description: "Launch the screensaver immediately for testing",
      scope: { type: "global" },
      handler: { kind: "api", method: "POST", endpoint: "/preview" },
      group: "Screensaver",
    });

    api.registerAction({
      id: "screensaver-restart",
      label: "Restart xss-lock",
      description: "Stop and restart the idle detection daemon",
      scope: { type: "global" },
      handler: { kind: "api", method: "POST", endpoint: "/start" },
      group: "Screensaver",
    });

    // -------------------------------------------------------------------
    // Auto-start xss-lock during plugin activation
    // -------------------------------------------------------------------

    const config = getScreensaverConfig(api);
    if (config.enabled) {
      // Run async — don't block plugin loading if xss-lock takes time
      startXssLock().then((result) => {
        if ("error" in result) {
          log.warn(`screensaver auto-start failed: ${result.error}`);
        }
      });
    }

    // -------------------------------------------------------------------
    // Cleanup on gateway shutdown
    // -------------------------------------------------------------------

    api.registerHook("gateway:shutdown", async () => {
      await stopXssLock();
    });

    // -------------------------------------------------------------------
    // Config change handler — restart xss-lock when settings change
    // -------------------------------------------------------------------

    api.registerHook("config:changed", async (key: string) => {
      if (!key.startsWith("plugins.screensaver")) return;

      const config = getScreensaverConfig(api);
      if (config.enabled) {
        const result = await startXssLock();
        if ("error" in result) {
          log.warn(`screensaver restart failed after config change: ${result.error}`);
        }
      } else {
        await stopXssLock();
      }
    });

    log.info("plugin-screensaver activated");
  },

  async deactivate() {
    // xss-lock cleanup is handled by the gateway:shutdown hook
  },
});
