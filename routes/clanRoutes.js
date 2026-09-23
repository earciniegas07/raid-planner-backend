const express = require('express');
const { getClans, createClan, joinClan } = require('../controllers/clanController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/').get(getClans).post(protect, createClan);
router.post('/:id/join', protect, joinClan);

module.exports = router;