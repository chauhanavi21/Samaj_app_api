const mongoose = require('mongoose');

const sponsorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Sponsor name is required'],
      trim: true,
    },
    amount: {
      type: String,
      required: [true, 'Amount is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
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

module.exports = mongoose.model('Sponsor', sponsorSchema);
