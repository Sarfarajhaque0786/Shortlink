const mongoose = require('mongoose');

/**
 * MongoDB ObjectIds are not sequential integers, so we can't Base62-encode
 * them directly and get short, incrementing codes. Instead we keep a single
 * counter document and atomically increment it with $inc + findOneAndUpdate,
 * which Mongo guarantees is atomic even under concurrent requests. The
 * resulting integer is what gets Base62-encoded into a short code.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "urlId"
  seq: { type: Number, default: 100000 }  // start high so early codes aren't 1-2 chars
});

const Counter = mongoose.model('Counter', counterSchema);

async function getNextSequence(name) {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

module.exports = { Counter, getNextSequence };
