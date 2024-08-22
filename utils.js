// Function to sanitize quotes, apexes, etc. from user input
function sanitizeInput(input) {
  return input
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/`/g, "\\`"); // Escape backticks
}

// Shareed readline instance to get the user prompt 
let readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Global const that wraps all the global variables
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
