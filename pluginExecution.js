const vm = require("vm");
const process = require("process");
const logger = require("./logger"); 
const { state } = require("./utils");

// Function to execute the plugin
async function executePlugin(pluginCode, pluginArguments) {
  try {
    // Creating the sandbox for the plugin code execution
    const sandbox = { require, console, process, module: {}, exports: {} };
    // Creating the script and the context for the plugin
    const script = new vm.Script(pluginCode);
    const context = new vm.createContext(sandbox);
    script.runInContext(context);
    // Retrieve the arguments after parsing and trimming
    const args = pluginArguments
      .split(",")
      .map((arg) => arg.trim().replace(/^['"]|['"]$/g, "")); 
    // Execute the function exported by the plugin code
    if (typeof sandbox.module.exports === "function") {
      return await sandbox.module.exports(args);
    } else {
      throw new Error(
        "PluginExecution - No valid function exported from the plugin code."
      );
    }
  } catch (err) {
    state.currentPluginError = err.message;
    logger.error("PluginExecution - Error executing plugin:\n" + err.message);
    // Return no result to display to the user
    return null;
  }
}

module.exports = {
  executePlugin,
};

