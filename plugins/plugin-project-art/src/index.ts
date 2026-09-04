import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerProjectType({
      id: "art",
      label: "Art Project",
      hostable: true,
      defaultMeta: {
        type: "art",
        mode: "production",
        internalPort: null,
      },
      tools: [
        { id: "asset-gallery", label: "Asset Gallery", description: "Browse project assets", action: "ui" },
        { id: "export", label: "Export", description: "Export assets for production", action: "ui" },
      ],
    });
  },
});
