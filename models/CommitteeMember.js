const mongoose = require('mongoose');

const committeeMemberSchema = new mongoose.Schema(
  {
    nameEn: {
      type: String,
      required: [true, 'Name (English) is required'],
      trim: true,
    },
    nameHi: {
      type: String,
      required: [true, 'Name (Hindi) is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CommitteeMember', committeeMemberSchema);
