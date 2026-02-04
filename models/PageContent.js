const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
  },
  text: {
    type: String,
    trim: true,
  },
  imageUrl: {
    type: String,
    trim: true,
  },
  order: {
    type: Number,
    default: 0,
  },
}, { _id: true });

const pageContentSchema = new mongoose.Schema({
  pageName: {
    type: String,
    required: [true, 'Page name is required'],
    unique: true,
    trim: true,
    lowercase: true,
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
  },
  sections: [sectionSchema],
  isPublished: {
    type: Boolean,
    default: true,
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
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
pageContentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PageContent', pageContentSchema);
