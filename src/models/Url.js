const mongoose = require('mongoose');

const RESERVED_ALIASES = new Set([
  'login', 'register', 'logout', 'dashboard', 'api', 'admin', 'stats',
  'health', 'favicon.ico', 'assets', 'css', 'js', 'static'
]);

const urlSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalUrl: {
    type: String,
    required: true,
    trim: true
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,   // enforced at the DB level -> collision-proof
    index: true,
    trim: true
  },
  isCustomAlias: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  },
  clickCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Compound/secondary indexes for common query patterns.
urlSchema.index({ userId: 1, createdAt: -1 }); // "my links, newest first"
urlSchema.index({ expiresAt: 1 });             // scanning for expired links

urlSchema.statics.RESERVED_ALIASES = RESERVED_ALIASES;

urlSchema.methods.isExpired = function () {
  return this.expiresAt ? new Date() > this.expiresAt : false;
};

module.exports = mongoose.model('Url', urlSchema);
