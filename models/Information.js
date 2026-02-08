const mongoose = require('mongoose');

/**
 * Information model
 *
 * This schema stores arbitrary information imported from an Excel sheet. Fields
 * such as `name`, `number` and `memberId` are defined explicitly to
 * support searching and display in the client. Any additional columns
 * present in the spreadsheet will be preserved in the `otherFields`
 * property. Using a mixed type for `otherFields` allows documents with
 * incomplete data to be stored without validation failures.
 */
const informationSchema = new mongoose.Schema(
  {
    // Person's name. May be null if the source data is missing
    name: { type: String, default: null },
    // Contact number. Stored as a string to preserve formatting. May be null
    number: { type: String, default: null },
    // Member ID assigned by the organisation. May be null
    memberId: { type: String, default: null },
    // Any extra columns from the spreadsheet are stored here
    otherFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Information', informationSchema);
