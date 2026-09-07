/**
 * Base62 encoding.
 *
 * Why Base62?
 *  - It uses only [0-9 a-z A-Z] (62 symbols), all of which are safe to put
 *    directly into a URL path with no percent-encoding.
 *  - It is case-sensitive, so each extra character carries log2(62) ≈ 5.95
 *    bits of information — far denser than Base16 (hex) or Base10.
 *  - A 6-character Base62 string already covers 62^6 ≈ 56.8 billion values,
 *    which comfortably ids billions of links while staying short and
 *    shareable.
 *  - Compared to hashing the URL (e.g. MD5/SHA and truncating), encoding an
 *    auto-incrementing/unique numeric ID guarantees uniqueness by
 *    construction — two different URLs can never produce the same code
 *    unless they somehow get the same DB id, which Mongo's own ID
 *    generation already prevents. Hash-based codes only get their
 *    uniqueness *statistically*, so they still need collision handling on
 *    top.
 */

const ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BASE = ALPHABET.length; // 62

function encode(number) {
  if (typeof number !== 'number' || number < 0 || !Number.isFinite(number)) {
    throw new TypeError('base62.encode expects a non-negative finite number');
  }
  if (number === 0) return ALPHABET[0];

  let n = number;
  let result = '';
  while (n > 0) {
    result = ALPHABET[n % BASE] + result;
    n = Math.floor(n / BASE);
  }
  return result;
}

function decode(str) {
  let result = 0;
  for (const char of str) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base62 character: "${char}"`);
    }
    result = result * BASE + index;
  }
  return result;
}

module.exports = { encode, decode, ALPHABET, BASE };
