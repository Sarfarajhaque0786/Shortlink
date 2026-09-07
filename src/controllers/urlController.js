const validator = require('validator');
const QRCode = require('qrcode');
const Url = require('../models/Url');
const Click = require('../models/Click');
const cache = require('../config/redis');
const { generateUniqueShortCode } = require('../utils/shortCodeGenerator');

const ALIAS_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

function buildShortUrl(shortCode) {
  const base = process.env.BASE_URL || 'http://localhost:5000';
  return `${base}/${shortCode}`;
}

exports.createUrl = async (req, res) => {
  try {
    const { url, expiresAt, customAlias } = req.body;

    if (!url || !validator.isURL(url, { require_protocol: true })) {
      return res.status(400).json({ success: false, error: 'A valid URL (with http/https) is required' });
    }

    let shortCode;
    let isCustomAlias = false;

    if (customAlias) {
      if (!ALIAS_REGEX.test(customAlias)) {
        return res.status(400).json({
          success: false,
          error: 'Custom alias must be 3-30 characters: letters, numbers, hyphen, underscore only'
        });
      }
      if (Url.RESERVED_ALIASES.has(customAlias.toLowerCase())) {
        return res.status(409).json({ success: false, error: 'This alias is reserved' });
      }
      const clash = await Url.exists({ shortCode: customAlias });
      if (clash) {
        return res.status(409).json({ success: false, error: 'This alias is already taken' });
      }
      shortCode = customAlias;
      isCustomAlias = true;
    } else {
      shortCode = await generateUniqueShortCode();
    }

    let expiry = null;
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      if (isNaN(parsed.getTime()) || parsed <= new Date()) {
        return res.status(400).json({ success: false, error: 'expiresAt must be a valid future date' });
      }
      expiry = parsed;
    }

    let doc;
    try {
      doc = await Url.create({
        userId: req.user.id,
        originalUrl: url,
        shortCode,
        isCustomAlias,
        expiresAt: expiry
      });
    } catch (err) {
      // Collision handling: the unique index is the final safety net.
      // On a duplicate-key error for a SYSTEM-generated code, retry once
      // with a fresh code instead of failing the user's request.
      if (err.code === 11000 && !isCustomAlias) {
        shortCode = await generateUniqueShortCode();
        doc = await Url.create({
          userId: req.user.id,
          originalUrl: url,
          shortCode,
          isCustomAlias,
          expiresAt: expiry
        });
      } else if (err.code === 11000) {
        return res.status(409).json({ success: false, error: 'This alias is already taken' });
      } else {
        throw err;
      }
    }

    // Warm the cache so the very first redirect is already a cache hit.
    await cache.set(`shortcode:${shortCode}`, url, CACHE_TTL_SECONDS);

    return res.status(201).json({
      success: true,
      shortCode: doc.shortCode,
      shortUrl: buildShortUrl(doc.shortCode),
      originalUrl: doc.originalUrl,
      expiresAt: doc.expiresAt
    });
  } catch (err) {
    console.error('createUrl error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.listUrls = async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const [urls, total] = await Promise.all([
    Url.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Url.countDocuments({ userId: req.user.id })
  ]);

  return res.json({
    success: true,
    page,
    total,
    urls: urls.map((u) => ({
      shortCode: u.shortCode,
      shortUrl: buildShortUrl(u.shortCode),
      originalUrl: u.originalUrl,
      clickCount: u.clickCount,
      isActive: u.isActive,
      createdAt: u.createdAt,
      expiresAt: u.expiresAt
    }))
  });
};

exports.getStats = async (req, res) => {
  const { shortCode } = req.params;
  const doc = await Url.findOne({ shortCode, userId: req.user.id });
  if (!doc) return res.status(404).json({ success: false, error: 'Short URL not found' });

  const recentClicks = await Click.find({ urlId: doc._id })
    .sort({ clickedAt: -1 })
    .limit(20)
    .select('clickedAt referrer userAgent -_id');

  // Aggregate clicks per day for the last 14 days, for the Chart.js graph.
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const clicksOverTime = await Click.aggregate([
    { $match: { urlId: doc._id, clickedAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return res.json({
    success: true,
    originalUrl: doc.originalUrl,
    shortUrl: buildShortUrl(doc.shortCode),
    clickCount: doc.clickCount,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
    isActive: doc.isActive,
    clicksOverTime,
    recentClicks
  });
};

exports.getQrCode = async (req, res) => {
  const { shortCode } = req.params;
  const doc = await Url.findOne({ shortCode, userId: req.user.id });
  if (!doc) return res.status(404).json({ success: false, error: 'Short URL not found' });

  const dataUrl = await QRCode.toDataURL(buildShortUrl(doc.shortCode));
  return res.json({ success: true, qrCode: dataUrl });
};

exports.deleteUrl = async (req, res) => {
  const { shortCode } = req.params;
  const doc = await Url.findOneAndDelete({ shortCode, userId: req.user.id });
  if (!doc) return res.status(404).json({ success: false, error: 'Short URL not found' });

  await cache.del(`shortcode:${shortCode}`);
  return res.json({ success: true, message: 'Short URL deleted' });
};
