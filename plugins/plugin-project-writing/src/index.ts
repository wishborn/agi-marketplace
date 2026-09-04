import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerProjectType({
      id: "writing",
      label: "Writing Project",
      hostable: true,
      defaultMeta: {
        type: "writing",
        mode: "production",
        internalPort: null,
      },
      tools: [
        { id: "word-count", label: "Word Count", description: "Count words across all documents", action: "shell", command: "find . -name '*.md' -o -name '*.txt' | xargs wc -w" },
        { id: "export", label: "Export", description: "Export project for publishing", action: "ui" },
        { id: "outline", label: "Outline", description: "View document outline", action: "ui" },
      ],
    });
  },
});
