import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerProjectType({
      id: "web-app",
      label: "Web App",
      hostable: true,
      defaultMeta: {
        type: "web-app",
        mode: "development",
        internalPort: null,
      },
      tools: [],
    });
  },
});
