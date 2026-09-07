const crypto = require('crypto');
const Url = require('../models/Url');
const Click = require('../models/Click');
const cache = require('../config/redis');

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip)).digest('hex');
}

async function recordClick(urlDoc, req) {
  // Fire-and-forget-ish, but awaited so tests are deterministic.
  // clickCount is incremented atomically to avoid lost updates under
  // concurrent redirects.
  await Promise.all([
    Url.updateOne({ _id: urlDoc._id }, { $inc: { clickCount: 1 } }),
    Click.create({
      urlId: urlDoc._id,
      ipHash: hashIp(req.ip),
      userAgent: req.headers['user-agent'] || 'unknown',
      referrer: req.headers['referer'] || req.headers['referrer'] || 'direct'
    })
  ]);
}

/**
 * GET /:shortCode
 *
 * Flow:
 *   1. Check Redis (shortcode -> originalUrl).
 *      - HIT: redirect immediately, record analytics in the background.
 *      - MISS: fall through to MongoDB.
 *   2. Look up MongoDB.
 *      - Not found -> 404.
 *      - Found but inactive/expired -> 410 Gone, and purge any stale cache.
 *      - Found and valid -> populate Redis, then redirect.
 *
 * We use a 302 (temporary) redirect rather than 301 (permanent) because:
 *   - The link's target, expiry, or active status can change over time
 *     (the user can delete/deactivate it), and a 301 would get aggressively
 *     cached by browsers/CDNs, making those changes invisible to users who
 *     already visited once.
 *   - We also want every visit to actually hit our server so click
 *     analytics stay accurate — a 301 risks browsers skipping the request
 *     entirely on repeat visits.
 */
exports.redirect = async (req, res) => {
  const { shortCode } = req.params;
  const cacheKey = `shortcode:${shortCode}`;

  // 1. Try Redis first.
  const cachedUrl = await cache.get(cacheKey);
  if (cachedUrl) {
    // Cache HIT — redirect immediately. We still need the Mongo doc to log
    // a click and to double check the link hasn't expired/been disabled
    // since it was cached, so we do that lookup in parallel/after redirect.
    const doc = await Url.findOne({ shortCode });
    if (doc && doc.isActive && !doc.isExpired()) {
      res.redirect(302, cachedUrl);
      await recordClick(doc, req);
      return;
    }
    // Cache was stale (link expired/deleted/deactivated since caching) —
    // invalidate it and fall through to the normal not-found/expired path.
    await cache.del(cacheKey);
  }

  // 2. Cache MISS — go to MongoDB.
  const doc = await Url.findOne({ shortCode });

  if (!doc) {
    return res.status(404).json({ success: false, error: 'Short URL not found' });
  }

  if (!doc.isActive) {
    return res.status(410).json({ success: false, error: 'This short URL has been deactivated' });
  }

  if (doc.isExpired()) {
    return res.status(410).json({ success: false, error: 'This shortened URL has expired' });
  }

  // Valid — populate the cache for next time, then redirect.
  await cache.set(cacheKey, doc.originalUrl, CACHE_TTL_SECONDS);
  res.redirect(302, doc.originalUrl);
  await recordClick(doc, req);
};
