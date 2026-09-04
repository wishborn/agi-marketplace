import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-django",
      label: "Django",
      description: "Python web framework with batteries included — ORM, admin panel, auth, and template engine",
      category: "framework",
      projectCategories: ["app", "web"],
      compatibleLanguages: ["python"],
      requirements: [
        { id: "python-runtime", label: "Python Runtime", type: "expected" },
        { id: "django", label: "Django", type: "provided" },
      ],
      containerConfig: {
        image: "ghcr.io/civicognita/python:3.12",
        internalPort: 8000,
        shared: false,
        volumeMounts: (ctx) => [
          `${ctx.projectPath}:/app:Z`,
        ],
        env: (ctx) => ({
          PYTHONDONTWRITEBYTECODE: "1",
          PYTHONUNBUFFERED: "1",
          PORT: "8000",
        }),
        command: (ctx) => {
          const install = "pip install -r requirements.txt 2>/dev/null || true";
          if (ctx.mode === "development") {
            return ["bash", "-c", `${install} && python manage.py runserver 0.0.0.0:8000`];
          }
          return ["bash", "-c", `${install} && gunicorn --bind 0.0.0.0:8000 --workers 2 $(basename $(find . -name wsgi.py -path '*/wsgi.py' | head -1) .py | sed 's|/|.|g' | sed 's|.wsgi||').wsgi 2>/dev/null || python manage.py runserver 0.0.0.0:8000`];
        },
        healthCheck: "curl -sf http://localhost:8000/ || exit 1",
      },
      installActions: [
        { id: "pip.install", label: "Install Dependencies", command: "pip install -r requirements.txt" },
        { id: "migrate", label: "Run Migrations", command: "python manage.py migrate", optional: true },
      ],
      devCommands: {
        dev: "python manage.py runserver",
        test: "python manage.py test",
        migrate: "python manage.py migrate",
        shell: "python manage.py shell",
      },
      guides: [
        {
          title: "Development",
          content: [
            "## Getting Started",
            "",
            "```bash",
            "pip install -r requirements.txt",
            "python manage.py migrate",
            "python manage.py runserver    # Dev server on :8000",
            "```",
            "",
            "## Key Directories",
            "",
            "- `manage.py` — Django CLI entry point",
            "- `{project}/settings.py` — Configuration",
            "- `{project}/urls.py` — URL routing",
            "- `{app}/models.py` — Database models",
            "- `{app}/views.py` — View functions",
            "- `templates/` — HTML templates",
          ].join("\n"),
        },
      ],
      tools: [
        { id: "pip-install", label: "pip install", description: "Install Python dependencies", action: "shell", command: "pip install -r requirements.txt" },
        { id: "manage-migrate", label: "manage.py migrate", description: "Run database migrations", action: "shell", command: "python manage.py migrate" },
        { id: "manage-makemigrations", label: "manage.py makemigrations", description: "Create new migrations", action: "shell", command: "python manage.py makemigrations" },
        { id: "manage-shell", label: "manage.py shell", description: "Interactive Python shell", action: "shell", command: "python manage.py shell" },
        { id: "manage-test", label: "manage.py test", description: "Run tests", action: "shell", command: "python manage.py test" },
        { id: "manage-createsuperuser", label: "manage.py createsuperuser", description: "Create admin user", action: "shell", command: "python manage.py createsuperuser" },
      ],
      icon: "box",
    });
  },
});
