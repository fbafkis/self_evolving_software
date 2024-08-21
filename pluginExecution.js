const vm = require("vm"); // To create and run the script in a sandboxed environment
const process = require("process"); // Required to simulate a process environment within the sandbox
const {logger} = require("./logger");
const { state } = require("./utils");

// Plugin execution
async function executePlugin(pluginCode, pluginArguments) {
  try {
    // Create a sandbox for the plugin code execution
    const sandbox = { require, console, process, module: {}, exports: {} };

    // Create the script and context for the plugin
    const script = new vm.Script(pluginCode);
    const context = new vm.createContext(sandbox);
    script.runInContext(context);

    const args = pluginArguments
      .split(",")
      .map((arg) => arg.trim().replace(/^['"]|['"]$/g, "")); // Parse and trim arguments

    // Execute the function exported by the plugin code
    if (typeof sandbox.module.exports === "function") {
      return await sandbox.module.exports(args);
    } else {
      throw new Error("No valid function exported from the plugin code.");
    }
  } catch (err) {
    state.currentPluginError = err.message;
    console.error("Error executing plugin:", err.message);
    return null;
  }
}

module.exports = {
  executePlugin,
};
