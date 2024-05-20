const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});
const natural = require("natural");
const OpenAI = require("openai");

// Imposta la chiave API
const apiKey = "sk-proj-ZY3sWdAAEWG51VYAx7stT3BlbkFJiMeeIDkbz7QcfO1JQ5M7";
const openai = new OpenAI({
  apiKey: apiKey,
});

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
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: request }],
      model: "gpt-3.5-turbo",
    });
    return completion.choices[0].message.content;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.error("Rate limit exceeded. Waiting for a while before retrying...");
      await new Promise((resolve) => setTimeout(resolve, 60000)); // Attendi 60 secondi
      return await getChatGptResponse(request); // Riprovare
    } else {
      throw error; // Rilancia l'errore se non è un errore 429
    }
  }
}

async function main() {
  console.log(
    "Welcome! This software can help you with various tasks. Please enter your request in natural language:"
  );
  try {
    const userRequest = await getUserRequest();
    console.log("User request:", userRequest);

    // TODO: Retrieve all the plugin code + information (in JSON format) that has to be sent to ChatGPT to be analyzed for the awareness feature.
    
    // TODO: Compose the request for ChatGPT, including the user request and the plugins information specifying that it
    // has to answer back in the "yes+plugin_id+parameters/no+new_plugin_code+parameters/not_possibile" format (the plugin has to be standalone, 
    // and also the parameters has to be extracted from the user's request).

    // Send the precompiled request to ChatGPT
    var gptResponse = await getChatGptResponse(userRequest);
    console.log("GPT response:", gptResponse);

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
