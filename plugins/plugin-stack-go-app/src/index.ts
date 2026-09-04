import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-go-app",
      label: "Go App",
      description: "Go application hosting — fast compilation, single binary output, built-in HTTP server",
      category: "framework",
      projectCategories: ["app", "web"],
      compatibleLanguages: ["go"],
      requirements: [
        { id: "go-runtime", label: "Go Runtime", type: "expected" },
      ],
      containerConfig: {
        image: "ghcr.io/civicognita/go:1.24",
        internalPort: 8080,
        shared: false,
        volumeMounts: (ctx) => [
          `${ctx.projectPath}:/app:Z`,
        ],
        env: (ctx) => ({
          PORT: "8080",
          CGO_ENABLED: "1",
        }),
        command: (ctx) => {
          if (ctx.mode === "development") {
            return ["go", "run", "."];
          }
          return ["sh", "-c", "go build -o /tmp/server . && /tmp/server"];
        },
        healthCheck: "curl -sf http://localhost:8080/ || exit 1",
      },
      installActions: [
        { id: "go.mod.download", label: "Download Dependencies", command: "go mod download" },
      ],
      devCommands: {
        dev: "go run .",
        build: "go build -o server .",
        test: "go test ./...",
      },
      guides: [
        {
          title: "Development",
          content: "## Getting Started\n\n```bash\ngo mod download\ngo run .          # Dev server on :8080\ngo build -o server .  # Production binary\n```\n\nSet `PORT` env var to change the listen port.",
        },
      ],
      tools: [
        { id: "go-run", label: "go run", description: "Run application", action: "shell", command: "go run ." },
        { id: "go-build", label: "go build", description: "Build binary", action: "shell", command: "go build -o server ." },
        { id: "go-test", label: "go test", description: "Run tests", action: "shell", command: "go test ./..." },
        { id: "go-mod-tidy", label: "go mod tidy", description: "Clean up dependencies", action: "shell", command: "go mod tidy" },
      ],
      icon: "box",
    });
  },
});
