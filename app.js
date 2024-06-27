const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});
const { Console } = require("console");
const natural = require("natural");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const axios = require("axios");

let db;
let init_flag = false;
let plugins;
let pluginsJson;
let currentUserRequest;

const apiKey = "213438401d774c4b99831f52b12ebd3c"; // Insert the key
const apiBase = "https://rt-bdi-gpt4.openai.azure.com/"; // Your endpoint
const apiVersion = "2023-05-15"; // API version
const deploymentName = "izzo-bozzo-gpt4"; // Deployment name

function createGPTInitialRequest(currentUserRequest, pluginsJson) {
  let initialGPTRequest =
    `I ask you to perform a coverage evaluation of a feature by a series of plugins present within a software. You will need to analyze a request expressed by a human user and understand by analyzing the code and other information of the available plugins if one of them is able to satisfy the user's request.
		
Input Description
I provide you with a string called userRequest which will contain a natural language request specified by a human user. I also provide you with a second string called allPlugins in JSON format, which includes a list of plugins written in NodeJS language. For each plugin, its ID, its code (written in JavaScript), its description expressed in natural language, and a series of natural language strings to which the plugin in question has satisfactorily responded to the user, receiving positive feedback, will be specified. You will have to make your evaluation based on all these factors. In case the plugins string is empty, you should assume that there are no available plugins, and therefore the response will automatically be negative.

Output Description
The response you provide must be exclusively provided in the following JSON format:

json
Copy code
{
  response: "yes"/"no", 
  pluginId: "id plugin"/"null"
}
Where the response field can take the value yes or no depending on whether you believe there is a plugin available that can satisfy the user's request, while the pluginId field can take the value of the unique ID of the plugin that you believe can satisfy the request if it exists, or null if you believe that none of the available plugins can satisfy the request.

Input Data
Below are the data you need to use to respond:

userRequest:\n` +
    currentUserRequest +
    `allPlugins:\n` +
    pluginsJson;

  return initialGPTRequest;
}

function getUserRequest() {
  return new Promise((resolve, reject) => {
    readline.question("Enter your request: ", (userInput) => {
      if (!userInput) {
        reject(new Error("Please provide a user request."));
        return;
      }
      const tokens = new natural.WordTokenizer().tokenize(userInput);
      resolve(tokens.join(" "));
    });
  });
}

async function getChatGptResponse(request) {
  try {
    const response = await axios.post(
      `${apiBase}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`,
      {
        messages: [{ role: "user", content: request }],
        max_tokens: 20,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );

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

async function getAllPluginsFromDb() {
  // Connect to the database
  let db = new sqlite3.Database("./plugin-database.db", (err) => {
    if (err) {
      console.error("DB connection error:", err.message);
    }
    console.log("Connected to the SQLite database.");
  });

  // Promisify the db.all and db.close methods
  const dbAll = promisify(db.all).bind(db);
  const dbClose = promisify(db.close).bind(db);

  try {
    // SQL query to retrieve all plugins and their related requests
    const sql = `
      SELECT p.id as plugin_id, p.code, p.description, r.id as request_id, r.request
      FROM plugins p
      LEFT JOIN user_requests r ON p.id = r.plugin_id
    `;

    // Execute the query
    const rows = await dbAll(sql);

    // Compose JSON object
    let pluginsMap = {};

    rows.forEach((row) => {
      if (!pluginsMap[row.plugin_id]) {
        pluginsMap[row.plugin_id] = {
          id: row.plugin_id,
          code: row.code,
          description: row.description,
          requests: [],
        };
      }
      if (row.request_id) {
        pluginsMap[row.plugin_id].requests.push({
          id: row.request_id,
          request: row.request,
        });
      }
    });

    // Convert pluginsMap to an array
    const plugins = Object.values(pluginsMap);

    // Print the JSON object
    console.log("The JSON containing all the retrieved plugins:");
    console.log(JSON.stringify(plugins, null, 2));
    let pluginsJsonResult = JSON.stringify(plugins, null, 2);
    if (plugins.length === 0) pluginsJsonResult = "{}";
    return pluginsJsonResult;
  } catch (err) {
    console.error("DB all error:", err.message);
    return "{}"; // Return an empty JSON if there's an error
  } finally {
    // Close the database connection
    try {
      await dbClose();
      console.log("Closed the database connection.");
    } catch (err) {
      console.error("DB close error:", err.message);
    }
  }
}

async function saveNewPlugin(pluginJsonString, userRequestString) {
  // Parse the JSON string to an object
  const plugin = JSON.parse(pluginJsonString);

  // Connect to the database
  let db = new sqlite3.Database("./plugin-database.db", (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log("Connected to the SQLite database.");
  });

  // Promisify the db.run and db.get methods
  const dbRun = promisify(db.run).bind(db);
  const dbGet = promisify(db.get).bind(db);

  try {
    // Insert the plugin into the plugins table
    const insertPluginSql = `INSERT INTO plugins (code, description) VALUES (?, ?)`;
    const result = await dbRun(insertPluginSql, [
      plugin.code,
      plugin.description,
    ]);

    // Get the last inserted plugin id
    const pluginId = result.lastID;

    // Insert the user request into the user_requests table
    const insertRequestSql = `INSERT INTO user_requests (plugin_id, request) VALUES (?, ?)`;
    const requestResult = await dbRun(insertRequestSql, [
      pluginId,
      userRequestString,
    ]);

    // Get the last inserted user request id
    const userRequestId = requestResult.lastID;

    // Print the new user request id
    console.log(`New user request ID: ${userRequestId}`);

    // Return the new user request id
    return userRequestId;
  } catch (err) {
    console.error(err.message);
    throw err;
  } finally {
    // Close the database connection
    db.close((err) => {
      if (err) {
        console.error(err.message);
      }
      console.log("Closed the database connection.");
    });
  }
}

async function initDb() {
  const db = new sqlite3.Database("./plugin-database.db", (err) => {
    if (err) {
      console.error("DB connection error:", err.message);
    }
    console.log("Connected to the SQLite database.");
  });

  const dbRun = promisify(db.run).bind(db);
  const dbClose = promisify(db.close).bind(db);

  try {
    // Create the plugins table
    await dbRun(`CREATE TABLE IF NOT EXISTS plugins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      description TEXT NOT NULL
    )`);
    console.log("Plugins table created or already exists.");

    // Create the user_requests table
    await dbRun(`CREATE TABLE IF NOT EXISTS user_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plugin_id INTEGER,
      request TEXT NOT NULL,
      FOREIGN KEY (plugin_id) REFERENCES plugins(id)
    )`);
    console.log("User requests table created or already exists.");
  } catch (err) {
    console.error("DB run error:", err.message);
  } finally {
    // Close the database connection
    try {
      await dbClose();
      console.log("Closed the database connection.");
    } catch (err) {
      console.error("DB close error:", err.message);
    }
  }
}

async function main() {
  // Check for initialization
  try {
    if (!init_flag) {
      await initDb().then(() => {
        init_flag = true;
      });
    }

    pluginsJson = await getAllPluginsFromDb();

    console.log(
      "Welcome! This software can help you with various tasks. Please enter your request in natural language:"
    );
    currentUserRequest = await getUserRequest();
    console.log("CHAT - User request:", currentUserRequest);

    var initialGPTRequest = createGPTInitialRequest(currentUserRequest, pluginsJson); //TODO: Check the JSON composition of the request data (missing parenthesis and * or symbols).
    console.log("Initial GPT request:\n" + initialGPTRequest);

    // TODO: Retrieve all the plugin code + information (in JSON format) that has to be sent to ChatGPT to be analyzed for the awareness feature.

    // TODO: Compose the request for ChatGPT, including the user request and the plugins information specifying that it
    // has to answer back in the "yes+plugin_id+parameters/no+new_plugin_code+parameters/not_possibile" format (the plugin has to be standalone,
    // and also the parameters has to be extracted from the user's request).

    // Send the precompiled request to ChatGPT
    var gptResponse = await getChatGptResponse(initialGPTRequest);
    console.log("CHAT - GPT response:\n", gptResponse);

    // TODO: Analyze the response from ChatGPT. If the answer is positive, execute the plugin (using the extracted parameters provided by the
    // oracle). If the answer is negative, install the new plugin, classify it, and then execute this using the extracted parameters. If the
    // answer is "not possible", notify the user and start over.

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
