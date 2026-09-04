/**
 * Redis Service Plugin — registers Redis in-memory data store service.
 *
 * Provides Redis 7.4, 7.2, and 6.2 LTS as selectable versions.
 * Persistence enabled by default (appendonly).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPlugin } from "@agi/sdk";

const execFileAsync = promisify(execFile);

const VERSION_TAGS = ["7.4", "7.2", "6.2"] as const;

const VERSIONS = [
  { id: "redis-7.4", name: "Redis 7.4", image: "ghcr.io/civicognita/redis:7.4", description: "Redis 7.4 — latest stable" },
  { id: "redis-7.2", name: "Redis 7.2", image: "ghcr.io/civicognita/redis:7.2", description: "Redis 7.2 — previous stable" },
  { id: "redis-6.2", name: "Redis 6.2", image: "ghcr.io/civicognita/redis:6.2", description: "Redis 6.2 LTS — long-term support" },
] as const;

export default createPlugin({
  async activate(api) {
  const log = api.getLogger();

  for (const v of VERSIONS) {
    api.registerService({
      id: v.id,
      name: v.name,
      description: v.description,
      containerImage: v.image,
      defaultPort: 6379,
      env: {},
      volumes: [
        "{dataDir}/data:/data",
      ],
      healthCheck: "redis-cli ping",
    });

    api.registerRuntime({
      id: v.id,
      label: v.name,
      language: "redis",
      version: v.id.replace("redis-", ""),
      containerImage: v.image,
      internalPort: 6379,
      projectTypes: [],
      installable: true,
    });
  }

  // Runtime installer for Redis container images
  api.registerRuntimeInstaller({
    language: "redis",

    listAvailable(): string[] {
      return [...VERSION_TAGS];
    },

    async listInstalled(): Promise<string[]> {
      const installed: string[] = [];
      try {
        const { stdout } = await execFileAsync("podman", [
          "images", "--format", "json",
        ], { timeout: 10_000 });
        const images = JSON.parse(stdout || "[]") as { Names?: string[] }[];
        for (const img of images) {
          for (const name of img.Names ?? []) {
            for (const tag of VERSION_TAGS) {
              if (name.includes(`civicognita/redis:${tag}`)) {
                installed.push(tag);
              }
            }
          }
        }
      } catch {
        // podman not available or no images
      }
      return installed;
    },

    async install(version: string): Promise<void> {
      if (!(VERSION_TAGS as readonly string[]).includes(version)) {
        throw new Error(`Invalid Redis version: ${version}`);
      }
      log.info(`pulling ghcr.io/civicognita/redis:${version}`);
      await execFileAsync("podman", [
        "pull", `ghcr.io/civicognita/redis:${version}`,
      ], { timeout: 300_000 });
      log.info(`ghcr.io/civicognita/redis:${version} pulled successfully`);
    },

    async uninstall(version: string): Promise<void> {
      if (!(VERSION_TAGS as readonly string[]).includes(version)) {
        throw new Error(`Invalid Redis version: ${version}`);
      }
      log.info(`removing ghcr.io/civicognita/redis:${version}`);
      await execFileAsync("podman", [
        "rmi", `ghcr.io/civicognita/redis:${version}`,
      ], { timeout: 60_000 });
      log.info(`ghcr.io/civicognita/redis:${version} removed`);
    },
  });

  // Hosting extension — cache version selector in the Development tab
  api.registerHostingExtension({
    pluginId: "agi-redis",
    fields: [
      {
        id: "redisVersion",
        label: "Redis",
        type: "select",
        options: [
          { value: "", label: "None" },
          { value: "7.4", label: "Redis 7.4" },
          { value: "7.2", label: "Redis 7.2" },
          { value: "6.2", label: "Redis 6.2 LTS" },
        ],
        defaultValue: "",
        projectTypes: [],
      },
    ],
  });

  // Settings page
  api.registerSettingsPage({
    id: "redis",
    label: "Redis",
    description: "Redis in-memory cache and data store service.",
    icon: "database",
    position: 72,
    sections: [
      {
        id: "redis-images",
        label: "Container Images",
        type: "runtime-manager",
        language: "redis",
        configPath: "plugins.redis",
        fields: [],
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Stack registrations (shared containers)
  // ---------------------------------------------------------------------------

  for (const v of VERSIONS) {
    api.registerStack({
      id: `stack-${v.id}`,
      label: v.name,
      description: `${v.description}. Shared container — one Redis instance serves all projects. Persistence enabled (appendonly).`,
      category: "database",
      projectCategories: ["app", "web"],
      requirements: [{ id: "redis", label: v.name, type: "provided" }],
      guides: [{ title: "Connection", content: "Connect via `redis://localhost:{port}`. Each project shares the same Redis instance — use key prefixes to namespace data." }],
      containerConfig: {
        image: v.image,
        internalPort: 6379,
        shared: true,
        sharedKey: v.id,
        volumeMounts: () => [`agi-${v.id}-data:/data`],
        env: () => ({}),
        command: () => ["redis-server", "--appendonly", "yes"],
        healthCheck: "redis-cli ping",
      },
      tools: [
        { id: "redis-cli", label: "redis-cli", description: "Open Redis CLI", action: "shell", command: "redis-cli -p {port}" },
      ],
      icon: "database",
    });
  }

  log.info("Redis services registered: 7.4, 7.2, 6.2");
  },
});
