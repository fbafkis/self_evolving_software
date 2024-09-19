const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const { state } = require("./utils");
const logger = require("./logger");

// Function to initialize the database
async function initDb() {
  const db = new sqlite3.Database("./app-database.db", (err) => {
    if (err) {
      logger.error("InitDb - DB connection error:\n" + err.message);
    }
    logger.debug("InitDb - Connected to the SQLite database.");
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
    logger.debug("InitDb - Plugins table created or already exists.");

    // Create the user_requests table with a composite primary key
    await dbRun(`CREATE TABLE IF NOT EXISTS user_requests (
          plugin_id INTEGER,
          request TEXT NOT NULL,
          PRIMARY KEY (plugin_id, request),
          FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
        )`);
    logger.debug("InitDb: user requests table created or already exists.");

    // Create the dependencies table
    await dbRun(`CREATE TABLE IF NOT EXISTS dependencies (
          plugin_id INTEGER,
          name TEXT NOT NULL,
          PRIMARY KEY (plugin_id, name),
          FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
        )`);
    logger.debug("InitDb - Dependencies table created or already exists.");

    // Create the chat history table
    await dbRun(`CREATE TABLE IF NOT EXISTS chat_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    logger.debug("InitDb - Chat history table created or already exists.");
  } catch (err) {
    logger.error("InitDb - DB run error:\n" + err.message);
  } finally {
    // Close the database connection
    try {
      await dbClose();
      logger.debug("InitDb - Closed the database connection.");
    } catch (err) {
      logger.error("InitDb - DB close error:\n" + err.message);
    }
  }
}

// Function that retrieves all the plugins saved to the database
async function getAllPluginsFromDb() {
  // Connect to the database
  let db = new sqlite3.Database("./app-database.db", (err) => {
    if (err) {
      console.error(
        "GetAllPluginsFromDb - DB connection error:\n" + err.message
      );
    }
    logger.debug("GetAllPluginsFromDb - Connected to the SQLite database.");
  });
  const dbAll = promisify(db.all).bind(db);
  const dbClose = promisify(db.close).bind(db);

  try {
    // SQL query to retrieve all plugins and the related requests
    const sql = `
        SELECT p.id as plugin_id, p.code, p.description, r.id as request_id, r.request
        FROM plugins p
        LEFT JOIN user_requests r ON p.id = r.plugin_id
      `;
    // Execute the query
    const rows = await dbAll(sql);
    // Create the plugins json to be returned
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
    // Convert the pluginsMap object to an array
    const plugins = Object.values(pluginsMap);
    logger.debug(
      "The JSON containing all the retrieved plugins:\n" +
        JSON.stringify(plugins, null, 2)
    );
    // Update the global variable
    state.pluginsJsonResult = JSON.stringify(plugins, null, 2);
    // If there are no plugins saved to the database
    if (plugins.length === 0) state.pluginsJsonResult = "{}";
    return state.pluginsJsonResult;
  } catch (err) {
    logger.error("DB all error:\n" + err.message);
    // Return an empty JSON if there's an error
    return "{}";
  } finally {
    // Close the database connection
    try {
      await dbClose();
      logger.debug("GetAllPluginsFromDb - Closed the database connection.");
    } catch (err) {
      logger.error("GetAllPluginsFromDb - DB close error:\n" + err.message);
    }
  }
}

// Function to save a new plugin to the database
async function saveNewPluginToDb(plugin, userRequestString) {
  // Connect to the database
  let db = new sqlite3.Database("./app-database.db", (err) => {
    if (err) {
      logger.error(err.message);
    }
    logger.debug("SaveNewPluginToDb - Connected to the SQLite database.");
  });
  const dbRun = promisify(db.run).bind(db);
  try {
    // Insert the plugin into the plugins table
    const insertPluginSql = `INSERT INTO plugins (code, description) VALUES (?, ?)`;
    await dbRun(insertPluginSql, [plugin.code, plugin.description]);
    // Get the id last saved plugin to use it as foreign key
    const pluginId = await new Promise((resolve, reject) => {
      db.get("SELECT last_insert_rowid() as id", (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.id);
        }
      });
    });
    // Save the user request into the user requests table
    const insertRequestSql = `INSERT INTO user_requests (plugin_id, request) VALUES (?, ?)`;
    await dbRun(insertRequestSql, [pluginId, userRequestString]);
    // Get the last saved user request id
    const userRequestId = await new Promise((resolve, reject) => {
      db.get("SELECT last_insert_rowid() as id", (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.id);
        }
      });
    });
    // Print the new user request id
    logger.debug(`SaveNewPluginToDb - New user request ID: ${userRequestId}`);
    // Insert the dependencies into the dependencies table
    if (plugin.dependencies) {
      // Ensure dependencies is an array, even if it's a single string
      const dependencies = Array.isArray(plugin.dependencies)
        ? plugin.dependencies
        : plugin.dependencies.split(",");
      for (const dependency of dependencies) {
        // Return an empty JSON if there's an error
        const trimmedDependency = dependency.trim();
        if (trimmedDependency) {
          // Ensure it's not an empty string
          const insertDependencySql = `INSERT INTO dependencies (plugin_id, name) VALUES (?, ?)`;
          await dbRun(insertDependencySql, [pluginId, trimmedDependency]);
        }
      }
      logger.debug(
        `SaveNewPluginToDb - Dependencies for plugin ID ${pluginId} saved successfully.`
      );
    }
    // Return the new user request id
    return userRequestId;
  } catch (err) {
    console.error(err.message);
    throw err;
  } finally {
    // Close the database connection
    try {
      await db.close();
      logger.debug("SaveNewPluginToDb - Closed the database connection.");
    } catch (err) {
      logger.error("SaveNewPluginToDb - DB close error:\n" + err.message);
    }
  }
}

// Function to get a plugin from database by id
async function getPluginById(pluginId) {
  let db = new sqlite3.Database("./app-database.db", (err) => {
    if (err) {
      logger.error(err.message);
    }
    logger.debug("GetPluginById - Connected to the SQLite database.");
  });
  const dbGet = promisify(db.get).bind(db);
  const dbAll = promisify(db.all).bind(db);
  try {
    // Get the plugin info from the plugin table
    const plugin = await dbGet(`SELECT * FROM plugins WHERE id = ?`, [
      pluginId,
    ]);
    // Get the plugin dependencies from the dependencies table
    const dependencies = await dbAll(
      `SELECT name FROM dependencies WHERE plugin_id = ?`,
      [pluginId]
    );
    // Get the plugin requestd from the requests table
    const lastRequest = await dbGet(
      `SELECT request FROM user_requests WHERE plugin_id = ? ORDER BY id DESC LIMIT 1`,
      [pluginId]
    );
    // Return the plugin JSON
    return {
      id: plugin.id,
      code: plugin.code,
      dependencies: dependencies.map((dep) => dep.name),
      request: lastRequest.request,
    };
  } catch (err) {
    logger.error("GetPluginByIdDB - Error:\n" + err.message);
    throw err;
  } finally {
    try {
      await db.close();
      logger.debug("GetPluginById - Closed the database connection.");
    } catch (err) {
      logger.error("GetPluginById - DB close error:\n" + err.message);
    }
  }
}

// Function to save a new request associated to an exisiting plugin to the database
async function saveUserRequestForExistingPlugin(pluginId, userRequestString) {
  // Connect to the database
  let db = new sqlite3.Database("./app-database.db", (err) => {
    if (err) {
      logger.error(err.message);
    }
    logger.debug(
      "SaveUserRequestForExistingPlugin - Connected to the SQLite database."
    );
  });

  const dbRun = promisify(db.run).bind(db);
  const dbGet = promisify(db.get).bind(db);

  try {
    // Check if the same request already exists for the same plugin
    const existingRequest = await dbGet(
      `SELECT 1 FROM user_requests WHERE plugin_id = ? AND request = ?`,
      [pluginId, userRequestString]
    );

    if (existingRequest) {
      logger.debug(
        `SaveUserRequestForExistingPlugin - Request already exists for plugin ID ${pluginId}. Skipping insert.`
      );
    } else {
      // Save the user request into the user_requests table
      const insertRequestSql = `INSERT INTO user_requests (plugin_id, request) VALUES (?, ?)`;
      await dbRun(insertRequestSql, [pluginId, userRequestString]);

      // Get the last saved user request ID
      const userRequestId = await new Promise((resolve, reject) => {
        db.get("SELECT last_insert_rowid() as id", (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row.id);
          }
        });
      });

      logger.debug(
        `SaveUserRequestForExistingPlugin - New user request ID: ${userRequestId}`
      );
    }

    // Return the plugin ID (this may be useful for other purposes)
    return pluginId;
  } catch (err) {
    logger.error("SaveUserRequestForExistingPlugin - Error:\n" + err.message);
    throw err;
  } finally {
    try {
      // Close the database connection
      await db.close();
    } catch (err) {
      logger.error(
        "SaveUserRequestForExistingPlugin - DB close error:\n" + err.message
      );
    }
    logger.debug(
      "SaveUserRequestForExistingPlugin - Closed the database connection."
    );
  }
}

// Function to save a message to chat history
async function saveChatMessage(role, content) {
  let db = new sqlite3.Database("./app-database.db", (err) => {
    if (err) {
      logger.error(err.message);
    }
    logger.debug("SaveChatMessage - Connected to the SQLite database.");
  });

  const dbRun = promisify(db.run).bind(db);

  try {
    const insertMessageSql = `INSERT INTO chat_history (role, content) VALUES (?, ?)`;
    await dbRun(insertMessageSql, [role, content]);
    logger.debug(
      `SaveChatMessage - Chat message saved successfully (role: ${role}).`
    );
  } catch (err) {
    logger.error(
      "SaveChatMessage - Error saving chat message:\n" + err.message
    );
    throw err;
  } finally {
    try {
      await db.close();
    } catch (err) {
      logger.error("SaveChatMessage - DB close error:\n" + err.message);
    }
    logger.debug("SaveChatMessage - Closed the database connection.");
  }
}

// Function to retrieve chat history
async function getChatHistory() {
  let db = new sqlite3.Database("./app-database.db", (err) => {
    if (err) {
      logger.error(err.message);
    }
    logger.debug("GetChatHistory - Connected to the SQLite database.");
  });

  const dbAll = promisify(db.all).bind(db);

  try {
    const selectMessagesSql = `SELECT role, content, timestamp FROM chat_history ORDER BY timestamp ASC`;
    const rows = await dbAll(selectMessagesSql);
    logger.debug("GetChatHistory - Chat history retrieved successfully.");
    return rows;
  } catch (err) {
    logger.error(
      "GetChatHistory - Error retrieving chat history:\n" + err.message
    );
    throw err;
  } finally {
    try {
      await db.close();
    } catch (err) {
      logger.error("GetChatHistory - DB close error:\n" + err.message);
    }
    logger.debug("GetChatHistory - Closed the database connection.");
  }
}

//Function to update a plugin's code specifying the ID
async function updatePluginCode(pluginId, updatedCode) {
  // Connect to the database
  let db = new sqlite3.Database("./app-database.db", (err) => {
    if (err) {
      logger.error(`UpdatePluginCode - DB connection error:\n${err.message}`);
    }
    logger.debug("UpdatePluginCode - Connected to the SQLite database.");
  });

  const dbRun = promisify(db.run).bind(db);

  try {
    // SQL query to update the plugin code
    const updatePluginSql = `UPDATE plugins SET code = ? WHERE id = ?`;

    // Execute the query with the updated code and plugin ID
    await dbRun(updatePluginSql, [updatedCode, pluginId]);

    logger.debug(
      `UpdatePluginCode - Plugin ID ${pluginId} code updated successfully.`
    );
  } catch (err) {
    logger.error(
      `UpdatePluginCode - Error updating plugin code:\n${err.message}`
    );
    throw err;
  } finally {
    try {
      // Close the database connection
      await db.close();
    } catch (err) {
      logger.error(`UpdatePluginCode - DB close error:\n${err.message}`);
    }
    logger.debug("UpdatePluginCode - Closed the database connection.");
  }
  F;
}

module.exports = {
  initDb,
  getAllPluginsFromDb,
  saveNewPluginToDb,
  getPluginById,
  saveUserRequestForExistingPlugin,
  saveChatMessage,
  getChatHistory,
  updatePluginCode,
};
