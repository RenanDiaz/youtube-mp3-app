const logger = require('./logger');

let isShuttingDown = false;

function gracefulShutdown(server, signal) {
  return async () => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Wait for existing connections to close (max 30 seconds)
    const shutdownTimeout = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);

    try {
      // Close any open resources here
      // e.g., database connections, job queues, etc.

      // For now, just close the server
      logger.info('All resources closed successfully');

      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  };
}

module.exports = gracefulShutdown;
