/**
 * Import Excel sheet with authorized members into MongoDB
 * 
 * Usage:
 * node scripts/importAuthorizedMembers.js <path-to-excel-file>
 * 
 * Excel file should have columns: memberId, phoneNumber
 * Optional columns: name, email, notes
 */

const XLSX = require('xlsx');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AuthorizedMember = require('../models/AuthorizedMember');

async function importExcelData(filePath) {
  try {
    console.log('📁 Reading Excel file:', filePath);
    
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Found ${data.length} rows in Excel file`);
    
    if (data.length === 0) {
      console.log('⚠️  No data found in Excel file');
      return;
    }
    
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables. Please set MONGO_URI or MONGODB_URI in .env file');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Map common column name variations (case-insensitive with more patterns)
      const memberId = String(
        row.memberId || row.memberid || row.MemberId || row.MemberID || 
        row.member_id || row.MEMBER_ID || row.Member_ID || row['Member ID'] || 
        row['Member_ID'] || ''
      ).trim();
      
      const phoneNumber = String(
        row.phoneNumber || row.phonenumber || row.PhoneNumber || row.phone || 
        row.Phone || row.mobile || row.Mobile || row['Phone Number'] || 
        row.Phone_Number || row['Phone_Number'] || row.PHONE_NUMBER || ''
      ).trim();
      
      const name = String(
        row.name || row.Name || row.NAME || row.fullName || row.FullName || ''
      ).trim();
      
      const email = String(
        row.email || row.Email || row.EMAIL || ''
      ).trim().toLowerCase();
      
      const notes = String(
        row.notes || row.Notes || row.remarks || row.Remarks || ''
      ).trim();
      
      // Validate required fields - accept if at least one exists
      if (!memberId && !phoneNumber) {
        console.log(`⚠️  Row ${i + 1}: Both memberId and phoneNumber missing - skipping`);
        skippedCount++;
        continue;
      }
      
      // Log partial data
      if (!memberId) {
        console.log(`ℹ️  Row ${i + 1}: No memberId, importing with phone only: ${phoneNumber}`);
      } else if (!phoneNumber) {
        console.log(`ℹ️  Row ${i + 1}: No phone, importing with memberId only: ${memberId}`);
      }
      
      try {
        // Check if member already exists (by memberId or phoneNumber)
        const query = {};
        if (memberId) query.memberId = memberId;
        if (phoneNumber && !memberId) query.phoneNumber = phoneNumber;
        
        const existing = await AuthorizedMember.findOne(query);
        
        if (existing) {
          const identifier = memberId || phoneNumber;
          console.log(`ℹ️  Row ${i + 1}: Member ${identifier} already exists - skipping`);
          skippedCount++;
          continue;
        }
        
        // Create new authorized member
        await AuthorizedMember.create({
          memberId: memberId || undefined,
          phoneNumber: phoneNumber || undefined,
          name: name || undefined,
          email: email || undefined,
          notes: notes || undefined,
        });
        
        successCount++;
        console.log(`✅ Row ${i + 1}: Imported member ${memberId}`);
        
      } catch (error) {
        errorCount++;
        const errorMsg = `Row ${i + 1} (${memberId}): ${error.message}`;
        errors.push(errorMsg);
        console.log(`❌ ${errorMsg}`);
      }
    }
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`✅ Successfully imported: ${successCount}`);
    console.log(`ℹ️  Skipped (already exists): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total rows processed: ${data.length}`);
    
    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(err => console.log(err));
    }
    
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Get file path from command line arguments
const filePath = process.argv[2];

if (!filePath) {
  console.log('❌ Error: Please provide Excel file path');
  console.log('\nUsage:');
  console.log('  node scripts/importAuthorizedMembers.js <path-to-excel-file>');
  console.log('\nExample:');
  console.log('  node scripts/importAuthorizedMembers.js ./members.xlsx');
  console.log('\nExcel file should have columns:');
  console.log('  - memberId (required)');
  console.log('  - phoneNumber (required)');
  console.log('  - name (optional)');
  console.log('  - email (optional)');
  console.log('  - notes (optional)');
  process.exit(1);
}

// Check if file exists
const fs = require('fs');
if (!fs.existsSync(filePath)) {
  console.log(`❌ Error: File not found: ${filePath}`);
  process.exit(1);
}

// Run import
importExcelData(filePath);
