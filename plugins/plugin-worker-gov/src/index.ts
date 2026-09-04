import { createPlugin } from "@agi/sdk";
import { govAuditor } from "./prompts/auditor.js";
import { govArchivist } from "./prompts/archivist.js";

export default createPlugin({
  async activate(api) {
    api.registerWorker(govAuditor);
    api.registerWorker(govArchivist);
  },
});
