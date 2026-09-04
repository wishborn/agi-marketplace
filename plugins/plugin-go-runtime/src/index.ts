import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPlugin, defineSettings, defineSettingsPage } from "@agi/sdk";

const execFileAsync = promisify(execFile);

export default createPlugin({
  async activate(api) {
  const log = api.getLogger();

  api.registerRuntime({
    id: "go-1.24",
    label: "Go 1.24",
    language: "go",
    version: "1.24",
    containerImage: "ghcr.io/civicognita/go:1.24",
    internalPort: 8080,
    projectTypes: ["go"],
    installable: true,
  });

  api.registerRuntime({
    id: "go-1.23",
    label: "Go 1.23",
    language: "go",
    version: "1.23",
    containerImage: "ghcr.io/civicognita/go:1.23",
    internalPort: 8080,
    projectTypes: ["go"],
    installable: true,
  });

  api.registerRuntime({
    id: "go-1.22",
    label: "Go 1.22",
    language: "go",
    version: "1.22",
    containerImage: "ghcr.io/civicognita/go:1.22",
    internalPort: 8080,
    projectTypes: ["go"],
    installable: true,
  });

  api.registerHostingExtension({
    pluginId: "agi-go-runtime",
    fields: [
      {
        id: "runtimeId",
        label: "Go Version",
        type: "select",
        options: [
          { value: "go-1.24", label: "Go 1.24 (latest)" },
          { value: "go-1.23", label: "Go 1.23" },
          { value: "go-1.22", label: "Go 1.22" },
        ],
        defaultValue: "go-1.24",
        projectTypes: ["go"],
      },
    ],
  });

  api.registerRuntimeInstaller({
    language: "go",

    listAvailable(): string[] {
      return ["1.24", "1.23", "1.22"];
    },

    async listInstalled(): Promise<string[]> {
      const installed: string[] = [];
      for (const ver of ["1.24", "1.23", "1.22"]) {
        try {
          await execFileAsync("podman", ["image", "exists", `ghcr.io/civicognita/go:${ver}`], { timeout: 10_000 });
          installed.push(ver);
        } catch { /* not pulled */ }
      }
      return installed;
    },

    async install(version: string): Promise<void> {
      const valid = ["1.24", "1.23", "1.22"];
      if (!valid.includes(version)) throw new Error(`Invalid Go version: ${version}`);
      log.info(`pulling ghcr.io/civicognita/go:${version}`);
      await execFileAsync("podman", ["pull", `ghcr.io/civicognita/go:${version}`], { timeout: 300_000 });
      log.info(`ghcr.io/civicognita/go:${version} pulled`);
    },

    async uninstall(version: string): Promise<void> {
      const valid = ["1.24", "1.23", "1.22"];
      if (!valid.includes(version)) throw new Error(`Invalid Go version: ${version}`);
      log.info(`removing ghcr.io/civicognita/go:${version}`);
      await execFileAsync("podman", ["rmi", `ghcr.io/civicognita/go:${version}`], { timeout: 60_000 });
      log.info(`ghcr.io/civicognita/go:${version} removed`);
    },
  });

  api.registerSettingsPage(
    defineSettingsPage("go-settings", "Go")
      .description("Go runtime versions and configuration")
      .icon("go")
      .section(
        defineSettings("go-versions", "Installed Versions")
          .description("Manage Go container images for project hosting")
          .configPath("runtimes.go")
          .type("runtime-manager")
          .language("go")
          .build()
      )
      .build(),
  );

  log.info("Go runtimes registered: 1.24, 1.23, 1.22");
  },
});
