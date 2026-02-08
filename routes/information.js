const express = require('express');
const router = express.Router();

const Information = require('../models/Information');
const { protect } = require('../middleware/auth');

/**
 * GET /api/information/search?name=<query>
 *
 * Supports:
 * - first name
 * - first + last
 * - first + middle + last
 */
router.get('/search', protect, async (req, res) => {
  try {
    const raw = String(req.query.name || '').trim();

    if (!raw) {
      return res.json({ success: true, data: [] });
    }

    // Token-based flexible search
    const tokens = raw.split(/\s+/).filter(Boolean);

    const tokenRegexConds = tokens.map((t) => ({
      $or: [
        { firstName: { $regex: t, $options: 'i' } },
        { middleName: { $regex: t, $options: 'i' } },
        { lastName: { $regex: t, $options: 'i' } },
        { fullName: { $regex: t, $options: 'i' } },
      ],
    }));

    const fullRegex = new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const query = {
      $or: [
        { fullName: { $regex: fullRegex } },
        { $and: tokenRegexConds }, // all tokens must match somewhere in name fields
      ],
    };

    const results = await Information.find(query)
      .select('firstName middleName lastName fullName memberId number')
      .limit(100);

    return res.json({ success: true, data: results });
  } catch (error) {
    console.error('Information search failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/information/:id
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const info = await Information.findById(req.params.id).select(
      'firstName middleName lastName fullName memberId number otherFields'
    );

    if (!info) {
      return res.status(404).json({ success: false, message: 'Information not found' });
    }

    return res.json({ success: true, data: info });
  } catch (error) {
    console.error('Information lookup failed:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
