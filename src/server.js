require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const cache = require('./config/redis');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await cache.connect(); // never throws — falls back gracefully if unavailable

  app.listen(PORT, () => {
    console.log(`[Server] ShortLink running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
