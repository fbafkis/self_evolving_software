const { state, readline } = require("./utils.js");
const { initDb, getAllPluginsFromDb } = require("./database");
const { createGPTInitialRequest } = require("./requestsCreation.js");
const logger = require("./logger"); 
const {
  getUserRequest,
  getChatGptResponse,
  handleGPTResponse,
} = require("./userGPTInteraction.js");

// The main function (the loop)
async function main() {
  // Check for initialization condition
  try {
    if (!state.init_flag) {
      await initDb().then(() => {
        state.init_flag = true;
      });
    }
    // Initialize the global variables
    state.pluginsJson = {};
    state.currentUserRequest = {};
    state.currentGPTResponse = {};
    state.currentProblemComment = {};
    state.currentPluginError = {};
    state.currentPluginJson = {};
    // Get all the plgins present into the database
    state.pluginsJson = await getAllPluginsFromDb();
    // Initial message
    console.log(
      "Welcome! This software can help you with various tasks. Please enter your request in natural language."
    );
    // Get the user initial request
    state.currentUserRequest = await getUserRequest();
    // Compose the appropriate request for ChatGPT
    let GPTinitialRequest = createGPTInitialRequest(
      state.currentUserRequest,
      state.pluginsJson
    );
    logger.info("Waiting for ChatGPT to answer ...");
    // Send the composed request to ChatGPT
    let gptResponse = await getChatGptResponse(GPTinitialRequest);
    logger.debug("GPT response:\n" + gptResponse);
    // Handle the ChatGPT response
    await handleGPTResponse(gptResponse);
    // Restart recursively the loop after processing the request
    await main();
  } catch (error) {
    logger.error("Main loop: error:\n" + error.message);
  } finally {
    readline.close();
  }
}

// Start the main loop at the beginning of execution
main();
