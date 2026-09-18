import app from './app';
import { connectDB, query } from './config/database';
import { env } from './config/environment';
import { logger } from './utils/logger';

const startServer = async () => {
  try {
    // Connect to database pool
    await connectDB();

    // Run a safe test query to verify connectivity
    const testResult = await query('SELECT current_database(), current_user, version()');
    const dbName = testResult.rows[0]?.current_database;
    logger.info(`PostgreSQL connected successfully to database "${dbName}".`);

    // Start Express server
    const port = env.PORT || 5000;
    app.listen(port, () => {
      logger.info(`Server running on port ${port} under ${process.env.NODE_ENV || 'development'} mode.`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Server startup failed: ${message}`);
    process.exit(1);
  }
};

// Start application
startServer();
