import { createPlugin } from "@agi/sdk";
import { opsDeployer } from "./prompts/deployer.js";
import { opsCustodian } from "./prompts/custodian.js";
import { opsSyncer } from "./prompts/syncer.js";
import { reporter } from "./prompts/reporter.js";

export default createPlugin({
  async activate(api) {
    api.registerWorker(opsDeployer);
    api.registerWorker(opsCustodian);
    api.registerWorker(opsSyncer);
    api.registerWorker(reporter);
  },
});
