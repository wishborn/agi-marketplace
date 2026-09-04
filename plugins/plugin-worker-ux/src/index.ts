import { createPlugin } from "@agi/sdk";
import { uxDesignerWeb } from "./prompts/designer-web.js";
import { uxDesignerCli } from "./prompts/designer-cli.js";

export default createPlugin({
  async activate(api) {
    api.registerWorker(uxDesignerWeb);
    api.registerWorker(uxDesignerCli);
  },
});
