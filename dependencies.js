const { execSync } = require("child_process");
const sqlite3 = require("sqlite3").verbose();
const {logger} = require("./logger");


// Plugin dependencies installation/removal

function installDependencies(dependencies) {
    if (!dependencies) return;
  
    const depsArray = dependencies.split(",").map((dep) => dep.trim());
    console.log(`Installing dependencies: ${depsArray.join(", ")}`);
    execSync(`npm install ${depsArray.join(" ")}`, { stdio: "inherit" });
    console.log("Dependencies installed successfully.");
  }
  
  async function cleanupUnusedDependencies(dependencies) {
    if (!dependencies || dependencies.trim() === "") {
      console.log("No dependencies to clean up.");
      return;
    }
  
    const db = new sqlite3.Database("./plugin-database.db", (err) => {
      if (err) {
        console.error("DB connection error:", err.message);
      }
      console.log("Connected to the SQLite database.");
    });
  
    const dbGet = promisify(db.get).bind(db);
    const dbRun = promisify(db.run).bind(db);
    const dbClose = promisify(db.close).bind(db);
  
    try {
      for (const dependency of dependencies.split(",")) {
        const trimmedDependency = dependency.trim();
        if (trimmedDependency === "") continue;
  
        // Check if the dependency is used by any other plugin
        const row = await dbGet(
          `SELECT COUNT(*) as count FROM dependencies WHERE name = ?`,
          [trimmedDependency]
        );
  
        if (row.count === 0) {
          // Dependency is not used by any plugin, remove it
          console.log(
            `Dependency "${trimmedDependency}" is no longer used. Removing it...`
          );
          execSync(`npm remove ${trimmedDependency}`, { stdio: "inherit" });
  
          // Optionally, remove it from the dependencies table
          await dbRun(`DELETE FROM dependencies WHERE name = ?`, [
            trimmedDependency,
          ]);
        } else {
          console.log(
            `Dependency "${trimmedDependency}" is still in use by other plugins.`
          );
        }
      }
    } catch (err) {
      console.error("Error cleaning up dependencies:", err.message);
    } finally {
      try {
        await dbClose();
        console.log("Closed the database connection after cleanup.");
      } catch (err) {
        console.error("DB close error during cleanup:", err.message);
      }
    }
  }

  module.exports = {
    installDependencies,
    cleanupUnusedDependencies
  };