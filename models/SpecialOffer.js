const mongoose = require('mongoose');

const specialOfferSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    validityText: {
      type: String,
      required: [true, 'Date/validity text is required'],
      trim: true,
    },
    badgeText: {
      type: String,
      required: [true, 'Badge/value text is required'],
      trim: true,
    },
    badgeColor: {
      type: String,
      trim: true,
      default: '#FF8C00',
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

module.exports = mongoose.model('SpecialOffer', specialOfferSchema);
