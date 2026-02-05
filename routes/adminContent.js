const express = require('express');

const { protect, authorize } = require('../middleware/auth');

const CommitteeMember = require('../models/CommitteeMember');
const Sponsor = require('../models/Sponsor');
const SpecialOffer = require('../models/SpecialOffer');
const UpcomingEvent = require('../models/UpcomingEvent');
const SpiritualPlace = require('../models/SpiritualPlace');

const router = express.Router();

router.use(protect, authorize('admin'));

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

async function listAdmin(model, req, res, { filter = {}, sort = { order: 1, createdAt: -1 } } = {}) {
  const { page, limit, skip } = parsePagination(req.query);
  const search = String(req.query.search || '').trim();

  const queryFilter = { ...filter };
  if (search) {
    // caller can pass a $or on filter; if not, just ignore
  }

  const [total, data] = await Promise.all([
    model.countDocuments(queryFilter),
    model
      .find(queryFilter)
      .sort(sort)
      .skip(skip)
      .limit(limit),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    success: true,
    data,
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
    const search = String(req.query.search || '').trim();
    const filter = {};
    if (search) {
      filter.$or = [
        { nameEn: { $regex: search, $options: 'i' } },
        { nameHi: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    await listAdmin(CommitteeMember, req, res, { filter });
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

    const created = await CommitteeMember.create({
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
    const updated = await CommitteeMember.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.nameEn !== undefined ? { nameEn: req.body.nameEn } : {}),
        ...(req.body.nameHi !== undefined ? { nameHi: req.body.nameHi } : {}),
        ...(req.body.phone !== undefined ? { phone: req.body.phone } : {}),
        ...(req.body.city !== undefined ? { city: req.body.city } : {}),
        ...(req.body.order !== undefined ? { order: Number(req.body.order) || 0 } : {}),
        ...(req.body.isActive !== undefined ? { isActive: !!req.body.isActive } : {}),
      },
      { new: true }
    );

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
    const deleted = await CommitteeMember.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Committee member not found' });
    }
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
    const search = String(req.query.search || '').trim();
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { amount: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    await listAdmin(Sponsor, req, res, { filter });
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

    const created = await Sponsor.create({
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
    const updated = await Sponsor.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.amount !== undefined ? { amount: req.body.amount } : {}),
        ...(req.body.phone !== undefined ? { phone: req.body.phone } : {}),
        ...(req.body.order !== undefined ? { order: Number(req.body.order) || 0 } : {}),
        ...(req.body.isActive !== undefined ? { isActive: !!req.body.isActive } : {}),
      },
      { new: true }
    );

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
    const deleted = await Sponsor.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Sponsor not found' });
    }
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
    const search = String(req.query.search || '').trim();
    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { validityText: { $regex: search, $options: 'i' } },
        { badgeText: { $regex: search, $options: 'i' } },
      ];
    }

    await listAdmin(SpecialOffer, req, res, { filter });
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

    const created = await SpecialOffer.create({
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
    const updated = await SpecialOffer.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.title !== undefined ? { title: req.body.title } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
        ...(req.body.category !== undefined ? { category: req.body.category } : {}),
        ...(req.body.validityText !== undefined ? { validityText: req.body.validityText } : {}),
        ...(req.body.badgeText !== undefined ? { badgeText: req.body.badgeText } : {}),
        ...(req.body.badgeColor !== undefined ? { badgeColor: req.body.badgeColor } : {}),
        ...(req.body.order !== undefined ? { order: Number(req.body.order) || 0 } : {}),
        ...(req.body.isActive !== undefined ? { isActive: !!req.body.isActive } : {}),
      },
      { new: true }
    );

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
    const deleted = await SpecialOffer.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
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
    const search = String(req.query.search || '').trim();
    const filter = {};
    if (search) {
      filter.$or = [
        { category: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { date: { $regex: search, $options: 'i' } },
        { time: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    await listAdmin(UpcomingEvent, req, res, { filter });
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

    const created = await UpcomingEvent.create({
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
    const updated = await UpcomingEvent.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.category !== undefined ? { category: req.body.category } : {}),
        ...(req.body.title !== undefined ? { title: req.body.title } : {}),
        ...(req.body.date !== undefined ? { date: req.body.date } : {}),
        ...(req.body.time !== undefined ? { time: req.body.time } : {}),
        ...(req.body.location !== undefined ? { location: req.body.location } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
        ...(req.body.order !== undefined ? { order: Number(req.body.order) || 0 } : {}),
        ...(req.body.isActive !== undefined ? { isActive: !!req.body.isActive } : {}),
      },
      { new: true }
    );

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
    const deleted = await UpcomingEvent.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
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
    const search = String(req.query.search || '').trim();
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ];
    }

    await listAdmin(SpiritualPlace, req, res, { filter });
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

    const created = await SpiritualPlace.create({
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
    const updated = await SpiritualPlace.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.address !== undefined ? { address: req.body.address } : {}),
        ...(req.body.googleMapsLink !== undefined ? { googleMapsLink: req.body.googleMapsLink } : {}),
        ...(req.body.order !== undefined ? { order: Number(req.body.order) || 0 } : {}),
        ...(req.body.isActive !== undefined ? { isActive: !!req.body.isActive } : {}),
      },
      { new: true }
    );

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
    const deleted = await SpiritualPlace.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Place not found' });
    }
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Admin delete place error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete place' });
  }
});

module.exports = router;
