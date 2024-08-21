const { state, readline } = require("./utils.js");
const { initDb, getAllPluginsFromDb } = require("./database");
const { createGPTInitialRequest } = require("./requestsCreation.js");
const logger = require('./logger'); // Correct path and file name

const {
  getUserRequest,
  getChatGptResponse,
  handleGPTResponse,
} = require("./userGPTInteraction.js");

// Main

async function main() {
  // Check for initialization
  try {
    if (!state.init_flag) {
      await initDb().then(() => {
        state.init_flag = true;
      });
    }
    state.pluginsJson = {};
    state.currentUserRequest = {};
    state.currentGPTResponse = {};
    state.currentProblemComment = {};
    state.currentPluginError = {};
    state.currentPluginJson = {};

    state.pluginsJson = await getAllPluginsFromDb();

    console.log(
      "Welcome! This software can help you with various tasks. Please enter your request in natural language."
    );
    state.currentUserRequest = await getUserRequest();

    let GPTinitialRequest = createGPTInitialRequest(
      state.currentUserRequest,
      state.pluginsJson
    ); //TODO: Check the JSON composition of the request data (missing parenthesis and * or symbols).
    //console.log("Initial GPT request:\n" + GPTinitialRequest);

    // TODO: Retrieve all the plugin code + information (in JSON format) that has to be sent to ChatGPT to be analyzed for the awareness feature.

    // TODO: Compose the request for ChatGPT, including the user request and the plugins information specifying that it
    // has to answer back in the "yes+plugin_id+parameters/no+new_plugin_code+parameters/not_possibile" format (the plugin has to be standalone,
    // and also the parameters has to be extracted from the user's request).

    // Send the precompiled request to ChatGPT
    let gptResponse = await getChatGptResponse(GPTinitialRequest);
    logger.debug("GPT response:\n" + gptResponse);

    // TODO: Analyze the response from ChatGPT. If the answer is positive, execute the plugin (using the extracted parameters provided by the
    // oracle). If the answer is negative, install the new plugin, classify it, and then execute this using the extracted parameters. If the
    // answer is "not possible", notify the user and start over.

    await handleGPTResponse(gptResponse);

    // TODO: Plugin execution. Then display the result to the user.

    // TODO: Ask the user for a feedback and send it to the oracle specifying that the answer must be "negative/positive+update_classification".
    // If the answer is positive update the classification, then start over. If the answer is negative uninstall the plugin, and request to the
    // user an explanation of the problem.

    // TODO: Send to the oracle a pre formatted request including the problem explanation from the user asking to generate again the plugin.

    // The answer format must be "positive+new_plugin_code+parameters/not_possible". If the answer is positive, the new plugin is installed,
    // executed and evaluated by the user. This actions has to be performed until the user feedback is classified as positive or the user sends
    // a "giveup keyword" that makes the program exiting the loop and start over. If the answer is "not_possible" the program starts over.

    /// Insert here the call to analyze

    await main(); // Restart the loop after processing the request
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    readline.close();
  }
}

// Start the main loop
main();
