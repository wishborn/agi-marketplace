import { createPlugin } from "@agi/sdk";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const assetsDir = resolve(__dirname, "../assets/reader");

export default createPlugin({
  async activate(api) {
    // Register the Reader MagicApp — provides container serving + dashboard panel
    api.registerMagicApp({
      id: "reader",
      name: "Reader",
      description: "E-reader for literature projects — book-style layout with markdown rendering",
      version: "1.0.0",
      icon: "book-open",
      category: "reader",
      projectTypes: ["writing"],
      projectCategories: ["literature"],
      containerConfig: {
        image: "nginx:alpine",
        internalPort: 80,
        volumeMounts: (ctx) => [
          `${ctx.projectPath}:/usr/share/nginx/html/content:ro,Z`,
          `${assetsDir}:/usr/share/nginx/html:ro,Z`,
        ],
        env: () => ({}),
      },
      panel: {
        label: "Reader",
        widgets: [
          {
            type: "status-display" as const,
            statusEndpoint: "/status?path={projectPath}",
            title: "Reader Status",
          },
          {
            type: "iframe" as const,
            src: "/reader-frame?path={projectPath}",
            title: "Reader Preview",
            height: "600px",
          },
        ],
      },
      agentPrompts: [
        {
          id: "reader.writing-assistant",
          label: "Writing Assistant",
          description: "AI assistance for writing and editing prose",
          systemPrompt:
            "This is a literature project. Help the user with writing, editing, and organizing their manuscripts. " +
            "The project contains text files (.md, .txt) that are served as a book via the Reader app.",
        },
      ],
      tools: [
        { id: "word-count", label: "Word Count", description: "Count words across all documents", action: "shell" as const, command: "find . -name '*.md' -o -name '*.txt' | xargs wc -w 2>/dev/null || echo '0 total'" },
      ],
    });

    // HTTP route: status endpoint for the reader panel
    api.registerHttpRoute("get", "/status", async (req) => {
      const path = (req.query as Record<string, string>).path ?? "";
      const config = api.getProjectConfig(path);
      const hosting = config?.hosting as Record<string, unknown> | undefined;
      return {
        status: 200,
        body: {
          status: hosting ? "active" : "not configured",
          hostname: hosting?.hostname ?? "unknown",
          type: hosting?.type ?? "writing",
          url: hosting?.hostname ? `https://${String(hosting.hostname)}.ai.on` : null,
        },
      };
    });

    // HTTP route: redirect iframe to the reader's *.ai.on URL
    api.registerHttpRoute("get", "/reader-frame", async (req, reply) => {
      const path = (req.query as Record<string, string>).path ?? "";
      const config = api.getProjectConfig(path);
      const hosting = config?.hosting as Record<string, unknown> | undefined;
      const hostname = hosting?.hostname as string | undefined;
      if (hostname) {
        return reply.redirect(`https://${hostname}.ai.on`);
      }
      return { status: 404, body: { error: "Project hosting not configured" } };
    });
  },
});
