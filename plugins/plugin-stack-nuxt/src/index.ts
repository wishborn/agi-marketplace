import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-nuxt",
      label: "Nuxt",
      description: "Vue.js framework with SSR, file-based routing, and auto-imports",
      category: "framework",
      projectCategories: ["web"],
      compatibleLanguages: ["node"],
      requirements: [
        { id: "node", label: "Node.js Runtime", type: "expected" },
        { id: "nuxt", label: "Nuxt", type: "provided" },
        { id: "vue", label: "Vue.js", type: "provided" },
      ],
      containerConfig: {
        image: "ghcr.io/civicognita/node:22",
        internalPort: 3000,
        shared: false,
        volumeMounts: (ctx) => [
          `${ctx.projectPath}:/app:Z`,
        ],
        env: (ctx) => ({
          PORT: "3000",
          NODE_ENV: ctx.mode,
          HOSTNAME: "0.0.0.0",
        }),
        command: (ctx) => {
          if (ctx.mode === "development") {
            return ["npm", "run", "dev"];
          }
          return ["sh", "-c", "npm run build && npm start"];
        },
      },
      installActions: [
        { id: "npm.install", label: "Install Dependencies", command: "npm install" },
      ],
      devCommands: {
        dev: "npx nuxi dev",
        build: "npx nuxi build",
        start: "npm start",
        preview: "npx nuxi preview",
      },
      guides: [
        { title: "Getting Started", content: "Run `npx nuxi dev` to start the development server.\n\nPages live in `pages/` with file-based routing." },
      ],
      tools: [
        { id: "npm-install", label: "npm install", description: "Install dependencies", action: "shell", command: "npm install" },
        { id: "nuxi-dev", label: "nuxi dev", description: "Start Nuxt dev server", action: "shell", command: "npx nuxi dev" },
        { id: "nuxi-build", label: "nuxi build", description: "Build for production", action: "shell", command: "npx nuxi build" },
        { id: "nuxi-preview", label: "nuxi preview", description: "Preview production build", action: "shell", command: "npx nuxi preview" },
        { id: "nuxi-generate", label: "nuxi generate", description: "Generate static site", action: "shell", command: "npx nuxi generate" },
      ],
      icon: "globe",
    });
  },
});
