import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerProjectType({
      id: "api-service",
      label: "API Service",
      hostable: true,
      defaultMeta: {
        type: "api-service",
        mode: "development",
        internalPort: null,
      },
      tools: [],
    });
  },
});
