const { createClient } = require('redis');

/**
 * Redis is a CACHE, not a source of truth. If it is down, unreachable, or
 * simply not configured, the app must keep working by falling back to
 * MongoDB directly. This wrapper hides that fallback behind a tiny API
 * (get/set/del) so the rest of the app never has to check "is Redis up?".
 */
class CacheClient {
  constructor() {
    this.client = null;
    this.isReady = false;
  }

  async connect() {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.client = createClient({ url });

    this.client.on('error', (err) => {
      // Log once per failure burst, never crash the process.
      if (this.isReady) console.error('[Redis] error:', err.message);
      this.isReady = false;
    });

    this.client.on('ready', () => {
      this.isReady = true;
      console.log('[Redis] connected');
    });

    try {
      await this.client.connect();
    } catch (err) {
      console.warn('[Redis] could not connect, continuing without cache:', err.message);
      this.isReady = false;
    }
  }

  async get(key) {
    if (!this.isReady) return null;
    try {
      return await this.client.get(key);
    } catch (err) {
      console.warn('[Redis] GET failed, falling back to DB:', err.message);
      return null;
    }
  }

  async set(key, value, ttlSeconds) {
    if (!this.isReady) return;
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, { EX: ttlSeconds });
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      console.warn('[Redis] SET failed:', err.message);
    }
  }

  async del(key) {
    if (!this.isReady) return;
    try {
      await this.client.del(key);
    } catch (err) {
      console.warn('[Redis] DEL failed:', err.message);
    }
  }

  async incr(key) {
    if (!this.isReady) return null;
    try {
      return await this.client.incr(key);
    } catch (err) {
      console.warn('[Redis] INCR failed:', err.message);
      return null;
    }
  }
}

module.exports = new CacheClient();
