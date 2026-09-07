const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const User = require('../models/User');

const SALT_ROUNDS = 12;

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'name, email and password are required' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }

    // NEVER store plain-text passwords — bcrypt hashes with a per-password
    // salt baked in, so identical passwords still produce different hashes.
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({ name, email: email.toLowerCase(), passwordHash });
    const token = signToken(user);

    return res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }
    console.error('register error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = signToken(user);
    return res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.me = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  return res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, createdAt: user.createdAt } });
};
