const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
  urlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Url',
    required: true,
    index: true
  },
  clickedAt: {
    type: Date,
    default: Date.now
  },
  // We store a SHA-256 hash of the IP, never the raw IP, so click records
  // can't be used to directly identify or track a visitor.
  ipHash: {
    type: String
  },
  userAgent: {
    type: String
  },
  referrer: {
    type: String,
    default: 'direct'
  }
});

clickSchema.index({ urlId: 1, clickedAt: -1 });

module.exports = mongoose.model('Click', clickSchema);
