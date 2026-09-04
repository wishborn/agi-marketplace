import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-laravel",
      label: "Laravel",
      description: "Laravel PHP framework — routing, Eloquent ORM, Blade templates",
      category: "framework",
      projectCategories: ["web"],
      compatibleLanguages: ["php"],
      requirements: [
        { id: "php-runtime", label: "PHP Runtime", type: "expected" },
        { id: "laravel", label: "Laravel Framework", type: "provided" },
      ],
      containerConfig: {
        image: "ghcr.io/civicognita/php-apache:8.4",
        internalPort: 80,
        shared: false,
        docRoot: "public",
        volumeMounts: (ctx) => [
          `${ctx.projectPath}:/var/www/html:Z`,
        ],
        env: () => ({}),
        command: (ctx) => {
          // Custom GHCR image has all PHP extensions, Composer, and mod_rewrite pre-installed.
          // Fix permissions on writable dirs (storage, cache) — mounted volume is owned by host UID.
          const setup = [
            "chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database 2>/dev/null || chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database 2>/dev/null || true",
            "[ -d /var/www/html/vendor ] || composer install --no-interaction --optimize-autoloader --working-dir=/var/www/html",
          ].join(" && ");
          if (ctx.mode === "development") {
            return ["bash", "-c", `${setup} && php artisan serve --host=0.0.0.0 --port=80`];
          }
          return [
            "bash", "-c",
            `${setup} && sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/html/public|g' /etc/apache2/sites-available/000-default.conf 2>/dev/null; docker-php-entrypoint apache2-foreground`,
          ];
        },
        healthCheck: "curl -sf http://localhost/ || exit 1",
      },
      installActions: [
        { id: "composer.require.laravel/laravel", label: "Install Laravel", command: "composer require laravel/laravel ." },
        { id: "composer.install", label: "Install Dependencies", command: "composer install" },
        { id: "npm.install", label: "Install Frontend Deps", command: "npm install", optional: true },
      ],
      logSources: [
        { id: "laravel-log", label: "Laravel Log", type: "container-file" as const, containerPath: "/var/www/html/storage/logs/laravel.log" },
      ],
      devCommands: {
        dev: "php artisan serve",
        build: "npm run build",
        test: "php artisan test",
        lint: "vendor/bin/pint",
        migrate: "php artisan migrate",
        seed: "php artisan db:seed",
      },
      guides: [
        {
          title: "Getting Started",
          content: [
            "## Initial Setup",
            "",
            "Every Laravel project needs its dependencies installed, a `.env` file, and an application key before it can run.",
            "",
            "**1. Install dependencies**",
            "",
            "```bash",
            "composer install",
            "npm install        # if the project has frontend assets",
            "```",
            "",
            "**2. Create the .env file**",
            "",
            "Copy the example file that ships with Laravel:",
            "",
            "```bash",
            "cp .env.example .env",
            "```",
            "",
            "Or use the **Environment Variables** tab — if a `.env.example` exists, it will offer to create your `.env` automatically.",
            "",
            "**3. Generate the application key**",
            "",
            "Laravel requires `APP_KEY` to be set for encryption and sessions:",
            "",
            "```bash",
            "php artisan key:generate",
            "```",
            "",
            "This writes a random key into your `.env` file. Without it, Laravel throws a runtime error.",
            "",
            "**4. Configure your database**",
            "",
            "Edit `.env` and set your database connection:",
            "",
            "```",
            "DB_CONNECTION=pgsql",
            "DB_HOST=localhost",
            "DB_PORT=5432",
            "DB_DATABASE=myapp",
            "DB_USERNAME=myapp_user",
            "DB_PASSWORD=your_password",
            "```",
            "",
            "If you added a PostgreSQL or MariaDB stack, the connection URL is on the stack card.",
            "",
            "**5. Run migrations and start the server**",
            "",
            "```bash",
            "php artisan migrate",
            "php artisan serve",
            "```",
            "",
            "The dev server runs on port 8000 by default. In hosted mode, Aionima handles this automatically.",
          ].join("\n"),
        },
        {
          title: "Log Files",
          content: "**Laravel logs:** `storage/logs/laravel.log`\n\n**Apache logs:** Available in the container at `/var/log/apache2/error.log` and `/var/log/apache2/access.log`. View them in the Logs panel or with the Terminal tool.",
        },
      ],
      tools: [
        // Common actions
        { id: "artisan-migrate", label: "Migrate", description: "Run database migrations", action: "shell", command: "php artisan migrate" },
        { id: "artisan-db-seed", label: "Seed", description: "Seed the database", action: "shell", command: "php artisan db:seed" },
        { id: "artisan-test", label: "Test", description: "Run tests", action: "shell", command: "php artisan test" },
        { id: "artisan-optimize", label: "Optimize", description: "Cache config, routes, views, events", action: "shell", command: "php artisan optimize" },
        { id: "artisan-optimize-clear", label: "Clear Cache", description: "Clear all cached config, routes, views", action: "shell", command: "php artisan optimize:clear" },
        { id: "artisan-fresh-seed", label: "Full Reset", description: "Drop all tables, re-migrate, and seed", action: "shell", command: "php artisan migrate:fresh --seed" },
        // Dependencies
        { id: "composer-install", label: "composer install", description: "Install PHP dependencies", action: "shell", command: "composer install" },
        { id: "npm-install", label: "npm install", description: "Install frontend dependencies", action: "shell", command: "npm install" },
        // Dev servers
        { id: "artisan-serve", label: "artisan serve", description: "Start Laravel dev server", action: "shell", command: "php artisan serve" },
        { id: "npm-dev", label: "npm run dev", description: "Start Vite dev server", action: "shell", command: "npm run dev" },
        // Setup
        { id: "artisan-key-generate", label: "key:generate", description: "Generate application key", action: "shell", command: "php artisan key:generate" },
        { id: "artisan-storage-link", label: "storage:link", description: "Create storage symlink", action: "shell", command: "php artisan storage:link" },
        // Info
        { id: "artisan-route-list", label: "route:list", description: "List all registered routes", action: "shell", command: "php artisan route:list" },
        { id: "artisan-migrate-status", label: "migrate:status", description: "Show migration status", action: "shell", command: "php artisan migrate:status" },
      ],
      icon: "box",
    });
  },
});
