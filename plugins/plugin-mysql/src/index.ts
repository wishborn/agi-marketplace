/**
 * MySQL / MariaDB Service Plugin — registers MariaDB database service.
 *
 * Provides MariaDB 11.x, 10.11, and 10.6 LTS as selectable versions.
 * Default credentials: root/aionima, database "aionima".
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPlugin, defineSettingsPage } from "@agi/sdk";

const execFileAsync = promisify(execFile);

const VERSION_TAGS = ["11.4", "10.11", "10.6"] as const;

const VERSIONS = [
  { id: "mariadb-11.4", name: "MariaDB 11.4", image: "ghcr.io/civicognita/mariadb:11.4", description: "MariaDB 11.4 LTS — latest long-term support" },
  { id: "mariadb-10.11", name: "MariaDB 10.11", image: "ghcr.io/civicognita/mariadb:10.11", description: "MariaDB 10.11 LTS — previous long-term support" },
  { id: "mariadb-10.6", name: "MariaDB 10.6", image: "ghcr.io/civicognita/mariadb:10.6", description: "MariaDB 10.6 LTS — maintenance" },
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
      defaultPort: 3306,
      env: {
        MARIADB_ROOT_PASSWORD: "aionima",
        MARIADB_DATABASE: "aionima",
      },
      volumes: [
        "{dataDir}/data:/var/lib/mysql",
      ],
      healthCheck: "healthcheck --connect --innodb_initialized",
    });

    api.registerRuntime({
      id: v.id,
      label: v.name,
      language: "mariadb",
      version: v.id.replace("mariadb-", ""),
      containerImage: v.image,
      internalPort: 3306,
      projectTypes: [],
      installable: true,
    });
  }

  // Runtime installer for MariaDB container images
  api.registerRuntimeInstaller({
    language: "mariadb",

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
              if (name.includes(`civicognita/mariadb:${tag}`)) {
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
        throw new Error(`Invalid MariaDB version: ${version}`);
      }
      log.info(`pulling ghcr.io/civicognita/mariadb:${version}`);
      await execFileAsync("podman", [
        "pull", `ghcr.io/civicognita/mariadb:${version}`,
      ], { timeout: 300_000 });
      log.info(`ghcr.io/civicognita/mariadb:${version} pulled successfully`);
    },

    async uninstall(version: string): Promise<void> {
      if (!(VERSION_TAGS as readonly string[]).includes(version)) {
        throw new Error(`Invalid MariaDB version: ${version}`);
      }
      log.info(`removing ghcr.io/civicognita/mariadb:${version}`);
      await execFileAsync("podman", [
        "rmi", `ghcr.io/civicognita/mariadb:${version}`,
      ], { timeout: 60_000 });
      log.info(`ghcr.io/civicognita/mariadb:${version} removed`);
    },
  });

  // Hosting extension — database version selector in the Development tab
  api.registerHostingExtension({
    pluginId: "agi-mysql",
    fields: [
      {
        id: "mariadbVersion",
        label: "MariaDB",
        type: "select",
        options: [
          { value: "", label: "None" },
          { value: "11.4", label: "MariaDB 11.4 LTS" },
          { value: "10.11", label: "MariaDB 10.11 LTS" },
          { value: "10.6", label: "MariaDB 10.6 LTS" },
        ],
        defaultValue: "",
        projectTypes: [],
      },
    ],
  });

  // Connection info endpoint
  api.registerHttpRoute("GET", "/connection-info", async (_req, reply) => {
    const config = api.getConfig();
    const myConfig = (config["plugins"] as Record<string, unknown> | undefined)?.["mysql"] as Record<string, unknown> | undefined;
    const password = (myConfig?.["defaultPassword"] as string) || "aionima";
    const database = (myConfig?.["defaultDatabase"] as string) || "aionima";
    const port = (myConfig?.["defaultPort"] as number) || 3306;

    reply.send({
      host: "localhost",
      port,
      user: "root",
      password,
      database,
      url: `mysql://root:${password}@localhost:${port}/${database}`,
    });
  });

  // Settings page — version selection, credentials, and container images
  api.registerSettingsPage(
    defineSettingsPage("mysql", "MySQL / MariaDB")
      .description("Configure MariaDB database versions and credentials.")
      .icon("database")
      .position(71)
      .section({
        id: "mysql-images",
        label: "Container Images",
        type: "runtime-manager",
        language: "mariadb",
        configPath: "plugins.mysql",
        fields: [],
      })
      .section({
        id: "mysql-defaults",
        label: "Default Credentials",
        description: "Default credentials for new MariaDB instances.",
        configPath: "plugins.mysql",
        fields: [
          { id: "defaultPassword", label: "Root Password", type: "password", configKey: "defaultPassword", placeholder: "aionima" },
          { id: "defaultDatabase", label: "Default Database", type: "text", configKey: "defaultDatabase", placeholder: "aionima" },
          { id: "defaultPort", label: "Default Port", type: "number", configKey: "defaultPort", defaultValue: 3306 },
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
      description: `${v.description}. Shared container — one MariaDB instance serves all projects.`,
      category: "database",
      projectCategories: ["app", "web"],
      requirements: [{ id: "mariadb", label: v.name, type: "provided" }],
      guides: [{ title: "Connection", content: "Use the connection URL from the stack card to connect. Each project gets its own database and credentials within the shared MariaDB container." }],
      containerConfig: {
        image: v.image,
        internalPort: 3306,
        shared: true,
        sharedKey: v.id,
        volumeMounts: () => [`agi-${v.id}-data:/var/lib/mysql`],
        env: () => ({ MARIADB_ROOT_PASSWORD: "aionima-root" }),
        healthCheck: "healthcheck --connect --innodb_initialized",
      },
      databaseConfig: {
        engine: "mariadb",
        rootUser: "root",
        rootPasswordEnvVar: "MARIADB_ROOT_PASSWORD",
        setupScript: (ctx) => [
          "mysql", "-u", "root", `-p${ctx.databasePassword}`, "-e",
          `CREATE DATABASE IF NOT EXISTS ${ctx.databaseName}; CREATE USER IF NOT EXISTS '${ctx.databaseUser}'@'%' IDENTIFIED BY '${ctx.databasePassword}'; GRANT ALL ON ${ctx.databaseName}.* TO '${ctx.databaseUser}'@'%';`,
        ],
        teardownScript: (ctx) => [
          "mysql", "-u", "root", "-paionima-root", "-e",
          `DROP DATABASE IF EXISTS ${ctx.databaseName}; DROP USER IF EXISTS '${ctx.databaseUser}'@'%';`,
        ],
        connectionUrlTemplate: "mysql://{user}:{password}@localhost:{port}/{database}",
      },
      tools: [
        { id: "mysql-cli", label: "mysql", description: "Open MariaDB shell", action: "shell", command: "mysql -u {user} -p{password} {database}" },
      ],
      icon: "database",
    });
  }

  log.info("MariaDB services registered: 11.4, 10.11, 10.6");
  },
});
