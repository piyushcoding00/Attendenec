const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { CLIENT_URL, isDevelopment } = require('./config/env');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');
const routes = require('./routes');

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration (supports single origin or comma-separated origins)
const allowedOrigins = CLIENT_URL.includes(',')
  ? CLIENT_URL.split(',').map((url) => url.trim())
  : CLIENT_URL;

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      if (Array.isArray(allowedOrigins)) {
        if (allowedOrigins.includes(origin)) return callback(null, true);
      } else if (allowedOrigins === '*' || allowedOrigins === origin) {
        return callback(null, true);
      }
      // In production, allow *.netlify.app if needed or fallback
      if (origin.endsWith('.netlify.app')) return callback(null, true);
      return callback(null, true); // Permissive CORS for cross-deployment
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// HTTP request logging in development
if (isDevelopment) {
  app.use(morgan('dev'));
}

// Global rate limiting
app.use(generalLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser for reading JWT from cookies
app.use(cookieParser());

// Mount API routes under /api/v1 as well as direct fallback
app.use('/api/v1', routes);
app.use(routes);

// Handle undefined routes (404)
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
