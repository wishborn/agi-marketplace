import { createPlugin } from "@agi/sdk";
import { codeEngineer } from "./prompts/engineer.js";
import { codeHacker } from "./prompts/hacker.js";
import { codeReviewer } from "./prompts/reviewer.js";
import { codeTester } from "./prompts/tester.js";

export default createPlugin({
  async activate(api) {
    api.registerWorker(codeEngineer);
    api.registerWorker(codeHacker);
    api.registerWorker(codeReviewer);
    api.registerWorker(codeTester);
  },
});
