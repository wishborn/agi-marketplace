import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-php-app",
      label: "PHP App",
      description: "Generic PHP application hosting with Apache",
      category: "framework",
      projectCategories: ["web"],
      compatibleLanguages: ["php"],
      requirements: [
        { id: "php-runtime", label: "PHP Runtime", type: "expected" },
      ],
      containerConfig: {
        image: "ghcr.io/civicognita/php-apache:8.4",
        internalPort: 80,
        shared: false,
        volumeMounts: (ctx) => [
          `${ctx.projectPath}:/var/www/html:Z`,
        ],
        env: () => ({}),
        command: (ctx) => {
          if (ctx.mode === "development") {
            return ["php", "-S", "0.0.0.0:80", "-t", "/var/www/html"];
          }
          // Use docker-php-entrypoint to properly initialize Apache (handles PID 1, user switching)
          return ["docker-php-entrypoint", "apache2-foreground"];
        },
      },
      installActions: [
        { id: "composer.install", label: "Install Dependencies", command: "composer install" },
      ],
      logSources: [
        { id: "apache-error", label: "Apache Error Log", type: "container-file" as const, containerPath: "/var/log/apache2/error.log" },
      ],
      devCommands: {},
      guides: [
        { title: "Getting Started", content: "Place PHP files in the project root. Apache serves from the configured document root." },
      ],
      tools: [
        { id: "composer-install", label: "composer install", description: "Install PHP dependencies", action: "shell", command: "composer install" },
        { id: "composer-update", label: "composer update", description: "Update PHP dependencies", action: "shell", command: "composer update" },
        { id: "composer-dump", label: "composer dump-autoload", description: "Regenerate autoloader", action: "shell", command: "composer dump-autoload" },
      ],
      icon: "box",
    });
  },
});
