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

// After saving, sync occupation to AuthorizedMember
familyTreeSchema.post('save', async function(doc) {
  try {
    const AuthorizedMember = require('./AuthorizedMember');
    const User = require('./User');
    
    // Get the user who created this entry
    const user = await User.findById(doc.createdBy);
    if (!user) return;
    
    // If occupation is provided, update the authorized member
    if (doc.personOccupation) {
      // Try to find authorized member by memberId or phone
      const query = {};
      if (user.memberId) query.memberId = user.memberId;
      if (user.phone && !user.memberId) query.phoneNumber = user.phone;
      
      if (Object.keys(query).length > 0) {
        const authorizedMember = await AuthorizedMember.findOne(query);
        
        if (authorizedMember && authorizedMember.occupation !== doc.personOccupation) {
          authorizedMember.occupation = doc.personOccupation;
          await authorizedMember.save();
          console.log(`✅ Updated occupation for member ${user.memberId || user.phone}: ${doc.personOccupation}`);
        }
      }
    }
  } catch (error) {
    console.log('⚠️  Failed to sync occupation:', error.message);
  }
});

module.exports = mongoose.model('FamilyTree', familyTreeSchema);
