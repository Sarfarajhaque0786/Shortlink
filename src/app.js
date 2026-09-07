const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/authRoutes');
const urlRoutes = require('./routes/urlRoutes');
const { redirect } = require('./controllers/redirectController');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // relax CSP for simple static frontend
app.use(cors());
app.use(express.json());
app.use(apiLimiter);

// Static frontend (dashboard, login/register pages)
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/urls', urlRoutes);

// Public redirect route — must come after /api routes and static files so
// it doesn't shadow them, but before the 404 handler.
app.get('/:shortCode', redirect);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

module.exports = app;
