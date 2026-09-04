import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-node-app",
      label: "Node.js App",
      description: "Generic Node.js application hosting with npm start",
      category: "framework",
      projectCategories: ["app", "web"],
      compatibleLanguages: ["node"],
      requirements: [
        { id: "node", label: "Node.js Runtime", type: "expected" },
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
        }),
        command: (ctx) => {
          if (ctx.mode === "development") {
            return ["npm", "run", "dev"];
          }
          return ["npm", "start"];
        },
      },
      installActions: [
        { id: "npm.install", label: "Install Dependencies", command: "npm install" },
      ],
      devCommands: {
        dev: "npm run dev",
        build: "npm run build",
        test: "npm test",
        start: "npm start",
      },
      guides: [
        { title: "Getting Started", content: "Run `npm run dev` to start the development server, or `npm start` for production." },
      ],
      tools: [
        { id: "npm-install", label: "npm install", description: "Install dependencies", action: "shell", command: "npm install" },
        { id: "npm-dev", label: "npm run dev", description: "Start dev server", action: "shell", command: "npm run dev" },
        { id: "npm-build", label: "npm run build", description: "Build for production", action: "shell", command: "npm run build" },
        { id: "npm-test", label: "npm test", description: "Run tests", action: "shell", command: "npm test" },
      ],
      icon: "box",
    });
  },
});
