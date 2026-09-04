import { createPlugin } from "@agi/sdk";
import { commWriterTech } from "./prompts/writer-tech.js";
import { commWriterPolicy } from "./prompts/writer-policy.js";
import { commEditor } from "./prompts/editor.js";

export default createPlugin({
  async activate(api) {
    api.registerWorker(commWriterTech);
    api.registerWorker(commWriterPolicy);
    api.registerWorker(commEditor);
  },
});
