/**
 * Import Excel sheet with information into Firestore
 * 
 * Usage:
 * node scripts/importInformation.js <path-to-excel-file>
 * 
 * Excel file should have columns:
 * - Member_Id (or similar variations)
 * - First name
 * - middle name
 * - Last Name
 * - number (phone)
 * 
 * Optional: any other columns will be stored in otherFields
 */

const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { db, admin, COLLECTIONS, createDocument, findOneDocument } = require('../config/firestore');

function normalizeKey(key = '') {
  return String(key).trim().toLowerCase().replace(/\s+/g, ' ');
}

function readField(row, candidates) {
  const rowKeys = Object.keys(row);
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate);
    const matchedKey = rowKeys.find((k) => normalizeKey(k) === normalizedCandidate);
    if (matchedKey) return row[matchedKey];
  }
  return null;
}

function toCleanString(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

function buildFullName(firstName, middleName, lastName) {
  return [firstName, middleName, lastName].filter(Boolean).join(' ').trim() || null;
}

async function importData() {
  try {
    // Get file path from command line arguments
    const filePath = process.argv[2] || path.join(__dirname, '..', 'all_info.xls');

    console.log('📁 Reading Excel file:', filePath);

    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    console.log(`📊 Found ${rows.length} rows in Excel file`);
    console.log('🔥 Connected to Firestore');

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const firstName = toCleanString(
          readField(row, ['First name', 'first name', 'firstname', 'first_name'])
        );
        const middleName = toCleanString(
          readField(row, ['middle name', 'Middle name', 'middlename', 'middle_name'])
        );
        const lastName = toCleanString(
          readField(row, ['Last Name', 'last name', 'lastname', 'last_name'])
        );

        const memberId = toCleanString(
          readField(row, ['Member_Id', 'member_id', 'member id', 'Member ID', 'memberId'])
        );

        const number = toCleanString(
          readField(row, ['number', 'Number', 'phone', 'mobile', 'contact'])
        );

        const fullName = buildFullName(firstName, middleName, lastName);

        // Keep extra columns in otherFields
        const usedKeysNormalized = new Set(
          [
            'first name',
            'firstname',
            'first_name',
            'middle name',
            'middlename',
            'middle_name',
            'last name',
            'lastname',
            'last_name',
            'member_id',
            'member id',
            'memberid',
            'number',
            'phone',
            'mobile',
            'contact',
          ].map((k) => normalizeKey(k))
        );

        const otherFields = {};
        Object.keys(row).forEach((key) => {
          if (!usedKeysNormalized.has(normalizeKey(key))) {
            const val = toCleanString(row[key]);
            if (val) {
              otherFields[key] = val;
            }
          }
        });

        // Check if already exists (by memberId)
        if (memberId) {
          const existing = await findOneDocument(COLLECTIONS.INFORMATION, [
            { field: 'memberId', operator: '==', value: memberId }
          ]);

          if (existing) {
            console.log(`ℹ️  Row ${i + 1}: Member ${memberId} already exists - skipping`);
            skippedCount++;
            continue;
          }
        }

        // Create information document
        const infoData = {};

        if (memberId) infoData.memberId = memberId;
        if (firstName) infoData.firstName = firstName;
        if (middleName) infoData.middleName = middleName;
        if (lastName) infoData.lastName = lastName;
        if (fullName) infoData.fullName = fullName;
        if (number) infoData.number = number;
        if (Object.keys(otherFields).length > 0) infoData.otherFields = otherFields;

        await createDocument(COLLECTIONS.INFORMATION, infoData);

        successCount++;
        console.log(`✅ Row ${i + 1}: Imported ${fullName || memberId || 'entry'}`);

      } catch (error) {
        errorCount++;
        const errorMsg = `Row ${i + 1}: ${error.message}`;
        errors.push(errorMsg);
        console.log(`❌ ${errorMsg}`);
      }
    }

    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`✅ Successfully imported: ${successCount}`);
    console.log(`ℹ️  Skipped (already exists): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total rows processed: ${rows.length}`);

    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(err => console.log(err));
    }

    console.log('\n✅ Import complete');
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run import
importData();
