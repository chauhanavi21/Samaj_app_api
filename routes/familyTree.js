const express = require('express');
const FamilyTree = require('../models/FamilyTree');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected (require authentication)
router.use(protect);

// @route   POST /api/family-tree
// @desc    Create a new family tree entry
// @access  Private
router.post('/', async (req, res) => {
  try {
    const {
      personName,
      personPhone,
      personDateOfBirth,
      personOccupation,
      spouseName,
      spousePhone,
      fatherName,
      fatherPhone,
      motherName,
      motherPhone,
      children,
      address,
      notes,
    } = req.body;

    // Validation
    if (!personName) {
      return res.status(400).json({
        success: false,
        message: 'Person name is required',
      });
    }

    // Create family tree entry
    const familyTree = await FamilyTree.create({
      createdBy: req.user.id,
      personName,
      personPhone: personPhone || '',
      personDateOfBirth: personDateOfBirth || null,
      personOccupation: personOccupation || '',
      spouseName: spouseName || '',
      spousePhone: spousePhone || '',
      fatherName: fatherName || '',
      fatherPhone: fatherPhone || '',
      motherName: motherName || '',
      motherPhone: motherPhone || '',
      children: children || [],
      address: address || '',
      notes: notes || '',
    });

    console.log('✅ Family tree entry created:', {
      id: familyTree._id,
      personName: familyTree.personName,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Family tree entry created successfully',
      data: familyTree,
    });
  } catch (error) {
    console.error('Create family tree error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message).join(', ');
      return res.status(400).json({
        success: false,
        message: messages || 'Validation error',
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating family tree entry',
    });
  }
});

// @route   GET /api/family-tree
// @desc    Get all family tree entries for logged-in user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const familyTrees = await FamilyTree.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email memberId');

    res.json({
      success: true,
      count: familyTrees.length,
      data: familyTrees,
    });
  } catch (error) {
    console.error('Get family trees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching family tree entries',
    });
  }
});

// @route   GET /api/family-tree/:id
// @desc    Get a single family tree entry by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const familyTree = await FamilyTree.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!familyTree) {
      return res.status(404).json({
        success: false,
        message: 'Family tree entry not found',
      });
    }

    // Check if user owns this entry
    if (familyTree.createdBy._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this entry',
      });
    }

    res.json({
      success: true,
      data: familyTree,
    });
  } catch (error) {
    console.error('Get family tree error:', error);
    
    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Family tree entry not found',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching family tree entry',
    });
  }
});

// @route   PUT /api/family-tree/:id
// @desc    Update a family tree entry
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    let familyTree = await FamilyTree.findById(req.params.id);

    if (!familyTree) {
      return res.status(404).json({
        success: false,
        message: 'Family tree entry not found',
      });
    }

    // Check if user owns this entry
    if (familyTree.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this entry',
      });
    }

    // Update fields
    const updateFields = [
      'personName',
      'personPhone',
      'personDateOfBirth',
      'personOccupation',
      'spouseName',
      'spousePhone',
      'fatherName',
      'fatherPhone',
      'motherName',
      'motherPhone',
      'children',
      'address',
      'notes',
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        familyTree[field] = req.body[field];
      }
    });

    await familyTree.save();

    console.log('✅ Family tree entry updated:', {
      id: familyTree._id,
      personName: familyTree.personName,
    });

    res.json({
      success: true,
      message: 'Family tree entry updated successfully',
      data: familyTree,
    });
  } catch (error) {
    console.error('Update family tree error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message).join(', ');
      return res.status(400).json({
        success: false,
        message: messages || 'Validation error',
      });
    }
    
    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Family tree entry not found',
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating family tree entry',
    });
  }
});

// @route   DELETE /api/family-tree/:id
// @desc    Delete a family tree entry
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const familyTree = await FamilyTree.findById(req.params.id);

    if (!familyTree) {
      return res.status(404).json({
        success: false,
        message: 'Family tree entry not found',
      });
    }

    // Check if user owns this entry
    if (familyTree.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this entry',
      });
    }

    await familyTree.deleteOne();

    console.log('✅ Family tree entry deleted:', {
      id: familyTree._id,
      personName: familyTree.personName,
    });

    res.json({
      success: true,
      message: 'Family tree entry deleted successfully',
    });
  } catch (error) {
    console.error('Delete family tree error:', error);
    
    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Family tree entry not found',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting family tree entry',
    });
  }
});

module.exports = router;
