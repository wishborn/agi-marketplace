import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPlugin, defineSettings, defineSettingsPage } from "@agi/sdk";

const execFileAsync = promisify(execFile);

export default createPlugin({
  async activate(api) {
  const log = api.getLogger();

  api.registerRuntime({
    id: "rust-1.87",
    label: "Rust 1.87",
    language: "rust",
    version: "1.87",
    containerImage: "ghcr.io/civicognita/rust:1.87",
    internalPort: 8080,
    projectTypes: ["rust"],
    installable: true,
    dependencies: [
      { name: "cargo", version: "1.87", type: "bundled" },
    ],
  });

  api.registerRuntime({
    id: "rust-1.86",
    label: "Rust 1.86",
    language: "rust",
    version: "1.86",
    containerImage: "ghcr.io/civicognita/rust:1.86",
    internalPort: 8080,
    projectTypes: ["rust"],
    installable: true,
    dependencies: [
      { name: "cargo", version: "1.86", type: "bundled" },
    ],
  });

  api.registerHostingExtension({
    pluginId: "agi-rust-runtime",
    fields: [
      {
        id: "runtimeId",
        label: "Rust Version",
        type: "select",
        options: [
          { value: "rust-1.87", label: "Rust 1.87 (latest)" },
          { value: "rust-1.86", label: "Rust 1.86" },
        ],
        defaultValue: "rust-1.87",
        projectTypes: ["rust"],
      },
    ],
  });

  api.registerRuntimeInstaller({
    language: "rust",

    listAvailable(): string[] {
      return ["1.87", "1.86"];
    },

    async listInstalled(): Promise<string[]> {
      const installed: string[] = [];
      for (const ver of ["1.87", "1.86"]) {
        try {
          await execFileAsync("podman", ["image", "exists", `ghcr.io/civicognita/rust:${ver}`], { timeout: 10_000 });
          installed.push(ver);
        } catch { /* not pulled */ }
      }
      return installed;
    },

    async install(version: string): Promise<void> {
      const valid = ["1.87", "1.86"];
      if (!valid.includes(version)) throw new Error(`Invalid Rust version: ${version}`);
      log.info(`pulling ghcr.io/civicognita/rust:${version}`);
      await execFileAsync("podman", ["pull", `ghcr.io/civicognita/rust:${version}`], { timeout: 300_000 });
      log.info(`ghcr.io/civicognita/rust:${version} pulled`);
    },

    async uninstall(version: string): Promise<void> {
      const valid = ["1.87", "1.86"];
      if (!valid.includes(version)) throw new Error(`Invalid Rust version: ${version}`);
      log.info(`removing ghcr.io/civicognita/rust:${version}`);
      await execFileAsync("podman", ["rmi", `ghcr.io/civicognita/rust:${version}`], { timeout: 60_000 });
      log.info(`ghcr.io/civicognita/rust:${version} removed`);
    },
  });

  api.registerSettingsPage(
    defineSettingsPage("rust-settings", "Rust")
      .description("Rust runtime versions and configuration")
      .icon("rust")
      .section(
        defineSettings("rust-versions", "Installed Versions")
          .description("Manage Rust container images for project hosting")
          .configPath("runtimes.rust")
          .type("runtime-manager")
          .language("rust")
          .build()
      )
      .build(),
  );

  log.info("Rust runtimes registered: 1.87, 1.86");
  },
});
