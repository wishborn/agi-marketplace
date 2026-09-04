import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-flask",
      label: "Flask",
      description: "Lightweight Python web framework — minimal core with extensions for databases, auth, and templating",
      category: "framework",
      projectCategories: ["app", "web"],
      compatibleLanguages: ["python"],
      requirements: [
        { id: "python-runtime", label: "Python Runtime", type: "expected" },
        { id: "flask", label: "Flask", type: "provided" },
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
          FLASK_APP: "app.py",
          FLASK_ENV: ctx.mode,
        }),
        command: (ctx) => {
          const install = "pip install -r requirements.txt 2>/dev/null || true";
          if (ctx.mode === "development") {
            return ["bash", "-c", `${install} && flask run --host=0.0.0.0 --port=8000 --debug`];
          }
          return ["bash", "-c", `${install} && gunicorn --bind 0.0.0.0:8000 --workers 2 app:app 2>/dev/null || flask run --host=0.0.0.0 --port=8000`];
        },
      },
      installActions: [
        { id: "pip.install", label: "Install Dependencies", command: "pip install -r requirements.txt" },
      ],
      devCommands: {
        dev: "flask run --debug",
        test: "pytest",
      },
      guides: [
        {
          title: "Development",
          content: "## Getting Started\n\n```bash\npip install -r requirements.txt\nflask run --debug    # Dev server on :8000\n```\n\nFlask looks for `app.py` or the `FLASK_APP` env var.",
        },
      ],
      tools: [
        { id: "pip-install", label: "pip install", description: "Install dependencies", action: "shell", command: "pip install -r requirements.txt" },
        { id: "flask-run", label: "flask run", description: "Start dev server", action: "shell", command: "flask run --debug" },
        { id: "pytest", label: "pytest", description: "Run tests", action: "shell", command: "pytest" },
      ],
      icon: "box",
    });
  },
});
