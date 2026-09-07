const crypto = require('crypto');
const base62 = require('./base62');
const { getNextSequence } = require('../models/Counter');
const Url = require('../models/Url');

/**
 * Primary strategy: Base62(auto-increment id).
 * This is deterministic and collision-free by construction, since the
 * counter is incremented atomically in MongoDB.
 */
async function generateFromCounter() {
  const seq = await getNextSequence('urlId');
  return base62.encode(seq);
}

/**
 * Fallback strategy: random Base62 string.
 * Used only if we ever need a second attempt (e.g. the counter collection
 * was reset, or a code was manually inserted that clashes with a future
 * counter value). We still verify uniqueness against MongoDB with the
 * unique index as the final safety net.
 */
function generateRandom(length = 7) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += base62.ALPHABET[bytes[i] % base62.BASE];
  }
  return code;
}

/**
 * Generates a unique short code, retrying on the rare chance of a collision.
 * The MongoDB unique index on `shortCode` is the ultimate source of truth:
 * even if this function's in-memory check were somehow wrong, the DB
 * would reject a duplicate insert with a duplicate-key error (E11000),
 * which the caller can catch and retry on.
 */
async function generateUniqueShortCode({ maxAttempts = 5 } = {}) {
  // Attempt 1: sequential (fast path, no DB read needed to check collision).
  let code = await generateFromCounter();
  let existing = await Url.exists({ shortCode: code });
  if (!existing) return code;

  // Fallback attempts: random codes, checked against MongoDB.
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    code = generateRandom();
    existing = await Url.exists({ shortCode: code });
    if (!existing) return code;
  }

  throw new Error('Could not generate a unique short code after multiple attempts');
}

module.exports = { generateFromCounter, generateRandom, generateUniqueShortCode };
