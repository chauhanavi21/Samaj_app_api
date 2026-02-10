const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  COLLECTIONS,
  getDocumentById,
  getAllDocuments,
} = require('../config/firestore');

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

    const normalize = (value) => {
      const s = String(value || '');
      return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normalizedQuery = normalize(raw);
    if (!normalizedQuery) {
      return res.json({ success: true, data: [] });
    }

    // Get all information documents
    const allInfo = await getAllDocuments(COLLECTIONS.INFORMATION);
    
    // Token-based flexible search
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    
    // Filter results based on tokens
    const results = allInfo.filter(doc => {
      const firstName = normalize(doc.firstName);
      const middleName = normalize(doc.middleName);
      const lastName = normalize(doc.lastName);
      const fullName = normalize(doc.fullName);
      
      // Check if full name matches
      if (fullName.includes(normalizedQuery)) return true;
      
      // Check if all tokens match somewhere in name fields
      const allTokensMatch = tokens.every(token =>
        firstName.includes(token) ||
        middleName.includes(token) ||
        lastName.includes(token) ||
        fullName.includes(token)
      );
      
      return allTokensMatch;
    }).slice(0, 100); // Limit to 100 results
    
    // Only return necessary fields
    const limitedResults = results.map(doc => ({
      id: doc.id,
      firstName: doc.firstName,
      middleName: doc.middleName,
      lastName: doc.lastName,
      fullName: doc.fullName,
      memberId: doc.memberId,
      number: doc.number,
    }));

    return res.json({ success: true, data: limitedResults });
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
    const info = await getDocumentById(COLLECTIONS.INFORMATION, req.params.id);

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
