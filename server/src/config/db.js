const dns = require('dns');
// Use public DNS to ensure Atlas SRV resolution works across all local ISP/Windows DNS configurations
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // fallback to system default
}

const mongoose = require('mongoose');
const { MONGODB_URI } = require('./env');

/**
 * Connect to MongoDB instance using Mongoose
 * Logs connection details and handles connection failures
 * @returns {Promise<typeof mongoose>}
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });

    const host = conn.connection.host;
    const port = conn.connection.port;
    const dbName = conn.connection.name;

    console.log(`[Database] MongoDB Connected successfully to: ${host}:${port}/${dbName}`);
    return conn;
  } catch (error) {
    console.warn(`[Database Warning] Atlas connection failed (${error.message}). Falling back to local MongoDB...`);
    try {
      const localUri = 'mongodb://localhost:27017/vorldx-attendance';
      const conn = await mongoose.connect(localUri, { autoIndex: true });
      console.log(`[Database] Fallback Connected successfully to Local MongoDB: ${conn.connection.host}:${conn.connection.port}`);
      return conn;
    } catch (localErr) {
      console.error(`[Database Error] Local MongoDB also failed: ${localErr.message}`);
      process.exit(1);
    }
  }
};

// Listen to connection events
mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB connection disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('[Database] MongoDB reconnected');
});

module.exports = {
  connectDB,
  mongoose
};
