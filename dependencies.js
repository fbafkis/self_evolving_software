const { execSync } = require("child_process");
const sqlite3 = require("sqlite3").verbose();
const logger = require("./logger");

// Function to install the dependencies
function installDependencies(dependencies) {
  if (!dependencies) return;
  // Create the array of dependences
  const depsArray = dependencies.split(",").map((dep) => dep.trim());
  logger.debug(
    `InstallDependencies - Installing dependencies: ${depsArray.join(", ")}`
  );
  // Executing the npm install command
  execSync(`npm install ${depsArray.join(" ")}`, { stdio: "inherit" });
  logger.debug("InstallDependencies - Dependencies installed successfully.");
}

// Function to remove the unused dependencies
async function cleanupUnusedDependencies(dependencies) {
  if (!dependencies || dependencies.trim() === "") {
    logger.debug("InstallDependencies - No dependencies to clean up.");
    return;
  }
  // Database objects
  const db = new sqlite3.Database("./plugin-database.db", (err) => {
    if (err) {
      logger.error("InstallDependencies - DB connection error:", err.message);
    }
    logger.debug("InstallDependencies - Connected to the SQLite database.");
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
      // The dependency is not used by any plugin, remove it
      if (row.count === 0) {
        logger.debug(
          `InstallDependencies - Dependency "${trimmedDependency}" is no longer used. Removing it...`
        );
        // Running the npm remove command
        execSync(`npm remove ${trimmedDependency}`, { stdio: "inherit" });
        // Remove the dependencies from the dependencies table (they shouldn't be there since in this case they must be related to a new plugin, but anyway...)
        await dbRun(`DELETE FROM dependencies WHERE name = ?`, [
          trimmedDependency,
        ]);
        // The dependency is associated to another plugin that exists, so it doesn't have to be removed
      } else {
        logger.debug(
          `InstallDependencies - Dependency "${trimmedDependency}" is still in use by other plugins.`
        );
      }
    }
  } catch (err) {
    logger.error(
      "InstallDependencies - Error cleaning up dependencies:\n" + err.message
    );
  } finally {
    try {
      await dbClose();
      logger.debug(
        "InstallDependencies - Closed the database connection after cleanup."
      );
    } catch (err) {
      logger.error(
        "InstallDependencies - DB close error during cleanup:\n" + err.message
      );
    }
  }
}

module.exports = {
  installDependencies,
  cleanupUnusedDependencies,
};
