const mongoose = require('mongoose');

const familyTreeSchema = new mongoose.Schema({
  // The user who created this entry
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // Person's Information
  personName: {
    type: String,
    required: [true, 'Person name is required'],
    trim: true,
  },
  personPhone: {
    type: String,
    trim: true,
  },
  personDateOfBirth: {
    type: Date,
  },
  personOccupation: {
    type: String,
    trim: true,
  },
  
  // Spouse Information
  spouseName: {
    type: String,
    trim: true,
  },
  spousePhone: {
    type: String,
    trim: true,
  },
  
  // Parents Information
  fatherName: {
    type: String,
    trim: true,
  },
  fatherPhone: {
    type: String,
    trim: true,
  },
  motherName: {
    type: String,
    trim: true,
  },
  motherPhone: {
    type: String,
    trim: true,
  },
  
  // Children Information (array of objects)
  children: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
  }],
  
  // Additional Information
  address: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update updatedAt before saving
familyTreeSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('FamilyTree', familyTreeSchema);
