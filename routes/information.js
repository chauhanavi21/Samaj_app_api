const express = require('express');
const router = express.Router();

const Information = require('../models/Information');
const { protect } = require('../middleware/auth');

/**
 * GET /api/information/search
 *
 * Returns a list of information records whose `name` field matches the
 * query string. Partial, case–insensitive matching is used. Only the
 * `_id` and `name` fields are returned to keep the payload lightweight.
 *
 * Example: /api/information/search?name=John
 */
router.get('/search', protect, async (req, res) => {
  try {
    const { name = '' } = req.query;
    // Build a case–insensitive regex for partial matching
    const regex = new RegExp(name, 'i');
    const results = await Information.find({ name: regex }).select('name');
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Information search failed:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/information/:id
 *
 * Returns a single information document by its MongoDB ID. If no
 * document is found a 404 response is returned. Missing fields are
 * returned as null to allow the client to gracefully handle sparse
 * records.
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const info = await Information.findById(req.params.id);
    if (!info) {
      return res
        .status(404)
        .json({ success: false, message: 'Information not found' });
    }
    res.json({ success: true, data: info });
  } catch (error) {
    console.error('Information lookup failed:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
