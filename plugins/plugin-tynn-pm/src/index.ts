/**
 * plugin-tynn-pm — Tynn-the-service as a marketplace plugin (s127).
 *
 * Status:
 *   - t486 ✓ (scaffold)
 *   - t487 ✓ (ADF classification declared in package.json)
 *   - t488 ✓ (PmProvider registration plumbed via definePmProvider)
 *   - t489 (pending): MCP server template registration
 *   - t490 (deferred): Kanban MApp definition
 *   - t491 (pending): user-facing docs
 *
 * Architecture rationale: tynn-lite stays baked-in as the file-based
 * fallback (always available, zero config). This plugin is the upgrade
 * path — installing it lets projects switch to tynn-the-service for the
 * full MCP-backed experience plus the future Kanban MApp.
 *
 * Provider id "tynn-pm": the SDK's `definePmProvider` reserves "tynn" and
 * "tynn-lite" for the built-ins. Once the existing built-in TynnPmProvider
 * registration is moved out of gateway-core (paired with t489's broader
 * refactor), this plugin can adopt id "tynn" directly. For now, "tynn-pm"
 * coexists with the built-in.
 *
 * Factory implementation: currently returns a placeholder PmProvider whose
 * methods throw on call. The real factory (delegating to gateway-core's
 * TynnPmProvider via mcp-client) lands when t489's MCP server template
 * registration provides the configured server URL + bearer token to the
 * factory's `config` argument. Plugins don't depend on @agi/gateway-core,
 * so the implementation needs to either (a) use mcp-client directly, or
 * (b) re-export TynnPmProvider through @agi/sdk. The choice is logged as
 * a follow-up.
 *
 * ADF classification: 0UX + 0AGENT
 *   - 0UX: future Kanban MApp (t490) extends the dashboard's project surface
 *   - 0AGENT: PmProvider registration extends the agent's tool palette with
 *     the canonical PM workflow tools (list-tasks, set-status, add-comment, etc)
 */

import { createPlugin, definePmProvider, type PmProvider } from "@agi/sdk";

/** Placeholder PmProvider — every method returns a rejected promise to
 *  signal the factory is wired but not yet implemented. Replaced once
 *  t489 lands a real factory that delegates to gateway-core's
 *  TynnPmProvider via mcp-client. Async-throw (not sync-throw at the
 *  factory-return site) so the plugin lifecycle still loads cleanly;
 *  only callers of the methods see the unwired error. */
function createPlaceholderPmProvider(providerId: string): PmProvider {
  const notWired = async (op: string): Promise<never> => {
    throw new Error(
      `plugin-tynn-pm:${providerId}.${op}() is registered but not yet implemented. ` +
      `Awaiting s127 t489 (MCP server template registration) which configures the ` +
      `mcp-client this provider delegates to.`,
    );
  };
  return {
    providerId,
    getProject: () => notWired("getProject"),
    getNext: () => notWired("getNext"),
    getTask: () => notWired("getTask"),
    getStory: () => notWired("getStory"),
    findTasks: () => notWired("findTasks"),
    getComments: () => notWired("getComments"),
    setTaskStatus: () => notWired("setTaskStatus"),
    addComment: () => notWired("addComment"),
    updateTask: () => notWired("updateTask"),
    createTask: () => notWired("createTask"),
    iWish: () => notWired("iWish"),
  };
}

export default createPlugin({
  async activate(api) {
    const log = api.getLogger();

    // s127 t488 — register the tynn-pm PmProvider via definePmProvider.
    // Fields declare the config shape the dashboard uses to render the
    // "configure provider" form (server URL + Tynn API key). Factory
    // currently returns a placeholder; real wiring lands in t489 follow-up.
    api.registerPmProvider(
      definePmProvider("tynn-pm", "Tynn")
        .description(
          "Tynn-the-service via MCP. Provides the canonical PM workflow " +
          "(list-tasks, set-status, add-comment, etc) backed by tynn.ai's " +
          "MCP server. Upgrade from tynn-lite for projects that want full " +
          "PM features + the future Kanban MApp.",
        )
        .fields([
          {
            id: "serverUrl",
            label: "Tynn MCP server URL",
            type: "text",
            placeholder: "https://tynn.ai/mcp/tynn",
            description: "MCP server endpoint that exposes tynn's PM operations.",
          },
          {
            id: "apiKey",
            label: "Tynn API key",
            type: "password",
            placeholder: "Bearer token for tynn.ai authentication.",
            description: "Used to authenticate MCP requests; stored encrypted in the project's .env.",
          },
        ])
        .factory(() => createPlaceholderPmProvider("tynn-pm"))
        .build(),
    );

    // s127 t489 — register the per-project MCP server template. Surfaces in
    // the project's MCP-tab dropdown so owners can configure a tynn-MCP
    // server without manually editing project config. Template carries the
    // default endpoint URL + the env var name that holds the bearer token
    // (resolved against the project's .env at connect time).
    api.registerMcpServerTemplate({
      id: "tynn",
      name: "Tynn",
      description:
        "Tynn-the-service via MCP. Provides PM tools (list-tasks, set-status, " +
        "add-comment, getActiveFocusProgress, etc) for the agent. HTTP transport " +
        "with Bearer auth against tynn.ai.",
      transport: "http",
      defaultUrl: "https://tynn.ai/mcp/tynn",
      authTokenKey: "TYNN_API_KEY",
    });

    log.info("plugin-tynn-pm activated (s127 t486+t487+t488+t489; real factory still pending)");
  },
});
