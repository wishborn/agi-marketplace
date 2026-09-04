import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-tailwind",
      label: "Tailwind CSS",
      description: "Utility-first CSS framework — composable classes, JIT compilation, responsive design. Works with any frontend framework via Vite or PostCSS.",
      category: "tooling",
      projectCategories: ["app", "web"],
      requirements: [
        { id: "tailwind", label: "Tailwind CSS", type: "provided" },
      ],
      installActions: [
        { id: "npm.install.tailwind", label: "Install Tailwind CSS", command: "npm install -D tailwindcss" },
        { id: "npm.install.vite-plugin", label: "Install Vite Plugin", command: "npm install -D @tailwindcss/vite", optional: true },
      ],
      devCommands: {
        build: "npx @tailwindcss/cli -o dist/styles.css --minify",
      },
      guides: [
        {
          title: "Setup",
          content: [
            "## Tailwind CSS",
            "",
            "**With Vite (recommended):**",
            "",
            "```bash",
            "npm install -D tailwindcss @tailwindcss/vite",
            "```",
            "",
            "Add to your `vite.config.ts`:",
            "",
            "```typescript",
            "import tailwindcss from '@tailwindcss/vite';",
            "",
            "export default defineConfig({",
            "  plugins: [tailwindcss()],",
            "});",
            "```",
            "",
            "Import in your CSS entry point:",
            "",
            "```css",
            "@import 'tailwindcss';",
            "```",
            "",
            "**With PostCSS:**",
            "",
            "```bash",
            "npm install -D tailwindcss @tailwindcss/postcss postcss",
            "```",
            "",
            "Add to `postcss.config.js`:",
            "",
            "```javascript",
            "export default { plugins: { '@tailwindcss/postcss': {} } };",
            "```",
          ].join("\n"),
        },
      ],
      tools: [
        { id: "tw-build", label: "Build CSS", description: "Compile Tailwind to output CSS", action: "shell", command: "npx @tailwindcss/cli -o dist/styles.css --minify" },
      ],
      icon: "palette",
    });
  },
});
