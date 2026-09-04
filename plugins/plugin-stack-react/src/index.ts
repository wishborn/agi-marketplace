import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-react",
      label: "React",
      description: "React package within a monorepo — component library or standalone app with its own dev server",
      category: "framework",
      projectCategories: ["app", "web"],
      compatibleLanguages: ["node"],
      requirements: [
        { id: "node-runtime", label: "Node.js Runtime", type: "expected" },
        { id: "react", label: "React", type: "provided" },
      ],
      devCommands: {
        dev: "npm run dev",
        build: "npm run build",
        test: "npm test",
        lint: "npm run lint",
      },
      tools: [
        { id: "npm-install", label: "npm install", description: "Install dependencies", action: "shell", command: "npm install" },
        { id: "npm-dev", label: "npm run dev", description: "Start dev server", action: "shell", command: "npm run dev" },
        { id: "npm-build", label: "npm run build", description: "Build for production", action: "shell", command: "npm run build" },
      ],
      icon: "component",
      guides: [
        { title: "Getting Started", content: "Run `npm install` then `npm run dev` to start the development server.\n\nFor monorepos, this stack provides tools and dev commands but does not create its own container — it shares the parent project's hosting." },
      ],
    });
  },
});
