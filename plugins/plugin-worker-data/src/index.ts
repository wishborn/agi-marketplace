import { createPlugin } from "@agi/sdk";
import { dataModeler } from "./prompts/modeler.js";
import { dataMigrator } from "./prompts/migrator.js";

export default createPlugin({
  async activate(api) {
    api.registerWorker(dataModeler);
    api.registerWorker(dataMigrator);
  },
});
