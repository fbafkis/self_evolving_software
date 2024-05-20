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

    var gptResponse = await getChatGptResponse(userRequest);

    console.log("GPT response:", gptResponse);

    await main(); // Restart the loop after processing the request
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    readline.close();
  }
}

// Start the main loop
main();
