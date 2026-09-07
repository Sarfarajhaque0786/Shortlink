const mongoose = require('mongoose');

/**
 * Connects to MongoDB using Mongoose.
 * The app deliberately fails fast if MongoDB is unreachable, because
 * MongoDB is the source of truth (Redis is only a cache in front of it).
 */
async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shortlink';

  mongoose.connection.on('connected', () => {
    console.log(`[MongoDB] connected -> ${mongoose.connection.name}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] connection error:', err.message);
  });

  await mongoose.connect(uri);
  return mongoose.connection;
}

module.exports = connectDB;
