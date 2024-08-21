const {
  saveNewPluginToDb,
  saveUserRequestForExistingPlugin,
  getPluginById,
} = require("./database"); // For saving plugin information to the database

const {
  createGPTNegativeFeedbackNewPluginRequest,
  createGPTNegativeFeedbackExistingPluginRequest,
} = require("./requestsCreation"); // For creating requests to send to GPT based on user feedback

const axios = require("axios"); // For making HTTP requests in getChatGptResponse
const {
  installDependencies,
  cleanupUnusedDependencies,
} = require("./dependencies"); // For managing dependencies in handleGPTResponse
const { executePlugin } = require("./pluginExecution"); // For executing the plugin in handleGPTResponse

const { state, readline, sanitizeInput } = require("./utils");
const {logger} = require("./logger");

const apiKey = "213438401d774c4b99831f52b12ebd3c"; // Insert the key
const apiBase = "https://rt-bdi-gpt4.openai.azure.com/"; // Your endpoint
const apiVersion = "2023-05-15"; // API version
const deploymentName = "izzo-bozzo-gpt4"; // Deployment name


// User interaction

async function getUserRequest() {
  return new Promise((resolve, reject) => {
    readline.question("Enter your request: ", (userInput) => {
      if (!userInput) {
        reject(new Error("Please provide a user request."));
        return;
      }

      const sanitizedInput = sanitizeInput(userInput.trim());
      resolve(sanitizedInput); // Return the sanitized input
    });
  });
}

// Chat GPT interaction

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
          console.log("Invalid input. Please answer with 'yes' or 'no'.");
          resolve(askUserPluginFeedback()); // Recursively ask until a valid answer is provided
        }
      }
    );
  });
}

function askUserForNegativeFeedback() {
  return new Promise((resolve) => {
    readline.question(
      "Please, explain what was the problem with the result you got: ",
      (comment) => {
        const sanitizedComment = sanitizeInput(comment.trim());
        resolve(sanitizedComment);
      }
    );
  });
}

async function handleUserNewPluginFeedback(feedback) {
  if (feedback === "yes") {
    console.log("Great! We're glad you're satisfied with the response.");
    //TODO: save plugin to database along with associated user request

    console.log("New plugin json:");
    console.log(state.currentPluginJson);
    await saveNewPluginToDb(state.currentPluginJson, state.currentUserRequest);
  } else if (feedback === "no") {
    console.log("Sorry to hear that. We'll try to improve.");
    // Ask the user to explain the problem
    state.currentProblemComment = await askUserForNegativeFeedback();
    console.log(
      "User prompt details about the problem:",
      state.currentProblemComment
    );
    var GPTNegativeFeedbackNewPluginRequest =
      createGPTNegativeFeedbackNewPluginRequest(
        state.currentUserRequest,
        state.currentProblemComment,
        state.currentGPTResponse,
        state.currentPluginError
      );

    console.log();

    var newGPTResponse = await getChatGptResponse(
      GPTNegativeFeedbackNewPluginRequest
    );
    console.log("New gpt response:");
    console.log(GPTNegativeFeedbackNewPluginRequest);
    await handleGPTResponse(newGPTResponse);
    const userNewPluginFeedback = await askUserPluginFeedback();
    // Handle the user's satisfaction response
    await handleUserNewPluginFeedback(userNewPluginFeedback);
  }
}

async function handleUserExistingPluginFeedback(feedback) {
  if (feedback === "yes") {
    console.log(
      "Great! We're glad you're satisfied with the response. Saving the new request into the database. "
    );

    await saveUserRequestForExistingPlugin(
      state.currentPluginJson.id,
      state.currentUserRequest
    );
  } else if (feedback === "no") {
    console.log("Sorry to hear that. We'll try to improve.");
    // Ask the user to explain the problem
    state.currentProblemComment = await askUserForNegativeFeedback();
    console.log(
      "User prompt details about the problem:",
      state.currentProblemComment
    );
    var GPTNegativeFeedbackExistingPluginRequest =
      createGPTNegativeFeedbackExistingPluginRequest(
        state.currentUserRequest,
        state.currentProblemComment,
        state.currentGPTResponse,
        state.currentPluginError,
        state.pluginsJson
      );

    console.log();

    var newGPTResponse = await getChatGptResponse(
      GPTNegativeFeedbackExistingPluginRequest
    );
    console.log("New gpt response:");
    console.log(GPTNegativeFeedbackExistingPluginRequest);
    await handleGPTResponse(newGPTResponse);
    const userExistingPluginFeedback = await askUserPluginFeedback();
    // Handle the user's satisfaction response
    await handleUserExistingPluginFeedback(userExistingPluginFeedback);
  }
}


async function getChatGptResponse(request) {
  try {
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

    state.currentGPTResponse = response.data.choices[0].message.content;
    return response.data.choices[0].message.content;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.error(
        "Rate limit exceeded. Waiting for a while before retrying..."
      );
      await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 60 seconds
      return await getChatGptResponse(request); // Retry
    } else {
      throw error; // Re-throw the error if it is not a 429 error
    }
  }
}

async function handleGPTResponse(gptResponse) {
  try {
    const responseObject = JSON.parse(gptResponse);

    state.currentPluginJson = {
      code: responseObject.newPluginCode,
      dependencies: responseObject.newPluginDependencies,
      description: responseObject.pluginDescription,
    };
    // No suitable plugin found: producing and executing a new one.
    if (
      responseObject.response === "no" &&
      responseObject.newPluginCode !== "null"
    ) {
      console.log("Executing new plugin...");

      const newPluginCode = responseObject.newPluginCode;
      const pluginArguments = responseObject.pluginArguments;
      const dependencies = responseObject.newPluginDependencies;

      // Dynamically install the dependencies provided by the GPT response
      installDependencies(dependencies);

      try {
        state.currentPluginError = "";
        // Execute the new plugin with the provided arguments
        const result = await executePlugin(newPluginCode, pluginArguments);
        console.log("Plugin execution result:", result);
        // Ask the user if they are satisfied with the result
        const userNewPluginFeedback = await askUserPluginFeedback();
        // Handle the user's satisfaction response
        await handleUserNewPluginFeedback(userNewPluginFeedback);
      } catch (error) {
        console.error("Error during plugin execution:", error.message);
        await cleanupUnusedDependencies(dependencies);
      }
      // Suitable existing plugin found
    } else if (
      responseObject.response === "yes" &&
      responseObject.pluginId !== "null"
    ) {
      //TODO: implement existing plugin execution
      console.log(
        "Executing existind plugin with ID " + responseObject.pluginId
      );

      try {
        const pluginDetails = await getPluginById(responseObject.pluginId);
        state.currentPluginJson = pluginDetails;
        const pluginArguments = responseObject.pluginArguments;

        console.log(state.currentPluginJson);
        // Install dependencies
        //installDependencies(pluginDetails.dependencies.join(","));

        state.currentPluginError = "";
        // Execute the plugin with the last known arguments
        const result = await executePlugin(pluginDetails.code, pluginArguments);
        console.log("Plugin execution result:", result);

        // Ask the user if they are satisfied with the result
        const userExistingPluginFeedback = await askUserPluginFeedback();
        await handleUserExistingPluginFeedback(userExistingPluginFeedback);
      } catch (error) {
        console.error("Error during plugin execution:", error.message);
      }
    } else {
      console.log("No valid plugin to execute.");
    }
  } catch (err) {
    console.error("Error handling GPT response:", err.message);
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
