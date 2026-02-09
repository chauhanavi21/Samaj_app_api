const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  COLLECTIONS,
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  countDocuments,
} = require('../config/firestore');

const router = express.Router();

router.use(protect, authorize('admin'));

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

async function listAdmin(collectionName, req, res, { sort = { order: 1, createdAt: -1 }, searchFields = [] } = {}) {
  const { page, limit, skip } = parsePagination(req.query);
  const search = String(req.query.search || '').trim();

  // Get all documents
  let data = await getAllDocuments(collectionName, 'order', 'asc');
  
  // Apply search filter
  if (search && searchFields.length > 0) {
    const searchLower = search.toLowerCase();
    data = data.filter((doc) =>
      searchFields.some((field) => String(doc?.[field] ?? '').toLowerCase().includes(searchLower))
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

function requireFields(body, fields) {
  for (const field of fields) {
    if (!String(body?.[field] ?? '').trim()) {
      return field;
    }
  }
  return null;
}

// -----------------------------
// Committee
// -----------------------------
router.get('/committee', async (req, res) => {
  try {
    await listAdmin(COLLECTIONS.COMMITTEE_MEMBERS, req, res, {
      searchFields: ['nameEn', 'nameHi', 'city', 'phone']
    });
  } catch (error) {
    console.error('Admin list committee error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch committee members' });
  }
});

router.post('/committee', async (req, res) => {
  try {
    const missing = requireFields(req.body, ['nameEn', 'nameHi', 'phone', 'city']);
    if (missing) {
      return res.status(400).json({ success: false, message: `Missing required field: ${missing}` });
    }

    const created = await createDocument(COLLECTIONS.COMMITTEE_MEMBERS, {
      nameEn: req.body.nameEn,
      nameHi: req.body.nameHi,
      phone: req.body.phone,
      city: req.body.city,
      order: Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0,
      isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Admin create committee error:', error);
    res.status(500).json({ success: false, message: 'Failed to create committee member' });
  }
});

router.put('/committee/:id', async (req, res) => {
  try {
    const updateData = {};
    if (req.body.nameEn !== undefined) updateData.nameEn = req.body.nameEn;
    if (req.body.nameHi !== undefined) updateData.nameHi = req.body.nameHi;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;
    if (req.body.city !== undefined) updateData.city = req.body.city;
    if (req.body.order !== undefined) updateData.order = Number(req.body.order) || 0;
    if (req.body.isActive !== undefined) updateData.isActive = !!req.body.isActive;

    const updated = await updateDocument(COLLECTIONS.COMMITTEE_MEMBERS, req.params.id, updateData);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Committee member not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin update committee error:', error);
    res.status(500).json({ success: false, message: 'Failed to update committee member' });
  }
});

router.delete('/committee/:id', async (req, res) => {
  try {
    await deleteDocument(COLLECTIONS.COMMITTEE_MEMBERS, req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Admin delete committee error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete committee member' });
  }
});

// -----------------------------
// Sponsors
// -----------------------------
router.get('/sponsors', async (req, res) => {
  try {
    await listAdmin(COLLECTIONS.SPONSORS, req, res, {
      searchFields: ['name', 'amount', 'phone']
    });
  } catch (error) {
    console.error('Admin list sponsors error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sponsors' });
  }
});

router.post('/sponsors', async (req, res) => {
  try {
    const missing = requireFields(req.body, ['name', 'amount', 'phone']);
    if (missing) {
      return res.status(400).json({ success: false, message: `Missing required field: ${missing}` });
    }

    const created = await createDocument(COLLECTIONS.SPONSORS, {
      name: req.body.name,
      amount: req.body.amount,
      phone: req.body.phone,
      order: Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0,
      isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Admin create sponsor error:', error);
    res.status(500).json({ success: false, message: 'Failed to create sponsor' });
  }
});

router.put('/sponsors/:id', async (req, res) => {
  try {
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.amount !== undefined) updateData.amount = req.body.amount;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;
    if (req.body.order !== undefined) updateData.order = Number(req.body.order) || 0;
    if (req.body.isActive !== undefined) updateData.isActive = !!req.body.isActive;

    const updated = await updateDocument(COLLECTIONS.SPONSORS, req.params.id, updateData);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Sponsor not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin update sponsor error:', error);
    res.status(500).json({ success: false, message: 'Failed to update sponsor' });
  }
});

router.delete('/sponsors/:id', async (req, res) => {
  try {
    await deleteDocument(COLLECTIONS.SPONSORS, req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Admin delete sponsor error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete sponsor' });
  }
});

// -----------------------------
// Offers
// -----------------------------
router.get('/offers', async (req, res) => {
  try {
    await listAdmin(COLLECTIONS.SPECIAL_OFFERS, req, res, {
      searchFields: ['title', 'description', 'category', 'validityText', 'badgeText']
    });
  } catch (error) {
    console.error('Admin list offers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch offers' });
  }
});

router.post('/offers', async (req, res) => {
  try {
    const missing = requireFields(req.body, ['title', 'description', 'category', 'validityText', 'badgeText']);
    if (missing) {
      return res.status(400).json({ success: false, message: `Missing required field: ${missing}` });
    }

    const created = await createDocument(COLLECTIONS.SPECIAL_OFFERS, {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      validityText: req.body.validityText,
      badgeText: req.body.badgeText,
      badgeColor: req.body.badgeColor || '#FF8C00',
      order: Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0,
      isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Admin create offer error:', error);
    res.status(500).json({ success: false, message: 'Failed to create offer' });
  }
});

router.put('/offers/:id', async (req, res) => {
  try {
    const updateData = {};
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.validityText !== undefined) updateData.validityText = req.body.validityText;
    if (req.body.badgeText !== undefined) updateData.badgeText = req.body.badgeText;
    if (req.body.badgeColor !== undefined) updateData.badgeColor = req.body.badgeColor;
    if (req.body.order !== undefined) updateData.order = Number(req.body.order) || 0;
    if (req.body.isActive !== undefined) updateData.isActive = !!req.body.isActive;

    const updated = await updateDocument(COLLECTIONS.SPECIAL_OFFERS, req.params.id, updateData);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin update offer error:', error);
    res.status(500).json({ success: false, message: 'Failed to update offer' });
  }
});

router.delete('/offers/:id', async (req, res) => {
  try {
    await deleteDocument(COLLECTIONS.SPECIAL_OFFERS, req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Admin delete offer error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete offer' });
  }
});

// -----------------------------
// Events
// -----------------------------
router.get('/events', async (req, res) => {
  try {
    await listAdmin(COLLECTIONS.UPCOMING_EVENTS, req, res, {
      searchFields: ['category', 'title', 'date', 'time', 'location', 'description']
    });
  } catch (error) {
    console.error('Admin list events error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
});

router.post('/events', async (req, res) => {
  try {
    const missing = requireFields(req.body, ['category', 'title', 'date', 'time', 'location', 'description']);
    if (missing) {
      return res.status(400).json({ success: false, message: `Missing required field: ${missing}` });
    }

    const created = await createDocument(COLLECTIONS.UPCOMING_EVENTS, {
      category: req.body.category,
      title: req.body.title,
      date: req.body.date,
      time: req.body.time,
      location: req.body.location,
      description: req.body.description,
      order: Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0,
      isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Admin create event error:', error);
    res.status(500).json({ success: false, message: 'Failed to create event' });
  }
});

router.put('/events/:id', async (req, res) => {
  try {
    const updateData = {};
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.date !== undefined) updateData.date = req.body.date;
    if (req.body.time !== undefined) updateData.time = req.body.time;
    if (req.body.location !== undefined) updateData.location = req.body.location;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.order !== undefined) updateData.order = Number(req.body.order) || 0;
    if (req.body.isActive !== undefined) updateData.isActive = !!req.body.isActive;

    const updated = await updateDocument(COLLECTIONS.UPCOMING_EVENTS, req.params.id, updateData);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin update event error:', error);
    res.status(500).json({ success: false, message: 'Failed to update event' });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    await deleteDocument(COLLECTIONS.UPCOMING_EVENTS, req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Admin delete event error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
});

// -----------------------------
// Spiritual Places
// -----------------------------
router.get('/places', async (req, res) => {
  try {
    await listAdmin(COLLECTIONS.SPIRITUAL_PLACES, req, res, {
      searchFields: ['name', 'address']
    });
  } catch (error) {
    console.error('Admin list places error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch places' });
  }
});

router.post('/places', async (req, res) => {
  try {
    const missing = requireFields(req.body, ['name', 'address']);
    if (missing) {
      return res.status(400).json({ success: false, message: `Missing required field: ${missing}` });
    }

    const created = await createDocument(COLLECTIONS.SPIRITUAL_PLACES, {
      name: req.body.name,
      address: req.body.address,
      googleMapsLink: req.body.googleMapsLink || '',
      order: Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0,
      isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Admin create place error:', error);
    res.status(500).json({ success: false, message: 'Failed to create place' });
  }
});

router.put('/places/:id', async (req, res) => {
  try {
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.address !== undefined) updateData.address = req.body.address;
    if (req.body.googleMapsLink !== undefined) updateData.googleMapsLink = req.body.googleMapsLink;
    if (req.body.order !== undefined) updateData.order = Number(req.body.order) || 0;
    if (req.body.isActive !== undefined) updateData.isActive = !!req.body.isActive;

    const updated = await updateDocument(COLLECTIONS.SPIRITUAL_PLACES, req.params.id, updateData);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Place not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin update place error:', error);
    res.status(500).json({ success: false, message: 'Failed to update place' });
  }
});

router.delete('/places/:id', async (req, res) => {
  try {
    await deleteDocument(COLLECTIONS.SPIRITUAL_PLACES, req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Admin delete place error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete place' });
  }
});

module.exports = router;
