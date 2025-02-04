//SERVER
import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';

//DEPS
import { uid, time } from 'ak-tools';
import path from 'path';

//LOGGING
import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';

//ENV
import dotenv from 'dotenv';
dotenv.config();
const { NODE_ENV = "", SERVICE_NAME = 'my-service', SERVICE_VERSION = '1.0.0' } = process.env;
if (!NODE_ENV) throw new Error("NODE_ENV is required");

// Temp Directory
let TEMP_DIR = NODE_ENV === 'dev' ? './tmp' : '/tmp';
TEMP_DIR = path.resolve(TEMP_DIR);

// Logging Configuration
const createLogger = () => {
  const transports = [];
  const formats = [
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    NODE_ENV === 'production' 
      ? winston.format.json() 
      : winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.simple()
        )
  ];

  // Cloud Logging Transport (for production)
  if (NODE_ENV === 'production') {
    const loggingWinston = new LoggingWinston({
      serviceContext: {
        service: SERVICE_NAME,
        version: SERVICE_VERSION
      },
      defaultCallback: (err) => {
        if (err) {
          console.error('Cloud logging error:', err);
        }
      }
    });
    transports.push(loggingWinston);
  }

  // Console Transport (for development)
  if (NODE_ENV !== 'production') {
    transports.push(new winston.transports.Console());
  }

  return winston.createLogger({
    level: NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(...formats),
    transports
  });
};

// Global Logger
const logger = createLogger();

// Express and Socket.IO Setup
const app = express();
const httpServer = createServer(app);
let io = null;
let activeSocket = null;

// Logging Middleware
async function setupLoggingMiddleware(app) {
  // Import this dynamically to avoid issues in non-GCP environments
  const { express: loggingExpress } = await import('@google-cloud/logging-winston');
  
  // Create middleware for request logging
  const mw = await loggingExpress.makeMiddleware(logger);
  app.use(mw);
}

// Initialize Server
async function initServer() {
  // Setup logging middleware
  if (NODE_ENV === 'production') {
    await setupLoggingMiddleware(app);
  }

  // Socket.IO Configuration
  io = new Server(httpServer, {
    cors: {
      origin: NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') || [] 
        : "*",
      methods: ["GET", "POST"]
    }
  });

  // WebSocket connection handler
  io.on('connection', (socket) => {
    activeSocket = socket;
    logger.info('Client connected', { 
      socketId: socket.id 
    });

    const jobTimer = time('job');
    jobTimer.start();

    socket.on('start_job', async (data) => {
      try {
        const jobId = uid(4);
        const { directive = "" } = data;
        if (!directive) {
          socket.emit('error', { error: "directive is required" });
          return;
        }

        // Log job start with trace context
        logger.info(`Starting job: ${directive}`, { 
          jobId, 
          directive, 
          data 
        });

        socket.emit('job_update', `\nrunning macro: ${directive}\n`);

        const job = route(directive, data);
        const result = await job();
        jobTimer.end();
        result.stats = jobTimer.report(false);

        // Log job completion
        logger.info(`Job completed: ${directive}`, { 
          jobId, 
          result: result.status, 
          duration: result.stats.human 
        });

        socket.emit('job_update', `\nfinished macro: ${directive}\n`);
        socket.emit('job_complete', result);

      } catch (error) {
        // Log errors with full stack trace
        logger.error(`Job error: ${error.message}`, {
          error: {
            message: error.message,
            stack: error.stack
          }
        });
        socket.emit('error', error.message);
      }
    });

    socket.on('disconnect', () => {
      activeSocket = null;
      logger.info('Client disconnected', { 
        socketId: socket.id 
      });
    });
  });

  // Serve static files
  app.use(express.static('ui'));

  // API routes with logging
  app.get('/ping', (req, res) => {
    res.json({ status: "ok", message: "service is alive", echo: req.query.data });
  });

  // Catch-all for SPA routing
  app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'ui' });
  });
}

// Websocket job router
function route(directive, data) {
  let jobFunc;
  switch (directive) {
    case 'ping':
      jobFunc = async () => {
        return { status: "ok", message: "service is alive", echo: data };
      };
      break;
    default:
      throw new Error(`No job found for directive: ${directive}`);
  }

  return jobFunc;
}

// Centralized logging function
function log(anything, socket = activeSocket) {
  // Log to console in dev
  if (NODE_ENV === 'dev') {
    console.log(anything);
  }


  // If socket is provided, emit to that socket
  if (socket) {
    socket.emit('job_update', anything);
  }
}

// Error handling for unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Graceful shutdown
  process.exit(1);
});

// Start server only if run directly
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  initServer().then(() => {
    const port = process.env.PORT || 8080;
    httpServer.listen(port, () => {
      logger.info(`Server started`, {
        environment: NODE_ENV,
        port,
        tempDir: TEMP_DIR
      });
    });
  }).catch(error => {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  });
}

// Export logger and log function
export { logger, log };