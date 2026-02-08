/*
 * Import script: all_info.xlsx -> information collection
 *
 * Place all_info.xlsx in backend root folder.
 * Run:
 *   npm install xlsx
 *   npm run import-info
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const xlsx = require('xlsx');

const Information = require('../models/Information');


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
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('Missing Mongo URI. Set MONGO_URI or DATABASE in env/config.env');
    }

    await mongoose.connect(mongoUri);

    const filePath = path.join(__dirname, '..', 'all_info.xls');
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];

    // defval:null keeps rows even when cells are missing
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

    const docs = rows.map((row) => {
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
          otherFields[key] = row[key];
        }
      });

      return {
        firstName,
        middleName,
        lastName,
        fullName,
        memberId,
        number,
        otherFields,
      };
    });

    // User asked to remove wrong data and reinsert correct mapping
    await Information.deleteMany({});
    await Information.insertMany(docs);

    console.log(`Imported ${docs.length} records into Information collection`);
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importData();
