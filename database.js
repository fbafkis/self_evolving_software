const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const {state} = require("./utils");
const {logger} = require("./logger");


// Database management

async function initDb() {
  const db = new sqlite3.Database("./plugin-database.db", (err) => {
    if (err) {
      logger.error("InitDb: DB connection error:", err.message);
    }
    logger.debug("InitDb: connected to the SQLite database.");
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
    logger.debug("InitDb: plugins table created or already exists.");

    // Create the user_requests table
    await dbRun(`CREATE TABLE IF NOT EXISTS user_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plugin_id INTEGER,
        request TEXT NOT NULL,
        FOREIGN KEY (plugin_id) REFERENCES plugins(id)
      )`);
    logger.debug("InitDb: user requests table created or already exists.");

    // Create the dependencies table
    await dbRun(`CREATE TABLE IF NOT EXISTS dependencies (
        plugin_id INTEGER,
        name TEXT NOT NULL,
        PRIMARY KEY (plugin_id, name),
        FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
      )`);
    logger.debug("InitDb: dependencies table created or already exists.");
  } catch (err) {
    logger.error("InitDb: DB run error:", err.message);
  } finally {
    // Close the database connection
    try {
      await dbClose();
      logger.debug("InitDb: closed the database connection.");
    } catch (err) {
      logger.error("InitDb: DB close error:", err.message);
    }
  }
}

async function getAllPluginsFromDb() {
  // Connect to the database
  let db = new sqlite3.Database("./plugin-database.db", (err) => {
    if (err) {
      console.error("GetAllPluginsFromDb: DB connection error:", err.message);
    }
    console.log("Connected to the SQLite database. Get all plugins");
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
    //console.log("The JSON containing all the retrieved plugins:");
    //console.log(JSON.stringify(plugins, null, 2));
    state.pluginsJsonResult = JSON.stringify(plugins, null, 2);
    if (plugins.length === 0) state.pluginsJsonResult = "{}";
    return state.pluginsJsonResult;
  } catch (err) {
    console.error("DB all error:", err.message);
    return "{}"; // Return an empty JSON if there's an error
  } finally {
    // Close the database connection
    try {
      await dbClose();
      console.log("Closed the database connection. get all plugins");
    } catch (err) {
      console.error("DB close error:", err.message);
    }
  }
}

async function saveNewPluginToDb(plugin, userRequestString) {
  // Connect to the database
  let db = new sqlite3.Database("./plugin-database.db", (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log("Connected to the SQLite database. Save new plugin");
  });

  // Promisify the db.run and db.get methods
  const dbRun = promisify(db.run).bind(db);
  const dbGet = promisify(db.get).bind(db);

  try {
    // Insert the plugin into the plugins table
    const insertPluginSql = `INSERT INTO plugins (code, description) VALUES (?, ?)`;
    await dbRun(insertPluginSql, [plugin.code, plugin.description]);

    // Get the last inserted plugin id
    const pluginId = await new Promise((resolve, reject) => {
      db.get("SELECT last_insert_rowid() as id", (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.id);
        }
      });
    });

    // Insert the user request into the user_requests table
    const insertRequestSql = `INSERT INTO user_requests (plugin_id, request) VALUES (?, ?)`;
    await dbRun(insertRequestSql, [pluginId, userRequestString]);

    // Get the last inserted user request id
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
    console.log(`New user request ID: ${userRequestId}`);

    // Insert the dependencies into the dependencies table
    if (plugin.dependencies) {
      // Ensure dependencies is an array, even if it's a single string
      const dependencies = Array.isArray(plugin.dependencies)
        ? plugin.dependencies
        : plugin.dependencies.split(",");

      for (const dependency of dependencies) {
        const trimmedDependency = dependency.trim(); // Trim any extra spaces
        if (trimmedDependency) {
          // Ensure it's not an empty string
          const insertDependencySql = `INSERT INTO dependencies (plugin_id, name) VALUES (?, ?)`;
          await dbRun(insertDependencySql, [pluginId, trimmedDependency]);
        }
      }
      console.log(`Dependencies for plugin ID ${pluginId} saved successfully.`);
    }

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
      console.log("Closed the database connection.save new plugin");
    });
  }
}

// async function getPluginById(pluginId) {
//   // Connect to the database
//   let db = new sqlite3.Database("./plugin-database.db", (err) => {
//     if (err) {
//       console.error(err.message);
//     }
//     console.log("Connected to the SQLite database. get plugin by id");
//   });

//   // Promisify the db.get and db.all methods
//   const dbGet = promisify(db.get).bind(db);
//   const dbAll = promisify(db.all).bind(db);

//   try {
//     // Fetch the plugin code and description by ID
//     const plugin = await dbGet(`SELECT * FROM plugins WHERE id = ?`, [
//       pluginId,
//     ]);

//     // Fetch the dependencies related to this plugin
//     const dependencies = await dbAll(
//       `SELECT name FROM dependencies WHERE plugin_id = ?`,
//       [pluginId]
//     );

//     // Fetch the last user request associated with this plugin
//     const lastRequest = await dbGet(
//       `SELECT request FROM user_requests WHERE plugin_id = ? ORDER BY id DESC LIMIT 1`,
//       [pluginId]
//     );

//     return {
//       code: plugin.code,
//       dependencies: dependencies.map((dep) => dep.name),
//       request: lastRequest.request,
//     };
//   } catch (err) {
//     console.error("DB error:", err.message);
//     throw err;
//   } finally {
//     // Close the database connection
//     db.close((err) => {
//       if (err) {
//         console.error(err.message);
//       }
//       console.log("Closed the database connection. get plugin by id");
//     });
//   }
// }

async function getPluginById(pluginId) {
  let db = new sqlite3.Database("./plugin-database.db", (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log("Connected to the SQLite database. get plugin by id");
  });

  const dbGet = promisify(db.get).bind(db);
  const dbAll = promisify(db.all).bind(db);

  try {
    const plugin = await dbGet(`SELECT * FROM plugins WHERE id = ?`, [
      pluginId,
    ]);

    const dependencies = await dbAll(
      `SELECT name FROM dependencies WHERE plugin_id = ?`,
      [pluginId]
    );

    const lastRequest = await dbGet(
      `SELECT request FROM user_requests WHERE plugin_id = ? ORDER BY id DESC LIMIT 1`,
      [pluginId]
    );

    return {
      id: plugin.id,  
      code: plugin.code,
      dependencies: dependencies.map((dep) => dep.name),
      request: lastRequest.request,
    };
  } catch (err) {
    console.error("DB error:", err.message);
    throw err;
  } finally {
    try {
      await db.close();
      console.log("Closed the database connection. get plugin by id");
    } catch (err) {
      console.error("DB close error:", err.message);
    }
  }
}

async function saveUserRequestForExistingPlugin(pluginId, userRequestString) {
  // Connect to the database
  let db = new sqlite3.Database("./plugin-database.db", (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log("Connected to the SQLite database. Save user request");
  });

  // Promisify the db.run method
  const dbRun = promisify(db.run).bind(db);

  try {
    // Insert the user request into the user_requests table
    const insertRequestSql = `INSERT INTO user_requests (plugin_id, request) VALUES (?, ?)`;
    await dbRun(insertRequestSql, [pluginId, userRequestString]);

    // Get the last inserted user request id
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
    console.log(`New user request ID: ${userRequestId}`);

    // Return the new user request id
    return userRequestId;
  } catch (err) {
    console.error("DB run error:", err.message);
    throw err;
  } finally {
    // Close the database connection
    db.close((err) => {
      if (err) {
        console.error(err.message);
      }
      console.log("Closed the database connection. save user request");
    });
  }
}

module.exports = {
  initDb,
  getAllPluginsFromDb,
  saveNewPluginToDb,
  getPluginById,
  saveUserRequestForExistingPlugin,
};
