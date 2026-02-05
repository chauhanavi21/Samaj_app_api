const express = require('express');

const CommitteeMember = require('../models/CommitteeMember');
const Sponsor = require('../models/Sponsor');
const SpecialOffer = require('../models/SpecialOffer');
const UpcomingEvent = require('../models/UpcomingEvent');
const SpiritualPlace = require('../models/SpiritualPlace');

const router = express.Router();

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

async function listWithPagination(model, req, res, { filter = {}, sort = { order: 1, createdAt: -1 } } = {}) {
  const { page, limit, skip } = parsePagination(req.query);

  const [total, data] = await Promise.all([
    model.countDocuments(filter),
    model
      .find(filter)
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

// Public content endpoints (no auth)
router.get('/committee', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { nameEn: { $regex: search, $options: 'i' } },
        { nameHi: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    await listWithPagination(CommitteeMember, req, res, { filter });
  } catch (error) {
    console.error('List committee error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch committee members' });
  }
});

router.get('/sponsors', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { amount: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    await listWithPagination(Sponsor, req, res, { filter });
  } catch (error) {
    console.error('List sponsors error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sponsors' });
  }
});

router.get('/offers', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { validityText: { $regex: search, $options: 'i' } },
        { badgeText: { $regex: search, $options: 'i' } },
      ];
    }

    await listWithPagination(SpecialOffer, req, res, { filter });
  } catch (error) {
    console.error('List offers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch offers' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = { isActive: true };

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

    await listWithPagination(UpcomingEvent, req, res, { filter });
  } catch (error) {
    console.error('List events error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
});

router.get('/places', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ];
    }

    await listWithPagination(SpiritualPlace, req, res, { filter });
  } catch (error) {
    console.error('List places error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch places' });
  }
});

module.exports = router;
