/**
 * plugin-provider-anthropic — Anthropic (Claude) API provider.
 *
 * Registers a settings page for configuring the Anthropic API key and default model.
 */

import { createPlugin, defineSettingsPage } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    const log = api.getLogger();

    api.registerSettingsPage(
      defineSettingsPage("provider-anthropic", "Anthropic")
        .description("Claude models — Anthropic API provider")
        .icon("brain")
        .position(10)
        .section({
          id: "anthropic-credentials",
          label: "Credentials",
          configPath: "bots.providers.anthropic",
          fields: [
            {
              id: "apiKey",
              label: "API Key",
              type: "password",
              placeholder: "sk-ant-...",
              description: "Your Anthropic API key from console.anthropic.com",
            },
            {
              id: "model",
              label: "Default Model",
              type: "model-select",
              provider: "anthropic",
              placeholder: "Select a Claude model...",
              description: "Default model for new conversations",
            },
          ],
        })
        .build()
    );

    log.info("provider-anthropic activated");
  },
});
