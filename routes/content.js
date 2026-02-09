const express = require('express');
const {
  COLLECTIONS,
  getAllDocuments,
  queryDocuments,
  countDocuments,
} = require('../config/firestore');

const router = express.Router();

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

async function listWithPagination(collectionName, req, res, { searchFields = [] } = {}) {
  const { page, limit, skip } = parsePagination(req.query);
  const search = String(req.query.search || '').trim();

  // Get active documents
  let data = await queryDocuments(
    collectionName,
    [{ field: 'isActive', operator: '==', value: true }],
    'order',
    'asc'
  );
  
  // Apply search filter
  if (search && searchFields.length > 0) {
    const searchLower = search.toLowerCase();
    data = data.filter(doc =>
      searchFields.some(field => doc[field]?.toLowerCase().includes(searchLower))
    );
  }

  const total = data.length;
  const paginatedData = data.slice(skip, skip + limit);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    success: true,
    data: paginatedData,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    },
  });
}

// Public content endpoints (no auth)
router.get('/committee', async (req, res) => {
  try {
    await listWithPagination(COLLECTIONS.COMMITTEE_MEMBERS, req, res, {
      searchFields: ['nameEn', 'nameHi', 'city', 'phone']
    });
  } catch (error) {
    console.error('List committee error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch committee members' });
  }
});

router.get('/sponsors', async (req, res) => {
  try {
    await listWithPagination(COLLECTIONS.SPONSORS, req, res, {
      searchFields: ['name', 'amount', 'phone']
    });
  } catch (error) {
    console.error('List sponsors error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sponsors' });
  }
});

router.get('/offers', async (req, res) => {
  try {
    await listWithPagination(COLLECTIONS.SPECIAL_OFFERS, req, res, {
      searchFields: ['title', 'description', 'category', 'validityText', 'badgeText']
    });
  } catch (error) {
    console.error('List offers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch offers' });
  }
});

router.get('/events', async (req, res) => {
  try {
    await listWithPagination(COLLECTIONS.UPCOMING_EVENTS, req, res, {
      searchFields: ['category', 'title', 'date', 'time', 'location', 'description']
    });
  } catch (error) {
    console.error('List events error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
});

router.get('/places', async (req, res) => {
  try {
    await listWithPagination(COLLECTIONS.SPIRITUAL_PLACES, req, res, {
      searchFields: ['name', 'address']
    });
  } catch (error) {
    console.error('List places error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch places' });
  }
});

module.exports = router;
