const db = new sqlite3.Database('./plugins.db'); // Replace with your database path

class Plugin {
    constructor(id, name, code, description) {
      this.id = id;
      this.name = name;
      this.code = code;
      this.description = description;
    }
  
    // Implement functionality to execute the plugin code
    // (implementation depends on your plugin format)
    async execute(userRequest) {
      // ... (load code, execute logic with userRequest)
    }
  }



// Plugin functions
function getAllPlugins() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM plugins', (err, rows) => {
      if (err) {
        return reject(err);
      }
      const plugins = rows.map((row) => new Plugin(row.id, row.name, row.code, row.description));
      resolve(plugins);
    });
  });
}

function getPluginById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM plugins WHERE id = ?', [id], (err, row) => {
      if (err) {
        return reject(err);
      }
      if (row) {
        resolve(new Plugin(row.id, row.name, row.code, row.description));
      } else {
        resolve(null); // Plugin not found
      }
    });
  });
}

function addPlugin(name, code, description) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO plugins (name, code, description) VALUES (?, ?, ?)', [name, code, description], (err) => {
      if (err) {
        return reject(err);
      }
      resolve(); // Plugin added successfully (no ID returned here)
    });
  });
}

function removePlugin(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM plugins WHERE id = ?', [id], (err) => {
      if (err) {
        return reject(err);
      }
      resolve(); // Plugin removed successfully (no confirmation of existence)
    });
  });
}

// Plugin history functions
function addPluginHistory(pluginId, userRequest) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    db.run('INSERT INTO plugin_history (plugin_id, user_request, timestamp) VALUES (?, ?, ?)', [pluginId, userRequest, timestamp], (err) => {
      if (err) {
        return reject(err);
      }
      resolve(); // History entry added successfully (no ID returned)
    });
  });
}

function getPluginHistory(pluginId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM plugin_history WHERE plugin_id = ?', [pluginId], (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows); // Array of history objects
    });
  });
}