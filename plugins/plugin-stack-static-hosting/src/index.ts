import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-static-hosting",
      label: "Static Hosting",
      description: "Nginx-based static file hosting for built websites",
      category: "workflow",
      projectCategories: ["web"],
      requirements: [],
      containerConfig: {
        image: "nginx:alpine",
        internalPort: 80,
        shared: false,
        volumeMounts: (ctx) => [
          `${ctx.projectPath}/dist:/usr/share/nginx/html:ro,Z`,
        ],
        env: () => ({}),
      },
      installActions: [],
      devCommands: {},
      guides: [
        { title: "Static Hosting", content: "Build your site, then the `dist/` directory is served by nginx.\n\nAdjust the volume mount path if your output dir differs." },
      ],
      tools: [
        { id: "build", label: "Build", description: "Build static site", action: "shell", command: "npm run build" },
        { id: "preview", label: "Preview", description: "Preview locally", action: "shell", command: "npx serve dist" },
      ],
      icon: "globe",
    });
  },
});
