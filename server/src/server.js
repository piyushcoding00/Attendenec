/**
 * Catch uncaught exceptions before loading other modules
 */
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION] 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Load environment configuration first
const config = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./app');

/**
 * Connect to database and start Express HTTP server
 */
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Start HTTP listener
    const server = app.listen(config.PORT, () => {
      console.log('==================================================');
      console.log(`  🚀 VorldX Attendance Server is running`);
      console.log(`  📡 Port:        ${config.PORT}`);
      console.log(`  🌍 Environment: ${config.NODE_ENV}`);
      console.log(`  🔗 Health Check: http://localhost:${config.PORT}/api/v1/health`);
      console.log(`  💻 Client URL:  ${config.CLIENT_URL}`);
      console.log('==================================================');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('[UNHANDLED REJECTION] 💥 Shutting down server gracefully...');
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle graceful shutdown on SIGTERM
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM received. Closing HTTP server...');
      server.close(() => {
        console.log('💥 Process terminated.');
      });
    });

    // Handle graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('\n👋 SIGINT received. Closing HTTP server...');
      server.close(() => {
        console.log('💥 Process terminated.');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('[STARTUP ERROR] 💥 Failed to initialize server:', error);
    process.exit(1);
  }
};

startServer();
