const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const {
  createUrl,
  listUrls,
  getStats,
  getQrCode,
  deleteUrl
} = require('../controllers/urlController');

router.use(requireAuth);

router.post('/', createUrl);
router.get('/', listUrls);
router.get('/:shortCode/stats', getStats);
router.get('/:shortCode/qrcode', getQrCode);
router.delete('/:shortCode', deleteUrl);

module.exports = router;
