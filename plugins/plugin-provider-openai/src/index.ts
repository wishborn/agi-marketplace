/**
 * plugin-provider-openai — OpenAI (GPT) API provider.
 *
 * Registers a settings page for configuring the OpenAI API key, base URL, and default model.
 */

import { createPlugin, defineSettingsPage } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    const log = api.getLogger();

    api.registerSettingsPage(
      defineSettingsPage("provider-openai", "OpenAI")
        .description("GPT models — OpenAI API provider")
        .icon("sparkles")
        .position(11)
        .section({
          id: "openai-credentials",
          label: "Credentials",
          configPath: "bots.providers.openai",
          fields: [
            {
              id: "apiKey",
              label: "API Key",
              type: "password",
              placeholder: "sk-...",
              description: "Your OpenAI API key from platform.openai.com",
            },
            {
              id: "baseUrl",
              label: "Base URL",
              type: "text",
              placeholder: "https://api.openai.com/v1",
              description: "Custom API endpoint (leave empty for default). Useful for Azure OpenAI or compatible APIs.",
            },
            {
              id: "model",
              label: "Default Model",
              type: "model-select",
              provider: "openai",
              placeholder: "Select a GPT model...",
              description: "Default model for new conversations",
            },
          ],
        })
        .build()
    );

    log.info("provider-openai activated");
  },
});
