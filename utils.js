function sanitizeInput(input) {
  return input
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/`/g, "\\`"); // Escape backticks (if needed)
}

// readline.js
let readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

const state = {
  init_flag: false,
  pluginsJson: {},
  currentUserRequest: {},
  currentGPTResponse: {},
  currentProblemComment: {},
  currentPluginError: {},
  currentPluginJson: {},
};

module.exports = {
  state,
  readline,
  sanitizeInput,
};
