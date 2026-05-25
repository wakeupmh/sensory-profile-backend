import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';

import assessmentRoutes from './interfaces/http/routes/assessmentRoutes';
import anamneseRoutes from './interfaces/http/routes/anamneseRoutes';
import draftRoutes from './interfaces/http/routes/draftRoutes';
import childRoutes from './interfaces/http/routes/childRoutes';
import dailyLogRoutes from './interfaces/http/routes/dailyLogRoutes';
import therapyRoutes from './interfaces/http/routes/therapyRoutes';
import medicalRoutes from './interfaces/http/routes/medicalRoutes';
import developmentRoutes from './interfaces/http/routes/developmentRoutes';
import educationRoutes from './interfaces/http/routes/educationRoutes';
import consolidatedReportRoutes from './interfaces/http/routes/consolidatedReportRoutes';
import { 
  errorHandler, 
  notFoundHandler, 
  setupGracefulShutdown,
  requestIdMiddleware,
  requestLogger
} from './infrastructure/utils/errors/ErrorHandler';
import logger from './infrastructure/utils/logger';

dotenv.config();

function validateEnv() {
  const required: string[] = [];
  if (!process.env.DATABASE_URL) required.push('DATABASE_URL');
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SUPABASE_URL) required.push('SUPABASE_URL');
    if (!process.env.FRONTEND_URL) required.push('FRONTEND_URL');
  }
  if (required.length > 0) {
    console.error(`Missing required env vars: ${required.join(', ')}`);
    process.exit(1);
  }
}
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Request ID and logging middleware (before everything else)
app.use(requestIdMiddleware);
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(cors({
  origin: process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL]
    : process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      type: 'RateLimitError',
      message: 'Too many requests from this IP, please try again later.',
      statusCode: 429,
      timestamp: new Date().toISOString()
    }
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    memory: process.memoryUsage(),
    requestId: req.headers['x-request-id']
  };
  
  res.status(200).json(healthInfo);
});

// API routes
app.use('/api/assessments', assessmentRoutes);
app.use('/api/anamneses', anamneseRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/children', childRoutes);
app.use('/api/logs', dailyLogRoutes);
app.use('/api/therapy', therapyRoutes);
app.use('/api/medical', medicalRoutes);
app.use('/api/development', developmentRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/consolidated', consolidatedReportRoutes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server started successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    uptime: process.uptime()
  });
});

setupGracefulShutdown(server);

// Handle server startup errors
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

export default app;