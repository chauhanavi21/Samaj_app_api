const express = require('express');
const { protect } = require('../middleware/auth');
const {
  COLLECTIONS,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
} = require('../config/firestore');

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
    const familyTree = await createDocument(COLLECTIONS.FAMILY_TREE, {
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
      id: familyTree.id,
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
    const familyTrees = await queryDocuments(
      COLLECTIONS.FAMILY_TREE,
      [{ field: 'createdBy', operator: '==', value: req.user.id }],
      'createdAt',
      'desc'
    );

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
    const familyTree = await getDocumentById(COLLECTIONS.FAMILY_TREE, req.params.id);

    if (!familyTree) {
      return res.status(404).json({
        success: false,
        message: 'Family tree entry not found',
      });
    }

    // Check if user owns this entry
    if (familyTree.createdBy !== req.user.id) {
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
    const familyTree = await getDocumentById(COLLECTIONS.FAMILY_TREE, req.params.id);

    if (!familyTree) {
      return res.status(404).json({
        success: false,
        message: 'Family tree entry not found',
      });
    }

    // Check if user owns this entry
    if (familyTree.createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this entry',
      });
    }

    // Build update fields
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

    const updateData = {};
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedFamilyTree = await updateDocument(COLLECTIONS.FAMILY_TREE, req.params.id, updateData);

    console.log('✅ Family tree entry updated:', {
      id: updatedFamilyTree.id,
      personName: updatedFamilyTree.personName,
    });

    res.json({
      success: true,
      message: 'Family tree entry updated successfully',
      data: updatedFamilyTree,
    });
  } catch (error) {
    console.error('Update family tree error:', error);
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
    const familyTree = await getDocumentById(COLLECTIONS.FAMILY_TREE, req.params.id);

    if (!familyTree) {
      return res.status(404).json({
        success: false,
        message: 'Family tree entry not found',
      });
    }

    // Check if user owns this entry
    if (familyTree.createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this entry',
      });
    }

    await deleteDocument(COLLECTIONS.FAMILY_TREE, req.params.id);

    console.log('✅ Family tree entry deleted:', {
      id: familyTree.id,
      personName: familyTree.personName,
    });

    res.json({
      success: true,
      message: 'Family tree entry deleted successfully',
    });
  } catch (error) {
    console.error('Delete family tree error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting family tree entry',
    });
  }
});

module.exports = router;
