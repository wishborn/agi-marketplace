import { createPlugin } from "@agi/sdk";

export default createPlugin({
  async activate(api) {
    api.registerProjectType({
      id: "ops",
      label: "Ops",
      hostable: false,
      defaultMeta: {
        type: "ops",
        mode: "production",
        internalPort: null,
      },
      tools: [],
    });
  },
});
