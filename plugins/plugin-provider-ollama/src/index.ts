/**
 * plugin-provider-ollama — Ollama local model provider.
 *
 * Registers a settings page for configuring Ollama connection and default model.
 */

import { createPlugin, defineSettingsPage } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    const log = api.getLogger();

    api.registerSettingsPage(
      defineSettingsPage("provider-ollama", "Ollama")
        .description("Local models — Ollama provider")
        .icon("hard-drive")
        .position(12)
        .section({
          id: "ollama-connection",
          label: "Connection",
          configPath: "bots.providers.ollama",
          fields: [
            {
              id: "baseUrl",
              label: "Base URL",
              type: "text",
              defaultValue: "http://localhost:11434",
              placeholder: "http://localhost:11434",
              description: "Ollama API endpoint. Default is localhost:11434.",
            },
            {
              id: "model",
              label: "Default Model",
              type: "model-select",
              provider: "ollama",
              placeholder: "Select a local model...",
              description: "Default model for new conversations",
            },
          ],
        })
        .build()
    );

    log.info("provider-ollama activated");
  },
});
