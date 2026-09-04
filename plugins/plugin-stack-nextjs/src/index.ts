/**
 * Next.js Stack Plugin — Next.js + React + Tailwind CSS
 *
 * Registers the Next.js framework stack definition with container hosting support.
 */

import { createPlugin } from "@agi/sdk";

/**
 * Shell command that patches next.config to read ALLOWED_DEV_ORIGINS from env.
 * Finds the config file, checks if already patched, then inserts a line after
 * the first `{` to add allowedDevOrigins. Idempotent and no-op if no config found.
 */
const PATCH_DEV_ORIGINS = [
  `f=$(ls next.config.ts next.config.js next.config.mjs 2>/dev/null | head -1)`,
  `[ -n "$f" ]`,
  `! grep -q allowedDevOrigins "$f"`,
  `sed -i '0,/{/s/{/{\\n  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(","),/' "$f"`,
].join(" && ") + " || true";

export default createPlugin({
  async activate(api) {
    api.registerStack({
      id: "stack-nextjs",
      label: "Next.js",
      description:
        "React framework with server-side rendering, file-based routing, and Tailwind CSS. Used for marketing sites, dashboards, and full-stack web apps.",
      category: "framework",
      projectCategories: ["app", "web"],
      compatibleLanguages: ["node"],
      requirements: [
        { id: "node", label: "Node.js Runtime", type: "expected" },
        { id: "nextjs", label: "Next.js", type: "provided" },
        { id: "react", label: "React", type: "provided" },
        { id: "tailwind", label: "Tailwind CSS", type: "provided" },
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
        { id: "patch.dev-origins", label: "Configure tunnel dev origins", command: PATCH_DEV_ORIGINS, optional: true },
      ],
      devCommands: {
        dev: "npm run dev",
        build: "npm run build",
        start: "npm start",
        lint: "npm run lint",
      },
      guides: [
        {
          title: "Development",
          content: [
            "## Getting Started",
            "",
            "```bash",
            "npm install       # Install dependencies",
            "npm run dev       # Start dev server on :3000",
            "npm run build     # Production build",
            "npm start         # Start production server",
            "```",
            "",
            "## Key Directories",
            "",
            "- `app/` — App Router pages and layouts (Next.js 13+ convention)",
            "- `app/layout.tsx` — Root layout (HTML shell, providers)",
            "- `app/page.tsx` — Home page",
            "- `components/` — Shared React components",
            "- `public/` — Static assets",
            "- `next.config.ts` — Next.js configuration",
          ].join("\n"),
        },
        {
          title: "Agent Guide",
          content: [
            "## Working with Next.js Projects",
            "",
            "- Pages live in `app/` using file-based routing — `app/about/page.tsx` maps to `/about`",
            "- Server Components are the default; add `'use client'` directive for client interactivity",
            "- API routes go in `app/api/` as `route.ts` files",
            "- Tailwind classes are used directly in JSX — no separate CSS per component",
            "- Environment variables: prefix with `NEXT_PUBLIC_` for client-side access",
            "- Image optimization: use `next/image` instead of raw `<img>` tags",
            "- TypeScript strict mode is standard across all Aionima Next.js projects",
          ].join("\n"),
        },
      ],
      tools: [
        { id: "npm-install", label: "npm install", description: "Install dependencies", action: "shell", command: "npm install" },
        { id: "next-dev", label: "npm run dev", description: "Start Next.js dev server", action: "shell", command: "npm run dev" },
        { id: "next-build", label: "npm run build", description: "Production build", action: "shell", command: "npm run build" },
        { id: "next-start", label: "npm start", description: "Start production server", action: "shell", command: "npm start" },
      ],
      icon: "globe",
    });
  },
});
