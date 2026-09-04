import { createPlugin } from "@agi/sdk";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const assetsDir = resolve(__dirname, "../assets/gallery");

export default createPlugin({
  async activate(api) {
    // Register the Gallery MagicApp — provides container serving + dashboard panel
    api.registerMagicApp({
      id: "gallery",
      name: "Gallery",
      description: "Media gallery for art projects — responsive grid with lightbox viewer",
      version: "1.0.0",
      icon: "image",
      category: "gallery",
      projectTypes: ["art"],
      projectCategories: ["media"],
      containerConfig: {
        image: "nginx:alpine",
        internalPort: 80,
        volumeMounts: (ctx) => [
          `${ctx.projectPath}:/usr/share/nginx/html/media:ro,Z`,
          `${assetsDir}:/usr/share/nginx/html:ro,Z`,
        ],
        env: () => ({}),
      },
      panel: {
        label: "Gallery",
        widgets: [
          {
            type: "status-display" as const,
            statusEndpoint: "/status?path={projectPath}",
            title: "Gallery Status",
          },
          {
            type: "iframe" as const,
            src: "/gallery-frame?path={projectPath}",
            title: "Gallery Preview",
            height: "600px",
          },
        ],
      },
      agentPrompts: [
        {
          id: "gallery.art-assistant",
          label: "Art Assistant",
          description: "AI assistance for organizing and managing media assets",
          systemPrompt:
            "This is a media/art project. Help the user organize their images and videos. " +
            "The project contains media files served via the Gallery app.",
        },
      ],
      tools: [
        { id: "asset-count", label: "Asset Count", description: "Count media files", action: "shell" as const, command: "find . -type f \\( -name '*.jpg' -o -name '*.png' -o -name '*.gif' -o -name '*.mp4' -o -name '*.webm' \\) | wc -l" },
      ],
    });

    // HTTP route: status endpoint for the gallery panel
    api.registerHttpRoute("get", "/status", async (req) => {
      const path = (req.query as Record<string, string>).path ?? "";
      const config = api.getProjectConfig(path);
      const hosting = config?.hosting as Record<string, unknown> | undefined;
      return {
        status: 200,
        body: {
          status: hosting ? "active" : "not configured",
          hostname: hosting?.hostname ?? "unknown",
          type: hosting?.type ?? "art",
          url: hosting?.hostname ? `https://${String(hosting.hostname)}.ai.on` : null,
        },
      };
    });

    // HTTP route: redirect iframe to the gallery's *.ai.on URL
    api.registerHttpRoute("get", "/gallery-frame", async (req, reply) => {
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
