import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-fastapi",
      label: "FastAPI",
      description: "High-performance async Python API framework with automatic OpenAPI docs, Pydantic validation, and dependency injection",
      category: "framework",
      projectCategories: ["app"],
      compatibleLanguages: ["python"],
      requirements: [
        { id: "python-runtime", label: "Python Runtime", type: "expected" },
        { id: "fastapi", label: "FastAPI", type: "provided" },
      ],
      containerConfig: {
        image: "ghcr.io/civicognita/python:3.12",
        internalPort: 8000,
        shared: false,
        volumeMounts: (ctx) => [
          `${ctx.projectPath}:/app:Z`,
        ],
        env: () => ({
          PYTHONDONTWRITEBYTECODE: "1",
          PYTHONUNBUFFERED: "1",
        }),
        command: (ctx) => {
          const install = "pip install -r requirements.txt 2>/dev/null || true";
          if (ctx.mode === "development") {
            return ["bash", "-c", `${install} && uvicorn main:app --host 0.0.0.0 --port 8000 --reload`];
          }
          return ["bash", "-c", `${install} && uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2`];
        },
        healthCheck: "curl -sf http://localhost:8000/docs || exit 1",
      },
      installActions: [
        { id: "pip.install", label: "Install Dependencies", command: "pip install -r requirements.txt" },
      ],
      devCommands: {
        dev: "uvicorn main:app --reload",
        test: "pytest",
      },
      guides: [
        {
          title: "Development",
          content: "## Getting Started\n\n```bash\npip install -r requirements.txt\nuvicorn main:app --reload    # Dev server on :8000\n```\n\nAPI docs auto-generated at `/docs` (Swagger) and `/redoc`.",
        },
      ],
      tools: [
        { id: "pip-install", label: "pip install", description: "Install dependencies", action: "shell", command: "pip install -r requirements.txt" },
        { id: "uvicorn-dev", label: "uvicorn dev", description: "Start dev server with reload", action: "shell", command: "uvicorn main:app --reload" },
        { id: "pytest", label: "pytest", description: "Run tests", action: "shell", command: "pytest" },
      ],
      icon: "zap",
    });
  },
});
