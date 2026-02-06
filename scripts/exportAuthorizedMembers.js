/**
 * Export Authorized Members to Excel
 * 
 * Creates an updated Excel file with all authorized members including occupation data
 * updated from Family Tree entries.
 * 
 * Usage:
 * node scripts/exportAuthorizedMembers.js [output-filename]
 * 
 * Example:
 * node scripts/exportAuthorizedMembers.js UPDATED_MEMBERSHIP_LIST.xlsx
 */

const XLSX = require('xlsx');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AuthorizedMember = require('../models/AuthorizedMember');

async function exportToExcel(outputPath) {
  try {
    console.log('📊 Starting export of authorized members...\n');
    
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
    
    // Fetch all authorized members
    console.log('📥 Fetching authorized members...');
    const members = await AuthorizedMember.find()
      .populate('usedBy', 'name email')
      .sort({ memberId: 1 });
    
    console.log(`✅ Found ${members.length} members\n`);
    
    if (members.length === 0) {
      console.log('⚠️  No members to export!');
      await mongoose.connection.close();
      return;
    }
    
    // Prepare data for Excel
    console.log('📝 Preparing Excel data...');
    const data = [
      // Header row
      ['Member_ID', 'Phone_Number', 'Name', 'Email', 'Occupation', 'Used', 'Used_By', 'Notes']
    ];
    
    // Add member rows
    members.forEach(member => {
      data.push([
        member.memberId || '',
        member.phoneNumber || '',
        member.name || '',
        member.email || '',
        member.occupation || '', // Occupation from Family Tree
        member.isUsed ? 'Yes' : 'No',
        member.usedBy ? member.usedBy.name : '',
        member.notes || '',
      ]);
    });
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Member_ID
      { wch: 15 }, // Phone_Number
      { wch: 20 }, // Name
      { wch: 25 }, // Email
      { wch: 20 }, // Occupation
      { wch: 8 },  // Used
      { wch: 20 }, // Used_By
      { wch: 30 }, // Notes
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    
    // Write to file
    console.log(`💾 Writing to file: ${outputPath}`);
    XLSX.writeFile(wb, outputPath);
    
    console.log('\n✅ Export completed successfully!\n');
    
    // Statistics
    const usedCount = members.filter(m => m.isUsed).length;
    const withOccupation = members.filter(m => m.occupation).length;
    
    console.log('=== EXPORT SUMMARY ===');
    console.log(`📊 Total members: ${members.length}`);
    console.log(`✅ Used members: ${usedCount}`);
    console.log(`⏳ Unused members: ${members.length - usedCount}`);
    console.log(`💼 Members with occupation: ${withOccupation}`);
    console.log(`📂 File saved: ${outputPath}`);
    console.log('======================\n');
    
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed\n');
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Get output filename from command line or use default
const outputFilename = process.argv[2] || 'UPDATED_MEMBERSHIP_LIST.xlsx';
const outputPath = path.join(__dirname, '..', outputFilename);

// Check if file exists and prompt for confirmation
if (fs.existsSync(outputPath)) {
  console.log(`\n⚠️  Warning: File '${outputFilename}' already exists and will be overwritten.\n`);
}

// Run export
exportToExcel(outputPath);
