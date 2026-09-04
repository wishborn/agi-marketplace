/**
 * PostgreSQL Service Plugin — registers PostgreSQL database service.
 *
 * Provides PostgreSQL 17, 16, and 15 as selectable versions.
 * Default credentials: postgres/aionima, database "aionima".
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPlugin, defineSettingsPage } from "@agi/sdk";

const execFileAsync = promisify(execFile);

const VERSION_TAGS = ["17", "16", "15"] as const;

const VERSIONS = [
  { id: "postgres-17", name: "PostgreSQL 17", image: "ghcr.io/civicognita/postgres:17", description: "PostgreSQL 17 — latest stable (pgvector, PostGIS)" },
  { id: "postgres-16", name: "PostgreSQL 16", image: "ghcr.io/civicognita/postgres:16", description: "PostgreSQL 16 — previous stable (pgvector, PostGIS)" },
  { id: "postgres-15", name: "PostgreSQL 15", image: "ghcr.io/civicognita/postgres:15", description: "PostgreSQL 15 — maintenance (pgvector, PostGIS)" },
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
      defaultPort: 5432,
      env: {
        POSTGRES_PASSWORD: "aionima",
        POSTGRES_DB: "aionima",
      },
      volumes: [
        "{dataDir}/data:/var/lib/postgresql/data",
      ],
      healthCheck: "pg_isready -U postgres",
    });

    api.registerRuntime({
      id: v.id,
      label: v.name,
      language: "postgresql",
      version: v.id.replace("postgres-", ""),
      containerImage: v.image,
      internalPort: 5432,
      projectTypes: [],
      installable: true,
    });
  }

  // Runtime installer for PostgreSQL container images
  api.registerRuntimeInstaller({
    language: "postgresql",

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
              if (name.includes(`civicognita/postgres:${tag}`)) {
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
        throw new Error(`Invalid PostgreSQL version: ${version}`);
      }
      log.info(`pulling ghcr.io/civicognita/postgres:${version}`);
      await execFileAsync("podman", [
        "pull", `ghcr.io/civicognita/postgres:${version}`,
      ], { timeout: 300_000 });
      log.info(`ghcr.io/civicognita/postgres:${version} pulled successfully`);
    },

    async uninstall(version: string): Promise<void> {
      if (!(VERSION_TAGS as readonly string[]).includes(version)) {
        throw new Error(`Invalid PostgreSQL version: ${version}`);
      }
      log.info(`removing ghcr.io/civicognita/postgres:${version}`);
      await execFileAsync("podman", [
        "rmi", `ghcr.io/civicognita/postgres:${version}`,
      ], { timeout: 60_000 });
      log.info(`ghcr.io/civicognita/postgres:${version} removed`);
    },
  });

  // Hosting extension — database version selector in the Development tab
  api.registerHostingExtension({
    pluginId: "agi-postgres",
    fields: [
      {
        id: "postgresVersion",
        label: "PostgreSQL",
        type: "select",
        options: [
          { value: "", label: "None" },
          { value: "17", label: "PostgreSQL 17" },
          { value: "16", label: "PostgreSQL 16" },
          { value: "15", label: "PostgreSQL 15" },
        ],
        defaultValue: "",
        projectTypes: [],
      },
    ],
  });

  // Connection info endpoint
  api.registerHttpRoute("GET", "/connection-info", async (_req, reply) => {
    const config = api.getConfig();
    const pgConfig = (config["plugins"] as Record<string, unknown> | undefined)?.["postgres"] as Record<string, unknown> | undefined;
    const password = (pgConfig?.["defaultPassword"] as string) || "aionima";
    const database = (pgConfig?.["defaultDatabase"] as string) || "aionima";
    const port = (pgConfig?.["defaultPort"] as number) || 5432;

    reply.send({
      host: "localhost",
      port,
      user: "postgres",
      password,
      database,
      url: `postgresql://postgres:${password}@localhost:${port}/${database}`,
    });
  });

  // Settings page — version selection, credentials, and container images
  api.registerSettingsPage(
    defineSettingsPage("postgres", "PostgreSQL")
      .description("Configure PostgreSQL database versions and credentials.")
      .icon("database")
      .position(70)
      .section({
        id: "postgres-images",
        label: "Container Images",
        type: "runtime-manager",
        language: "postgresql",
        configPath: "plugins.postgres",
        fields: [],
      })
      .section({
        id: "postgres-defaults",
        label: "Default Credentials",
        description: "Default credentials for new PostgreSQL instances.",
        configPath: "plugins.postgres",
        fields: [
          { id: "defaultPassword", label: "Root Password", type: "password", configKey: "defaultPassword", placeholder: "aionima" },
          { id: "defaultDatabase", label: "Default Database", type: "text", configKey: "defaultDatabase", placeholder: "aionima" },
          { id: "defaultPort", label: "Default Port", type: "number", configKey: "defaultPort", defaultValue: 5432 },
        ],
      })
      .build()
  );

  // ---------------------------------------------------------------------------
  // Stack registrations (shared DB containers)
  // ---------------------------------------------------------------------------

  for (const v of VERSIONS) {
    api.registerStack({
      id: `stack-${v.id}`,
      label: v.name,
      description: `${v.description}. Shared container — one PostgreSQL instance serves all projects.`,
      category: "database",
      projectCategories: ["app", "web"],
      requirements: [{ id: "postgresql", label: v.name, type: "provided" }],
      guides: [{ title: "Connection", content: "Use the connection URL from the stack card to connect. Each project gets its own database and credentials within the shared PostgreSQL container." }],
      containerConfig: {
        image: v.image,
        internalPort: 5432,
        shared: true,
        sharedKey: v.id,
        volumeMounts: () => [`agi-${v.id}-data:/var/lib/postgresql/data`],
        env: () => ({ POSTGRES_PASSWORD: "aionima-root" }),
        healthCheck: "pg_isready -U postgres",
      },
      databaseConfig: {
        engine: "postgresql",
        rootUser: "postgres",
        rootPasswordEnvVar: "POSTGRES_PASSWORD",
        setupScript: (ctx) => [
          "psql", "-U", "postgres", "-c",
          `CREATE USER ${ctx.databaseUser} WITH PASSWORD '${ctx.databasePassword}'; CREATE DATABASE ${ctx.databaseName} OWNER ${ctx.databaseUser};`,
        ],
        teardownScript: (ctx) => [
          "psql", "-U", "postgres", "-c",
          `DROP DATABASE IF EXISTS ${ctx.databaseName}; DROP USER IF EXISTS ${ctx.databaseUser};`,
        ],
        connectionUrlTemplate: "postgresql://{user}:{password}@localhost:{port}/{database}",
      },
      tools: [
        { id: "psql", label: "psql", description: "Open PostgreSQL shell", action: "shell", command: "psql -U {user} -d {database}" },
      ],
      icon: "database",
    });
  }

  log.info("PostgreSQL services registered: 17, 16, 15");
  },
});
