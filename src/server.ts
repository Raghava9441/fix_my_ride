// src/server.ts
import { config } from "./config/environment";
import { logger } from "./config/logger";
import {
  connectDatabase,
  disconnectDatabase,
  checkDatabaseHealth,
  setupGracefulShutdown,
} from "./config/database";
import app from "./app";

// Global variables
let server: any;
let isShuttingDown = false;

// ========================================
// Server Initialization
// ========================================
const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Create HTTP server
    server = app.listen(config.port, config.host, () => {
      logger.info(`
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      🚀 Vehicle Service SaaS Server Started Successfully!
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      📍 Environment:     ${config.env}
      🌐 URL:            ${config.appUrl}
      🔌 Port:           ${config.port}
      🗄️  Database:       ${config.db.name}
      🧪 Health Check:   ${config.appUrl}/health
      📚 API Docs:       ${config.appUrl}/api/docs
      
      ⚡ Server is ready to handle requests
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });

    // Server timeout configuration
    server.timeout = 120000; // 2 minutes
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Handle server errors
    server.on("error", (error: any) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      switch (error.code) {
        case "EACCES":
          logger.error(`Port ${config.port} requires elevated privileges`);
          process.exit(1);
          break;
        case "EADDRINUSE":
          logger.error(`Port ${config.port} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Setup graceful shutdown using database module
    setupGracefulShutdown(server);
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// ========================================
// Application Bootstrap
// ========================================
startServer().catch((error) => {
  logger.error("Failed to bootstrap application:", error);
  process.exit(1);
});

// Export for testing
export { server };
