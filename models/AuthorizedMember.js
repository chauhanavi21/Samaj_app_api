const mongoose = require('mongoose');

const authorizedMemberSchema = new mongoose.Schema({
  memberId: {
    type: String,
    trim: true,
    sparse: true,
    unique: true,
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  // Occupation filled from Family Tree entries
  occupation: {
    type: String,
    trim: true,
  },
  // Optional fields from Excel that might be useful
  name: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  // To track if this member has already signed up
  isUsed: {
    type: Boolean,
    default: false,
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  usedAt: {
    type: Date,
  },
  // Metadata
  importedAt: {
    type: Date,
    default: Date.now,
  },
  importedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  notes: {
    type: String,
  },
});

// Index for faster lookups
authorizedMemberSchema.index({ memberId: 1, phoneNumber: 1 });

// Method to mark member as used
authorizedMemberSchema.methods.markAsUsed = function(userId) {
  this.isUsed = true;
  this.usedBy = userId;
  this.usedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('AuthorizedMember', authorizedMemberSchema);
