/**
 * Hono API Stack Plugin — Hono + Drizzle ORM + Lucia Auth
 *
 * Registers the Hono API framework stack definition.
 */

import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-hono-api",
      label: "Hono API",
      description:
        "Lightweight Node.js API framework with Drizzle ORM for type-safe database access and Lucia for session-based authentication. Built for auth services and microservices.",
      category: "framework",
      projectCategories: ["app"],
      compatibleLanguages: ["node"],
      requirements: [
        { id: "node", label: "Node.js Runtime", type: "expected" },
        { id: "database", label: "Database", description: "PostgreSQL or SQLite", type: "expected" },
        { id: "hono", label: "Hono", type: "provided" },
        { id: "drizzle", label: "Drizzle ORM", type: "provided" },
        { id: "lucia", label: "Lucia Auth", type: "provided" },
      ],
      guides: [
        {
          title: "Development",
          content: [
            "## Getting Started",
            "",
            "```bash",
            "npm install                 # Install dependencies",
            "npx drizzle-kit push        # Push schema to database",
            "npm run dev                 # Start dev server",
            "```",
            "",
            "## Key Directories",
            "",
            "- `src/` — Application source code",
            "- `src/routes/` — Hono route handlers",
            "- `src/db/` — Drizzle schema and connection",
            "- `src/auth/` — Lucia auth configuration",
            "- `drizzle.config.ts` — Drizzle Kit configuration",
          ].join("\n"),
        },
        {
          title: "Agent Guide",
          content: [
            "## Working with Hono API Projects",
            "",
            "- Routes are defined with `app.get()`, `app.post()`, etc. — similar to Express but lighter",
            "- Drizzle schema lives alongside code — `src/db/schema.ts` defines tables",
            "- Schema changes: edit schema file, then `npx drizzle-kit push` (dev) or `npx drizzle-kit generate` + `npx drizzle-kit migrate` (production)",
            "- Lucia handles sessions: create session on login, validate on each request via middleware",
            "- Password hashing uses Argon2 — never store plaintext passwords",
            "- Database connection via `postgres` package (not pg) for PostgreSQL",
            "- TypeScript strict mode; Hono provides full type inference on routes",
          ].join("\n"),
        },
      ],
      tools: [
        { id: "npm-install", label: "npm install", description: "Install dependencies", action: "shell", command: "npm install" },
        { id: "hono-dev", label: "npm run dev", description: "Start Hono dev server", action: "shell", command: "npm run dev" },
        { id: "hono-build", label: "npm run build", description: "Build for production", action: "shell", command: "npm run build" },
        { id: "drizzle-push", label: "npx drizzle-kit push", description: "Push schema to database", action: "shell", command: "npx drizzle-kit push" },
        { id: "drizzle-generate", label: "npx drizzle-kit generate", description: "Generate SQL migrations", action: "shell", command: "npx drizzle-kit generate" },
      ],
      icon: "zap",
    });
  },
});
