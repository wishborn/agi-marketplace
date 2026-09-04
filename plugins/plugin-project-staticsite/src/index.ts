import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerProjectType({
      id: "static-site",
      label: "Static Site",
      hostable: true,
      defaultMeta: {
        type: "static-site",
        docRoot: "dist",
        mode: "production",
        internalPort: null,
      },
      tools: [],
    });
  },
});
