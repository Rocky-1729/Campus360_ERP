import app from './app';
import { connectDB } from './config/database';
import { env } from './config/environment';
import { logger } from './utils/logger';

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

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
