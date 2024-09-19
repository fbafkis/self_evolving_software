const { sanitizeInput } = require("./utils");
// The intial request
function createGPTInitialRequest(currentUserRequest, pluginsJson, chatHistory) {
  let initialGPTRequest =
    `I ask you to perform a coverage evaluation of a feature by a series of plugins present within a software. You will need to analyze a request expressed by a human user and understand by analyzing the code and other information of the available plugins if one of them is able to satisfy the user's request.
          
  Input Description
  I provide you with a string called userRequest which will contain a natural language request specified by a human user. I also provide you with a second string called allPlugins in JSON format, which includes a list of plugins written in NodeJS language. For each plugin, its ID, its code (written in JavaScript), its description expressed in natural language, and a series of natural language strings to which the plugin in question has satisfactorily responded to the user, receiving positive feedback, will be specified. You will have to make your evaluation based on all these factors. In case the plugins string is empty, you should assume that there are no available plugins, and therefore the response will automatically be negative. In case the report is negative you have to provide the code in NodeJS for a new plugin that tries to satisfy the request to be attached to the main program and executed. Also the list of required dependencies that has to be installed to through npm to run the new plugin has to be provided. In every case, you also have to provide a string that can be directly used as arguments string for the already existing and adequate plugin or for the new produced plugin. Also a brief description that you can use in the future to analyze the plugin in an easier way. 
  
  Output Description
  IMPORTANT: The response you provide must be exclusively in the following JSON format with nothing else attached, so that your response can be parsed by the application code:
  
  {
    response: "yes"/"no", 
    pluginId: "id plugin"/"null",
    newPluginCode: "null/code",
    newPluginDependencies: "null/dependencies",
    pluginArguments: "arguments string",
    pluginDescription: "null/description"
  }
  
  where the response field can take the value yes or no depending on whether you believe there is a plugin available that can satisfy the user's request, while the pluginId field can take the value of the unique ID of the plugin that you believe can satisfy the request if it exists, or null if you believe that none of the available plugins can satisfy the request. The newPluginCode will contain the code of the new plugin you will produce and that will be attached, if you don't believe no one of the existing can satisfy the request. 
  The code of the plugin you produce must satisfies some specifications, since it will be used within a sandbox environment in NodeJS:
  
  1. Use Module Exports: The plugin should always export a single function as module.exports. This function will be the entry point for the plugin execution.
  
  2. Function Signature: The exported function should accept arguments that are passed as an array. This way, the arguments can be easily parsed and passed during execution.
  
  3. Avoid Global Function Declarations: Ensure that all logic is encapsulated within the exported function, avoiding any global function declarations.
  
  4. Return Values: The function should return a value that will be captured and processed by your application.
  
  5. You can eventually use external modules. They will be automatically installed using npm. 
  
  In case of negative response, and when a new plugin is produced, you also have to provide the list of packages' names that have to be installed with npm to run the new plugin, inside the newPluginDependencies field. They have to be expressed with comma separated format, just like the arguments field. If there are no dependencies, the field must be an empty array. The pluginArguments field must be a string that can be used "as is" to execute the plugin, containing also the parameters to call it extracing them from the user request. They must be comma separated. If no arguments are needed use "" and not "none" or any other word, only the empty quotes. 
  The pluginDescription field is a description that can be used by yourself in the future to identify the new plugin in a more effective and precise way. 
  As additional information you can use there is also the history of the conversation between this application and yourself. It will be under the "chatHistory" field of the input and it has a JSON format. 
  There must be nothing else than the JSON in your response. It is a fundamental requirement. You can ONLY answer with a JSON object and no sentences or other answers or words, or titles like "Output:" before the JSON are admitted. It must be a clean JSON.
  
  
  Input Data
  Below are the data you need to use to respond:
  
  userRequest:\n` +
    currentUserRequest +
    "\n" +
    `\nallPlugins:\n` +
    pluginsJson +
    "\n" +
    `\nchatHistory:\n` +
    chatHistory + 
    "\n\n REMEMBER YOU CAN RESPOND ONLY WITH A PURE JSON! THIS IS A FUNDAMENTAL REQUIREMENT!";

  return initialGPTRequest;
}

// The request in case of negative feedback for a new plugin
function createGPTNegativeFeedbackNewPluginRequest(
  currentUserRequest,
  problemComment,
  lastResponse,
  pluginError,
  chatHistory
) {
  let negativeFeedbackNewPluginGPTRequest =
    `You have responded to this user's request:\n` +
    currentUserRequest +
    "\n" +
    `with this response:\n` +
    lastResponse +
    "\n" +
    `After the execution of the plugin, the user expressed a negative feedback about the result. So a wrong result or a problem in executing the plugin has occured. The user's comment about the negative feedback is:\n` +
    '"' +
    problemComment +
    '"\n' +
    `You have to use this comment to try to understand what is wrong and adjust the response, and to produce a new response without the problems of previous one you provided. 
  The new response have to follow all the rules an specification as for the previous one.\n`;

  if (pluginError && pluginError !== "") {
    negativeFeedbackNewPluginGPTRequest +=
      `It is also available the error thrown previously by the plugin:\n` +
      pluginError;
  }

  negativeFeedbackNewPluginGPTRequest +=
    `\nOutput Description
  IMPORTANT: The response you provide must be exclusively in the following JSON format with nothing else attached, so that your response can be parsed by the application code:
  
  {
    response: "no", 
    pluginId: "null",
    newPluginCode: "code",
    newPluginDependencies: "null/dependencies",
    pluginArguments: "arguments string",
    pluginDescription: "description"
  }
  
  
  where the response field can be only "no", since you already evaluated the already existing plugins, so you have only to produce a modified new plugin that works. The "pluginId" will be "null", since you have already decided to provide a new plugin, and there is no id of an existing plugin to try to execute. The newPluginCode will contain the code of the new plugin you will produce and that will be attached.
  The code of the plugin you produce must satisfies some specifications, since it will be used within a sandbox environment in NodeJS:
  
  1. Use Module Exports: The plugin should always export a single function as module.exports. This function will be the entry point for the plugin execution.
  
  2. Function Signature: The exported function should accept arguments that are passed as an array. This way, the arguments can be easily parsed and passed during execution.
  
  3. Avoid Global Function Declarations: Ensure that all logic is encapsulated within the exported function, avoiding any global function declarations.
  
  4. Return Values: The function should return a value that will be captured and processed by your application.
  
  5. You can eventually use external modules. They will be automatically installed using npm. 
  
You also have to provide the list of packages' names that have to be installed with npm to run the new plugin, inside the newPluginDependencies field. They have to be expressed with comma separated format, just like the arguments field. If there are no dependencies, the field must be an empty array. If no dependencies are needed use "" and not "none" or any other word, only the empty quotes. The pluginArguments field must be a string that can be used "as is" to execute the plugin, containing also the parameters to call it extracing them from the user request. They must be comma separated. If no arguments are needed use "" and not "none" or any other word, only the empty quotes. 
The pluginDescription field is a description that can be used by yourself in the future to identify the new plugin in a more effective and precise way. 
There must be nothing else than the JSON in your response. It is a fundamental requirement. You can ONLY answer with a JSON object and no sentences or other answers or words, or titles like "Output:" before the JSON are admitted. It must be a clean JSON.
As additional information you can use there is also the history of the conversation between this application and yourself. It will be under the "chatHistory" field of the input and it has a JSON format. 
chatHistory:\n` +chatHistory  
+ `\n\n  REMEMBER YOU CAN RESPOND ONLY WITH A PURE JSON! THIS IS A FUNDAMENTAL REQUIREMENT!`;

  return negativeFeedbackNewPluginGPTRequest;
}

// The request in case of negative feedback for an existing plugin
function createGPTNegativeFeedbackExistingPluginRequest(
  currentUserRequest,
  problemComment,
  lastResponse,
  pluginError,
  pluginsJson,
  chatHistory
) {
  let negativeFeedbackNewPluginGPTRequest =
    `You have responded to this user's request:\n` +
    currentUserRequest +
    "\n" +
    `with this response:\n` +
    lastResponse +
    "\n" +
    `After the execution of the existing plugin, the user expressed a negative feedback about the result. So a wrong result or a problem in executing the plugin has occured. The user's comment about the negative feedback is:\n` +
    '"' +
    problemComment +
    '"\n' +
    `You have to use this comment to try to understand what is wrong and adjust the response, and to produce a new response without the problems of previous one you provided. Considering that you have previously decided that one of the already existing plugins was suitable to satisfy the request, here is the set of available plugins, so that you can eventaully reason again considering all the available plugins:\n` +
    pluginsJson +
    `\nYou can eventually decide that is better to create a new plugin. 
    The new response have to follow all the rules an specification as for the previous one.\n`;

  if (pluginError && pluginError !== "") {
    negativeFeedbackNewPluginGPTRequest +=
      `It is also available the error thrown previously by the plugin:\n` +
      pluginError;
  }

  negativeFeedbackNewPluginGPTRequest +=
    `\n
    
    Pobably you have to change the arguments to call the plugin, since it should be tested and working and approved by the user. You have to regenerate the response following the usual specifications for the output.
    
    Output Description
    IMPORTANT: The response you provide must be exclusively in the following JSON format with nothing else attached, so that your response can be parsed by the application code:
    
    {
      response: "no", 
      pluginId: "null",
      newPluginCode: "code",
      newPluginDependencies: "null/dependencies",
      pluginArguments: "arguments string",
      pluginDescription: "description"
    }
    
    
    where the response field can be only "no", since you already evaluated the already existing plugins, so you have only to produce a modified new plugin that works. The "pluginId" will be "null", since you have already decided to provide a new plugin, and there is no id of an existing plugin to try to execute. The newPluginCode will contain the code of the new plugin you will produce and that will be attached.
    The code of the plugin you produce must satisfies some specifications, since it will be used within a sandbox environment in NodeJS:
    
    1. Use Module Exports: The plugin should always export a single function as module.exports. This function will be the entry point for the plugin execution.
    
    2. Function Signature: The exported function should accept arguments that are passed as an array. This way, the arguments can be easily parsed and passed during execution.
    
    3. Avoid Global Function Declarations: Ensure that all logic is encapsulated within the exported function, avoiding any global function declarations.
    
    4. Return Values: The function should return a value that will be captured and processed by your application.
    
    5. You can eventually use external modules. They will be automatically installed using npm. 
    
  You also have to provide the list of packages' names that have to be installed with npm to run the new plugin, inside the newPluginDependencies field. They have to be expressed with comma separated format, just like the arguments field. If there are no dependencies, the field must be an empty array. If no dependencies are needed use "" and not "none" or any other word, only the empty quotes. The pluginArguments field must be a string that can be used "as is" to execute the plugin, containing also the parameters to call it extracing them from the user request. They must be comma separated. If no arguments are needed use "" and not "none" or any other word, only the empty quotes. 
  The pluginDescription field is a description that can be used by yourself in the future to identify the new plugin in a more effective and precise way. 
  There must be nothing else than the JSON in your response. It is a fundamental requirement. You can ONLY answer with a JSON object and no sentences or other answers or words, or titles like "Output:" before the JSON are admitted. It must be a clean JSON.
  As additional information you can use there is also the history of the conversation between this application and yourself. It will be under the "chatHistory" field of the input and it has a JSON format. 
  chatHistory:\n` + chatHistory
  + `\n\n  REMEMBER YOU CAN RESPOND ONLY WITH A PURE JSON! THIS IS A FUNDAMENTAL REQUIREMENT!`;;

  return negativeFeedbackNewPluginGPTRequest;
}

function createGPTMalfunctioningPluginRequest(
  pluginCode,
  userRequest,
  pluginErrorMessage,
  pluginArguments,
  chatHistory
) {
  let handleMalfunctioningPluginGPTRequest =
    `The plugin that has just been executed has encountered some errors while being executed. This is its code:\n` +
    pluginCode +
    `\n` +
    `The request that the plungin should have satisfied is:\n` +
    userRequest +
    `\n` +
    `This is the error message from the plugin execution:\n\"` +
    pluginErrorMessage +
    `\"\n` +
    `These are the arguments passed to the plugin:\n\"` +
    pluginArguments +
    `\"\n` +
    `You have to modify the plugin code, so that it works without thorwing errors.You can't modify the arguments. The new plugin code must work \"as is \", with the same arguments. In the response you have to provide only the complete code, and absoulutely nothing else. No titles, no other words, no special characters. You can also use the history of the chat between this application and you to provide a valid response in an easier and more effective way. The chat history is expressed as a JSON. Pay attention to the chat history to not repeat the same errors. 
    Chat history:\n` +
    chatHistory;

  return handleMalfunctioningPluginGPTRequest;
}

module.exports = {
  createGPTInitialRequest,
  createGPTNegativeFeedbackNewPluginRequest,
  createGPTNegativeFeedbackExistingPluginRequest,
  createGPTMalfunctioningPluginRequest,
};
