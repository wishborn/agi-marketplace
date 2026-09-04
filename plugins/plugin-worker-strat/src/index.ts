import { createPlugin } from "@agi/sdk";
import { stratPlanner } from "./prompts/planner.js";
import { stratPrioritizer } from "./prompts/prioritizer.js";
import { strategist } from "./prompts/strategist.js";

export default createPlugin({
  async activate(api) {
    api.registerWorker(stratPlanner);
    api.registerWorker(stratPrioritizer);
    api.registerWorker(strategist);
  },
});
