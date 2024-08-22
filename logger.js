const { createLogger, format, transports } = require("winston");
const { combine, timestamp, printf, colorize } = format;

// Define log format
const logFormat = printf(({ level, message, timestamp }) => {
  return `${level}: ${message}`;
});
// Create the logger with different levels
const logger = createLogger({
  format: combine(
    // Different colors for different levels
    colorize(),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat
  ),
  transports: [
    // Log to console
    new transports.Console(),
  ],
  // Default log level
  level: "info", // Default log level
});

// Function to set log level from command line argument
function setLogLevelFromArgs() {
  const args = process.argv.slice(2);
  const levelArg = args.find((arg) => arg.startsWith("--log-level="));
  if (levelArg) {
    const level = levelArg.split("=")[1];
    logger.level = level;
  }
}
// Initialize log level based on command line argument
setLogLevelFromArgs();

module.exports = logger;
