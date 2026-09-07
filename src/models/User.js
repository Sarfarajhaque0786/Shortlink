const mongoose = require('mongoose');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: 2,
    maxlength: 60
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Invalid email address']
  },
  passwordHash: {
    type: String,
    required: true,
    select: false // never returned by default queries
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index on email is already created by `unique: true` above, but declared
// explicitly here for clarity / documentation purposes.
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
