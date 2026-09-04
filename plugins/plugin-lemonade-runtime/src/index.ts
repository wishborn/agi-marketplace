/**
 * agi-lemonade-runtime — local AI server with NPU/GPU/CPU auto-routing.
 *
 * Brings Lemonade (https://github.com/lemonade-sdk/lemonade) online as
 * AGI's default local-LLM backplane. Lemonade speaks OpenAI/Anthropic/
 * Ollama-compatible APIs on port 13305 and auto-routes each model to the
 * best available backend (AMD XDNA 2 NPU via FastFlowLM, GPU via ROCm,
 * CPU via llama.cpp). On first install, picks up the AMD NPU on
 * supported Ryzen AI hardware so all local inference offloads there.
 *
 * This plugin:
 *   - Registers a system service describing Lemonade's install + lifecycle.
 *   - Adds a Settings page for port + local-first preference.
 *   - Registers Aion-callable agent tools (lemonade_*) that proxy through
 *     AGI's own /api/lemonade/* routes — never shell-out to the Lemonade CLI.
 *   - Does NOT register the LLM provider — that's baked into AGI core
 *     under the "lemonade" type so the router's config.providers["lemonade"]
 *     check just needs the gateway.json entry the settings page writes.
 *
 * Install script lives at src/install.sh and handles Ubuntu 24.04 /
 * 25.10 / 26.04, Arch, Fedora (stub), macOS beta (stub). The plugin
 * cache stages it at ~/.agi/plugins/cache/agi-lemonade-runtime/src/.
 */

import { createPlugin, defineSettingsPage } from "@agi/sdk";
import { homedir } from "node:os";
import { join } from "node:path";

// Plugin runs in-process with the gateway, so the proxy is always localhost.
// Port comes from gateway.json — read at call time (not boot) so hot-reload
// of `gateway.port` is picked up without a plugin reload.
function gatewayBase(api: { getConfig: () => Record<string, unknown> }): string {
  const cfg = api.getConfig();
  const gw = (cfg.gateway as { port?: number } | undefined) ?? {};
  const port = gw.port ?? 3100;
  return `http://127.0.0.1:${port}`;
}

// Tool-handler helper: call AGI's /api/lemonade/* proxy + parse JSON.
// Always goes through AGI's own routes, never directly to Lemonade — the
// owner's rule is "all operations through AGI."
async function agiCall<T>(
  api: { getConfig: () => Record<string, unknown> },
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T | { error: string }> {
  const url = `${gatewayBase(api)}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 30_000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let parsed: unknown;
    try { parsed = text.length > 0 ? JSON.parse(text) : {}; } catch { parsed = text; }
    if (!res.ok) {
      const errMsg = typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `HTTP ${res.status}`;
      return { error: errMsg };
    }
    return parsed as T;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export default createPlugin({
  async activate(api) {
    const log = api.getLogger();

    // -----------------------------------------------------------------------
    // System service — install + lifecycle for Lemonade
    // -----------------------------------------------------------------------

    const installScript = join(
      homedir(),
      ".agi",
      "plugins",
      "cache",
      "agi-lemonade-runtime",
      "src",
      "install.sh",
    );

    api.registerSystemService({
      id: "lemonade-server",
      name: "Lemonade Server",
      description:
        "Local AI server — serves GGUF/ONNX LLMs, auto-selects NPU/GPU/CPU " +
        "backend per model. OpenAI/Anthropic/Ollama-compatible APIs on port 13305.",
      unitName: "lemonade-server.service",
      installedCheck: "command -v lemonade-server || command -v flm",
      installCommand: `bash "${installScript}"`,
      statusCommand: "systemctl --user is-active lemonade-server 2>/dev/null || systemctl is-active lemonade-server 2>/dev/null",
      startCommand: "systemctl --user start lemonade-server 2>/dev/null || sudo systemctl start lemonade-server",
      stopCommand: "systemctl --user stop lemonade-server 2>/dev/null || sudo systemctl stop lemonade-server",
      restartCommand: "systemctl --user restart lemonade-server 2>/dev/null || sudo systemctl restart lemonade-server",
      agentAware: true,
      agentDescription:
        "Lemonade local AI server. When running, LLM traffic routes here by default " +
        "(see router.localFirst). Auto-selects NPU on AMD XDNA 2 hardware, GPU " +
        "via ROCm, or CPU via llama.cpp depending on the loaded model.",
    });

    // -----------------------------------------------------------------------
    // Settings page — connection + local-first preference
    // -----------------------------------------------------------------------

    api.registerSettingsPage(
      defineSettingsPage("lemonade-runtime", "Lemonade")
        .description("Local AI server — NPU/GPU/CPU auto-routing")
        .icon("cpu")
        .position(11) // between Anthropic (10) and Ollama (12)
        .section({
          id: "lemonade-connection",
          label: "Connection",
          configPath: "providers.lemonade",
          fields: [
            {
              id: "baseUrl",
              label: "Base URL",
              type: "text",
              defaultValue: "http://127.0.0.1:13305",
              placeholder: "http://127.0.0.1:13305",
              description: "Lemonade API endpoint. Default is localhost:13305.",
            },
            {
              id: "model",
              label: "Default Model",
              type: "text",
              placeholder: "default",
              description:
                "Default model identifier (matches whatever you've pulled with " +
                "`agi lemonade pull <name>`). Leave as 'default' to let Lemonade pick.",
            },
          ],
        })
        // s111 t374 — Provider plugin settings slim-down. Routing controls
        // (localFirst, escalation, floor/ceiling) belong on the system-level
        // Settings → Providers page, not on a per-Provider plugin's settings.
        // Plugin pages express only "what models are available through this
        // Provider on this system." The agent.router.localFirst config field
        // remains consumed by the agent-router (default: true) — it's just
        // not configurable from this plugin's UI anymore.
        .build(),
    );

    // -----------------------------------------------------------------------
    // Agent tools — Aion-callable Lemonade operations.
    //
    // Every tool proxies through AGI's /api/lemonade/* routes. Never
    // shell-out to `lemonade` CLI from here; AGI is the single point of
    // orchestration.
    // -----------------------------------------------------------------------

    api.registerAgentTool({
      name: "lemonade_status",
      description:
        "Get the live state of the Lemonade local AI server: whether it's " +
        "reachable, version, currently-loaded models, available devices " +
        "(NPU/iGPU/CPU), and which serving backends are installed. Use this " +
        "before suggesting model operations to confirm Lemonade is up.",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        const r = await agiCall<unknown>(api, "/api/lemonade/status", { timeoutMs: 7_000 });
        return JSON.stringify(r);
      },
    });

    api.registerAgentTool({
      name: "lemonade_models",
      description:
        "List all models currently installed in the local Lemonade server. " +
        "Returns the OpenAI-compatible models list (each entry has at least " +
        "an `id` field). Use to confirm which models Aion can route LLM " +
        "calls to without an additional pull.",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: async () => {
        const r = await agiCall<unknown>(api, "/api/lemonade/models", { timeoutMs: 10_000 });
        return JSON.stringify(r);
      },
    });

    api.registerAgentTool({
      name: "lemonade_pull",
      description:
        "Pull (download + register) a model from the Lemonade catalog into " +
        "the local server. Long-running — can take minutes for multi-GB " +
        "models. Use when the owner asks to install a specific local model " +
        "or when onboarding needs a small chat model. Provide the canonical " +
        "model name (e.g. 'Gemma-4-E2B-it-GGUF', 'SmolLM2-135M-Instruct').",
      inputSchema: {
        type: "object",
        properties: {
          model: {
            type: "string",
            description: "Lemonade catalog name of the model to pull.",
          },
        },
        required: ["model"],
      },
      handler: async (input) => {
        const model = String(input.model ?? "").trim();
        if (!model) return JSON.stringify({ error: "model is required" });
        const r = await agiCall<unknown>(api, "/api/lemonade/models/pull", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model }),
          timeoutMs: 600_000,
        });
        return JSON.stringify(r);
      },
    });

    api.registerAgentTool({
      name: "lemonade_load",
      description:
        "Load a previously-pulled model into Lemonade's serving memory so " +
        "it can answer chat completion requests. Only one LLM can be loaded " +
        "at a time; loading a second one unloads the first. Use when " +
        "switching between locally-installed models.",
      inputSchema: {
        type: "object",
        properties: {
          model: {
            type: "string",
            description: "Name of the previously-pulled model to load.",
          },
        },
        required: ["model"],
      },
      handler: async (input) => {
        const model = String(input.model ?? "").trim();
        if (!model) return JSON.stringify({ error: "model is required" });
        const r = await agiCall<unknown>(api, "/api/lemonade/models/load", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model }),
          timeoutMs: 60_000,
        });
        return JSON.stringify(r);
      },
    });

    log.info("agi-lemonade-runtime activated (system service + 4 agent tools)");
  },
});
