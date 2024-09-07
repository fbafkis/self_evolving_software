const {
  saveNewPluginToDb,
  saveUserRequestForExistingPlugin,
  getPluginById,
  saveChatMessage,
  getChatHistory,
  updatePluginCode,
} = require("./database");
const {
  createGPTNegativeFeedbackNewPluginRequest,
  createGPTNegativeFeedbackExistingPluginRequest,
  createGPTMalfunctioningPluginRequest,
} = require("./requestsCreation");
const axios = require("axios");
const {
  installDependencies,
  cleanupUnusedDependencies,
} = require("./dependencies");
const { executePlugin } = require("./pluginExecution");
const { state, readline, sanitizeInput } = require("./utils");
const logger = require("./logger");
const { log } = require("winston");

// ChatGPT connection parameters
const apiKey = "213438401d774c4b99831f52b12ebd3c"; // API key for ChatGPT
const apiBase = "https://rt-bdi-gpt4.openai.azure.com/"; // The endpoint
const apiVersion = "2023-05-15"; // API version
const deploymentName = "izzo-bozzo-gpt4"; // Deployment name

// Function to get the initial user request
async function getUserRequest() {
  return new Promise((resolve, reject) => {
    readline.question("Enter your request: ", (userInput) => {
      if (!userInput) {
        reject(new Error("Please provide a user request."));
        return;
      }
      // Input sanitizatoin and trimming
      const sanitizedInput = sanitizeInput(userInput.trim());
      resolve(sanitizedInput);
    });
  });
}

// Function to ask the user about user satisfaction for the plugin execution
function askUserPluginFeedback() {
  return new Promise((resolve) => {
    readline.question(
      "Are you satisfied with the response? (yes/no): ",
      (answer) => {
        // Normalize the input to lower case and trim any extra whitespace
        const normalizedAnswer = answer.trim().toLowerCase();
        if (normalizedAnswer === "yes" || normalizedAnswer === "no") {
          resolve(normalizedAnswer);
        } else {
          logger.info("Invalid input. Please answer with 'yes' or 'no'.");
          resolve(askUserPluginFeedback()); // Recursively ask for the feedback until a valid answer is provided
        }
      }
    );
  });
}

// Function to ask the use a comment about a negative feedback provided
function askUserForNegativeFeedback() {
  return new Promise((resolve) => {
    readline.question(
      "Please, explain what was the problem with the result you got: ",
      (comment) => {
        // Input sanitization and trimmming
        const sanitizedComment = sanitizeInput(comment.trim());
        resolve(sanitizedComment);
      }
    );
  });
}

// Fucntion to handle the feedback provided by the user for a new plugin
async function handleUserNewPluginFeedback(feedback) {
  // Positive feedback
  if (feedback === "yes") {
    logger.info("Great! We're glad you're satisfied with the response.");
    logger.debug(
      "HandleUserNewPluginFeedback - New plugin json:\n" +
        state.currentPluginJson
    );
    // Saving the new plugin to the DB along with the associated request
    await saveNewPluginToDb(state.currentPluginJson, state.currentUserRequest);
    // Negative feedback
  } else if (feedback === "no") {
    logger.info("Sorry to hear that. We'll try to improve.");
    // Ask the user a comment about the problem
    state.currentProblemComment = await askUserForNegativeFeedback();
    logger.debug(
      "HandleUserNewPluginFeedback - User prompt details about the problem:\n" +
        state.currentProblemComment
    );
    //Get the chat history
    chatHistory = await getChatHistory();
    // Create message for ChatGPT about the negative feedback
    var GPTNegativeFeedbackNewPluginRequest =
      createGPTNegativeFeedbackNewPluginRequest(
        state.currentUserRequest,
        state.currentProblemComment,
        state.currentGPTResponse,
        state.currentPluginError,
        chatHistory
      );
    logger.info("Waiting for ChatGPT to answer ...");
    // Sending the request to ChatGPT
    var newGPTResponse = await getChatGptResponse(
      GPTNegativeFeedbackNewPluginRequest
    );
    // Update chat History
    await saveChatMessage("application", GPTNegativeFeedbackNewPluginRequest);
    await saveChatMessage("GPT", newGPTResponse);
    logger.debug("Chat history updated.");
    // Handle the new response from ChatGPT
    logger.debug("HandleUserNewPluginFeedback - New GPT response:\n");
    logger.debug(GPTNegativeFeedbackNewPluginRequest);
    await handleGPTResponse(newGPTResponse);
    // Ask again the user for the feedback
    const userNewPluginFeedback = await askUserPluginFeedback();
    // Handle the user feedback again, and so on until it is positive
    await handleUserNewPluginFeedback(userNewPluginFeedback);
  }
}

// Function to handle the feedback provided by the user for an existing plugin
async function handleUserExistingPluginFeedback(feedback) {
  // Positive feedback
  if (feedback === "yes") {
    logger.info(
      "Great! We're glad you're satisfied with the response. Saving the new request into the database."
    );
    // Saving the new request successfully satisfied by the existing plugin choosed by ChatGPT
    await saveUserRequestForExistingPlugin(
      state.currentPluginJson.id,
      state.currentUserRequest
    );
    // Negative feedback
  } else if (feedback === "no") {
    logger.info("Sorry to hear that. We'll try to improve.");
    // Ask the user to explain the problem
    state.currentProblemComment = await askUserForNegativeFeedback();
    logger.debug(
      "HandleUserExistingPluginFeedback - User prompt details about the problem:\n" +
        state.currentProblemComment
    );
    //Get the chat history
    chatHistory = await getChatHistory();
    // Creating the appropriate request for ChatGPT about the negative feedback for the existing plugin execution
    var GPTNegativeFeedbackExistingPluginRequest =
      createGPTNegativeFeedbackExistingPluginRequest(
        state.currentUserRequest,
        state.currentProblemComment,
        state.currentGPTResponse,
        state.currentPluginError,
        state.pluginsJson
      );
    logger.info("Waiting for ChatGPT to answer ...");
    // Getting the new response from ChatGPT
    var newGPTResponse = await getChatGptResponse(
      GPTNegativeFeedbackExistingPluginRequest
    );
    // Update chat History
    await saveChatMessage(
      "application",
      GPTNegativeFeedbackExistingPluginRequest
    );
    await saveChatMessage("GPT", newGPTResponse);
    logger.debug("Chat history updated.");
    // Handling the new reposnse
    logger.debug("HandleUserExistingPluginFeedback - New GPT response:");
    logger.debug(GPTNegativeFeedbackExistingPluginRequest);
    await handleGPTResponse(newGPTResponse);
    // Ask again the user for the feedback
    const userExistingPluginFeedback = await askUserPluginFeedback();
    // Handle the user feedback again, and so on until a positive feedback
    await handleUserExistingPluginFeedback(userExistingPluginFeedback);
  }
}

// Function to get the ChatGPT response
async function getChatGptResponse(request) {
  try {
    // Making the http request
    const response = await axios.post(
      `${apiBase}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`,
      {
        messages: [{ role: "user", content: request }],
        max_tokens: 1024,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );
    // Getting the response
    state.currentGPTResponse = response.data.choices[0].message.content;
    return response.data.choices[0].message.content;
  } catch (error) {
    // If the rate limit is exceeded and it has to wait
    if (error.response && error.response.status === 429) {
      logger.error(
        "GetChatGPTResponse - Rate limit exceeded. Waiting for a while before retrying..."
      );
      // Wait 60 seconds
      await new Promise((resolve) => setTimeout(resolve, 60000));
      logger.info("Waiting for ChatGPT to answer ...");
      // Try again
      return await getChatGptResponse(request);
    } else {
      throw error;
    }
  }
}

// Function to handle the ChatGPT response
// async function handleGPTResponse(gptResponse) {
//   try {
//     const responseObject = JSON.parse(gptResponse);
//     // Updating global variables
//     state.currentPluginJson = {
//       code: responseObject.newPluginCode,
//       dependencies: responseObject.newPluginDependencies,
//       description: responseObject.pluginDescription,
//     };
//     // No suitable plugin found: producing and executing a new one
//     if (
//       responseObject.response === "no" &&
//       responseObject.newPluginCode !== "null"
//     ) {
//       logger.info("Executing new plugin...");
//       const newPluginCode = responseObject.newPluginCode;
//       const pluginArguments = responseObject.pluginArguments;
//       const dependencies = responseObject.newPluginDependencies;
//       // Dynamically install the dependencies provided by the GPT response
//       installDependencies(dependencies);
//       // Executing the plugin
//       try {
//         logger.debug("Started execution of new plugin.");
//         state.currentPluginError = "";
//         // Execute the new plugin with the provided arguments
//         const result = await executePlugin(newPluginCode, pluginArguments);
//         // Printing the result for the user
//         logger.info("Plugin execution result: " + result);
//         // Ask the user for the feedback
//         const userNewPluginFeedback = await askUserPluginFeedback();
//         // Handle the user feedback
//         await handleUserNewPluginFeedback(userNewPluginFeedback);
//       } catch (error) {
//         logger.error(
//           "HandleGPTResponse - Error during plugin execution:\n" + error.message
//         );
//         responseObject.newPluginCode = await handleMalfunctioningNewPlugin(
//           error.message,
//           state.currentUserRequest,
//           pluginArguments,
//           responseObject
//         );
//         logger.debug("Recursive call...");
//         // Call recursively the function
//         handleGPTResponse(JSON.stringify(responseObject));
//         // If an error is thrown, remove the related dependencies, they will be kept only in case of success
//         await cleanupUnusedDependencies(dependencies);
//       }
//       // Suitable existing plugin found
//     } else if (
//       responseObject.response === "yes" &&
//       responseObject.pluginId !== "null"
//     ) {
//       logger.debug(
//         "HandleGPTResponse - Executing existing plugin with ID " +
//           responseObject.pluginId
//       );
//       // Executing the existing plugin found suitable by ChatGPT
//       try {
//         // Retrieve the existing plugin from the database
//         const pluginDetails = await getPluginById(responseObject.pluginId);
//         state.currentPluginJson = pluginDetails;
//         const pluginArguments = responseObject.pluginArguments;
//         logger.debug(
//           "HandleGPTResponse - Current plugin JSON:\n" + state.currentPluginJson
//         );
//         // Install dependencies (commented out because it shouldn't be needed and they should be already installed)
//         //installDependencies(pluginDetails.dependencies.join(","));
//         state.currentPluginError = "";
//         // Execute the plugin with the arguments provided by ChatGPT
//         const result = await executePlugin(pluginDetails.code, pluginArguments);
//         // Printing the result of the plugin execution for the user
//         logger.info("Plugin execution result: " + result);
//         // Ask the user for the feedback
//         const userExistingPluginFeedback = await askUserPluginFeedback();
//         // Handle the user feedback
//         await handleUserExistingPluginFeedback(userExistingPluginFeedback);
//       } catch (error) {
//         console.error("Error during plugin execution:", error.message);
//         logger.debug("HandleGPTResponse - New plugin error intercepted.");
//         await handleMalfunctioningExisistingPlugin(
//           error.message,
//           pluginDetails,
//           state.currentUserRequest,
//           pluginArguments
//         );
//         // Recall recursively the function.
//         handleGPTResponse(gptResponse);
//       }
//       // If eventually no new or existing plugin is provided
//     } else {
//       logger.error("HandleGPTResponse - No valid plugin to execute.");
//     }
//   } catch (err) {
//     logger.error(
//       "HandleGPTResponse - Error handling GPT response: " + err.message
//     );
//   }
// }
async function handleGPTResponse(gptResponse) {
  try {
    const responseObject = JSON.parse(gptResponse);
    
    state.currentPluginJson = {
      code: responseObject.newPluginCode,
      dependencies: responseObject.newPluginDependencies,
      description: responseObject.pluginDescription,
    };
    
    if (responseObject.response === "no" && responseObject.newPluginCode !== "null") {
      logger.info("Executing new plugin...");
      const newPluginCode = responseObject.newPluginCode;
      const pluginArguments = responseObject.pluginArguments;
      const dependencies = responseObject.newPluginDependencies;
      
      // Dynamically install the dependencies provided by the GPT response
      installDependencies(dependencies);
      
      try {
        logger.debug("Started execution of new plugin.");
        state.currentPluginError = "";
        
        const result = await executePlugin(newPluginCode, pluginArguments);
        logger.info("Plugin execution result: " + result);
        
        const userNewPluginFeedback = await askUserPluginFeedback();
        await handleUserNewPluginFeedback(userNewPluginFeedback);
        
      } catch (error) {
        logger.error(
          "HandleGPTResponse - Error during plugin execution:\n" + error.message
        );
        
        responseObject.newPluginCode = await handleMalfunctioningNewPlugin(
          error.message,
          state.currentUserRequest,
          pluginArguments,
          responseObject
        );
        
        logger.debug("Recursive call...");
        await handleGPTResponse(JSON.stringify(responseObject));
        
        // Handle cleanup of unused dependencies
        await cleanupUnusedDependencies(dependencies);
      }
    } else if (responseObject.response === "yes" && responseObject.pluginId !== "null") {
      logger.debug(
        "HandleGPTResponse - Executing existing plugin with ID " +
        responseObject.pluginId
      );
      
      try {
        const pluginDetails = await getPluginById(responseObject.pluginId);
        state.currentPluginJson = pluginDetails;
        const pluginArguments = responseObject.pluginArguments;
        logger.debug("HandleGPTResponse - Current plugin JSON:\n" + state.currentPluginJson);
        
        state.currentPluginError = "";
        const result = await executePlugin(pluginDetails.code, pluginArguments);
        logger.info("Plugin execution result: " + result);
        
        const userExistingPluginFeedback = await askUserPluginFeedback();
        await handleUserExistingPluginFeedback(userExistingPluginFeedback);
        
      } catch (error) {
        logger.error("HandleGPTResponse - Error executing existing plugin: " + error.message);
        
        await handleMalfunctioningExisistingPlugin(
          error.message,
          pluginDetails,
          state.currentUserRequest,
          pluginArguments
        );
        
        // Recursively call again to handle updated plugin after malfunction
        await handleGPTResponse(gptResponse);
      }
    } else {
      logger.error("HandleGPTResponse - No valid plugin to execute.");
    }
  } catch (err) {
    logger.error("HandleGPTResponse - Error handling GPT response: " + err.message);
  }
}


async function handleMalfunctioningNewPlugin(
  pluginErrorMessage,
  userRequest,
  pluginArguments,
  responseObject
) {
  try {
    logger.info(
      "A malfunction into the just created plugin has been detecting. Trying to solve the problem..."
    );
    //Get the chat history
    logger.debug("Getting chat history...");
    let chatHistory = await getChatHistory();
    let malfunctioningNewPluginGPTRequest =
      createGPTMalfunctioningPluginRequest(
        responseObject.newPluginCode,
        userRequest,
        pluginErrorMessage,
        pluginArguments,
        chatHistory
      );

    logger.debug("Asking to GPT for the updated plugin code...");
    // Making the request to GPT to get the new code
    const updatedPluginCode = await getChatGptResponse(
      malfunctioningNewPluginGPTRequest
    );
    // Updating chat history
    await saveChatMessage("application", malfunctioningNewPluginGPTRequest);
    await saveChatMessage("GPT", updatedPluginCode);
    // Debug printing the new code:
    logger.debug("New plugin code: \n" + updatedPluginCode);
    return updatedPluginCode;
  } catch (err) {
    logger.error(
      "HandleMalfunctioningNewPlugin - Error getting GPT response: " +
        err.message
    );
  }
}

async function handleMalfunctioningExisistingPlugin(
  pluginErrorMessage,
  pluginDetails,
  userRequest,
  pluginArguments
) {
  logger.info(
    "A malfunction into the existing plugin with id " +
      pluginDetails.id +
      " has been detecting. Trying to solve the problem..."
  );
  //Get the chat history
  let chatHistory = await getChatHistory();
  let malfunctioningExisistingPluginGPTRequest =
    createGPTMalfunctioningPluginRequest(
      pluginDetails.code,
      userRequest,
      pluginErrorMessage,
      pluginArguments,
      chatHistory
    );
  try {
    // Making the request to GPT to get the new code
    const updatedPluginCode = await getChatGptResponse(
      malfunctioningExisistingPluginGPTRequest
    );
    // Debug printing the new code:
    logger.debug("New plugin code: \n" + updatedPluginCode);
    // Saving updated plugin code to database
    await updatePluginCode(pluginDetails.id, updatedPluginCode);
  } catch (err) {
    logger.error(
      "HandleMalfunctioningExistingPlugin - Error getting GPT response: " +
        err.message
    );
  }
}

module.exports = {
  getUserRequest,
  askUserPluginFeedback,
  askUserForNegativeFeedback,
  handleUserExistingPluginFeedback,
  handleUserNewPluginFeedback,
  getChatGptResponse,
  handleGPTResponse,
};
