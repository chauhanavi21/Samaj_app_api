const mongoose = require('mongoose');

/**
 * Information model aligned with Excel columns:
 * - Member_Id
 * - First name
 * - middle name
 * - Last Name
 * - number
 *
 * We keep normalized fields for searching/display, plus optional raw backup.
 */
const informationSchema = new mongoose.Schema(
  {
    // Excel: Member_Id
    memberId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // Excel: First name
    firstName: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // Excel: middle name
    middleName: {
      type: String,
      default: null,
      trim: true,
    },

    // Excel: Last Name
    lastName: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // Computed from first/middle/last
    fullName: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // Excel: number
    number: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // Preserve any extra columns from Excel
    otherFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Information', informationSchema);
