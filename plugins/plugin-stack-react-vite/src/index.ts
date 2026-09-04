import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-react-vite",
      label: "React (Vite)",
      description: "React SPA built with Vite, served via nginx in production",
      category: "framework",
      projectCategories: ["web"],
      compatibleLanguages: ["node"],
      requirements: [
        { id: "node", label: "Node.js Runtime", type: "expected" },
        { id: "react", label: "React", type: "provided" },
        { id: "vite", label: "Vite", type: "provided" },
      ],
      containerConfig: {
        image: "nginx:alpine",
        internalPort: 80,
        shared: false,
        volumeMounts: (ctx) => [
          `${ctx.projectPath}/dist:/usr/share/nginx/html:ro,Z`,
        ],
        env: () => ({}),
      },
      installActions: [
        { id: "npm.install", label: "Install Dependencies", command: "npm install" },
      ],
      devCommands: {
        dev: "npm run dev",
        build: "npm run build",
      },
      guides: [
        { title: "Getting Started", content: "Run `npm run dev` to start the Vite dev server.\n\nBuild with `npm run build` — output goes to `dist/`." },
      ],
      tools: [
        { id: "npm-install", label: "npm install", description: "Install dependencies", action: "shell", command: "npm install" },
        { id: "npm-dev", label: "npm run dev", description: "Start Vite dev server", action: "shell", command: "npm run dev" },
        { id: "npm-build", label: "npm run build", description: "Build for production", action: "shell", command: "npm run build" },
        { id: "npm-preview", label: "npm run preview", description: "Preview production build", action: "shell", command: "npm run preview" },
      ],
      icon: "globe",
    });
  },
});
