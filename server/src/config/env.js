const path = require('path');
const dotenv = require('dotenv');

// Attempt to load .env from the server root directory and current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Required environment variables validation
const requiredVars = ['JWT_SECRET', 'MONGODB_URI'];
const missingVars = requiredVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(
    `[Configuration Error] Missing required environment variables: ${missingVars.join(
      ', '
    )}. Please ensure these are defined in your .env file.`
  );
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT, 10) || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_COOKIE_EXPIRES_IN = parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 7;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || 'vorldxteam@gmail.com').trim().toLowerCase();
const SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '';
const QR_TOKEN_EXPIRES_SECONDS = parseInt(process.env.QR_TOKEN_EXPIRES_SECONDS, 10) || 30;
const QR_REFRESH_INTERVAL_SECONDS = parseInt(process.env.QR_REFRESH_INTERVAL_SECONDS, 10) || 30;
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const isDevelopment = NODE_ENV === 'development';
const isProduction = NODE_ENV === 'production';

const config = {
  NODE_ENV,
  PORT,
  MONGODB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_COOKIE_EXPIRES_IN,
  CLIENT_URL,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD_HASH,
  QR_TOKEN_EXPIRES_SECONDS,
  QR_REFRESH_INTERVAL_SECONDS,
  DEMO_MODE,
  isDevelopment,
  isProduction
};

module.exports = config;
