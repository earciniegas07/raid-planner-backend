const express = require('express');
const { getRaids, createRaid } = require('../controllers/raidController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/')
  .get(getRaids)
  .post(protect, createRaid);

module.exports = router;