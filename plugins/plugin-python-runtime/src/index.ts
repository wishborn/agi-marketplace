import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPlugin, defineSettings, defineSettingsPage } from "@agi/sdk";

const execFileAsync = promisify(execFile);

export default createPlugin({
  async activate(api) {
  const log = api.getLogger();

  api.registerRuntime({
    id: "python-3.13",
    label: "Python 3.13",
    language: "python",
    version: "3.13",
    containerImage: "ghcr.io/civicognita/python:3.13",
    internalPort: 8000,
    projectTypes: ["python", "django", "fastapi", "flask"],
    installable: true,
    dependencies: [
      { name: "pip", version: "24.x", type: "bundled" },
    ],
  });

  api.registerRuntime({
    id: "python-3.12",
    label: "Python 3.12",
    language: "python",
    version: "3.12",
    containerImage: "ghcr.io/civicognita/python:3.12",
    internalPort: 8000,
    projectTypes: ["python", "django", "fastapi", "flask"],
    installable: true,
    dependencies: [
      { name: "pip", version: "24.x", type: "bundled" },
    ],
  });

  api.registerRuntime({
    id: "python-3.11",
    label: "Python 3.11",
    language: "python",
    version: "3.11",
    containerImage: "ghcr.io/civicognita/python:3.11",
    internalPort: 8000,
    projectTypes: ["python", "django", "fastapi", "flask"],
    installable: true,
    dependencies: [
      { name: "pip", version: "23.x", type: "bundled" },
    ],
  });

  api.registerHostingExtension({
    pluginId: "agi-python-runtime",
    fields: [
      {
        id: "runtimeId",
        label: "Python Version",
        type: "select",
        options: [
          { value: "python-3.13", label: "Python 3.13 (latest)" },
          { value: "python-3.12", label: "Python 3.12" },
          { value: "python-3.11", label: "Python 3.11" },
        ],
        defaultValue: "python-3.12",
        projectTypes: ["python", "django", "fastapi", "flask"],
      },
    ],
  });

  api.registerRuntimeInstaller({
    language: "python",

    listAvailable(): string[] {
      return ["3.13", "3.12", "3.11"];
    },

    async listInstalled(): Promise<string[]> {
      const installed: string[] = [];
      for (const ver of ["3.13", "3.12", "3.11"]) {
        try {
          await execFileAsync("podman", ["image", "exists", `ghcr.io/civicognita/python:${ver}`], { timeout: 10_000 });
          installed.push(ver);
        } catch { /* not pulled */ }
      }
      return installed;
    },

    async install(version: string): Promise<void> {
      const valid = ["3.13", "3.12", "3.11"];
      if (!valid.includes(version)) throw new Error(`Invalid Python version: ${version}`);
      log.info(`pulling ghcr.io/civicognita/python:${version}`);
      await execFileAsync("podman", ["pull", `ghcr.io/civicognita/python:${version}`], { timeout: 300_000 });
      log.info(`ghcr.io/civicognita/python:${version} pulled`);
    },

    async uninstall(version: string): Promise<void> {
      const valid = ["3.13", "3.12", "3.11"];
      if (!valid.includes(version)) throw new Error(`Invalid Python version: ${version}`);
      log.info(`removing ghcr.io/civicognita/python:${version}`);
      await execFileAsync("podman", ["rmi", `ghcr.io/civicognita/python:${version}`], { timeout: 60_000 });
      log.info(`ghcr.io/civicognita/python:${version} removed`);
    },
  });

  api.registerSettingsPage(
    defineSettingsPage("python-settings", "Python")
      .description("Python runtime versions and configuration")
      .icon("python")
      .section(
        defineSettings("python-versions", "Installed Versions")
          .description("Manage Python container images for project hosting")
          .configPath("runtimes.python")
          .type("runtime-manager")
          .language("python")
          .build()
      )
      .section(
        defineSettings("python-config", "Configuration")
          .description("Default Python settings for new projects")
          .configPath("runtimes.python")
          .field({
            id: "defaultVersion",
            label: "Default Version",
            type: "select",
            description: "Version used when creating new projects",
            options: [
              { value: "3.13", label: "Python 3.13" },
              { value: "3.12", label: "Python 3.12" },
              { value: "3.11", label: "Python 3.11" },
            ],
            defaultValue: "3.12",
          })
          .build()
      )
      .build(),
  );

  log.info("Python runtimes registered: 3.13, 3.12, 3.11");
  },
});
