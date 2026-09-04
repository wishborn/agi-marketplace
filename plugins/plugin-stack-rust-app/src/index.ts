import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-rust-app",
      label: "Rust App",
      description: "Rust application hosting — cargo build for optimized binaries, cargo run for development",
      category: "framework",
      projectCategories: ["app"],
      compatibleLanguages: ["rust"],
      requirements: [
        { id: "rust-runtime", label: "Rust Runtime", type: "expected" },
      ],
      containerConfig: {
        image: "ghcr.io/civicognita/rust:1.87",
        internalPort: 8080,
        shared: false,
        volumeMounts: (ctx) => [
          `${ctx.projectPath}:/app:Z`,
        ],
        env: () => ({
          PORT: "8080",
          RUST_LOG: "info",
        }),
        command: (ctx) => {
          if (ctx.mode === "development") {
            return ["cargo", "run"];
          }
          return ["sh", "-c", "cargo build --release && ./target/release/$(cargo metadata --format-version=1 --no-deps 2>/dev/null | grep -o '\"name\":\"[^\"]*\"' | head -1 | cut -d'\"' -f4)"];
        },
        healthCheck: "curl -sf http://localhost:8080/ || exit 1",
      },
      installActions: [
        { id: "cargo.build", label: "Build Project", command: "cargo build" },
      ],
      devCommands: {
        dev: "cargo run",
        build: "cargo build --release",
        test: "cargo test",
      },
      guides: [
        {
          title: "Development",
          content: "## Getting Started\n\n```bash\ncargo build       # Compile\ncargo run         # Dev server on :8080\ncargo test        # Run tests\ncargo build --release  # Optimized production binary\n```",
        },
      ],
      tools: [
        { id: "cargo-run", label: "cargo run", description: "Run application", action: "shell", command: "cargo run" },
        { id: "cargo-build", label: "cargo build", description: "Build debug binary", action: "shell", command: "cargo build" },
        { id: "cargo-build-release", label: "cargo build --release", description: "Build optimized binary", action: "shell", command: "cargo build --release" },
        { id: "cargo-test", label: "cargo test", description: "Run tests", action: "shell", command: "cargo test" },
        { id: "cargo-clippy", label: "cargo clippy", description: "Run linter", action: "shell", command: "cargo clippy" },
      ],
      icon: "box",
    });
  },
});
