/*
 * Script to import information from an Excel workbook into MongoDB.
 *
 * The script expects a file named `all_info.xlsx` to be located in the
 * root of the project (one level above this script). Each row of the
 * first worksheet is treated as a record. The columns `name`, `number`
 * and `memberId` are mapped explicitly. All other columns are stored
 * under `otherFields` on the Information model. Missing values are
 * preserved as null.
 *
 * Usage: npm run import-info
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const xlsx = require('xlsx');

const Information = require('../models/Information');


async function importData() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error(
        'No MongoDB connection string found in environment variables (MONGO_URI or DATABASE)'
      );
    }
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Determine file path. Assumes `all_info.xlsx` sits in the root of the repository
    const filePath = path.join(__dirname, '..', 'all_info.xls');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      // defval ensures missing cells become null instead of undefined
      defval: null,
    });

    // Prepare documents for insertion
    const documents = rows.map((row) => {
      const { name, Name, number, phone, memberId, memberID, ...rest } = row;
      // Support various column naming conventions by falling back to
      // uppercase/lowercase variants
      const doc = {
        name: name || Name || null,
        number: number || phone || null,
        memberId: memberId || memberID || null,
        otherFields: rest,
      };
      return doc;
    });

    // Remove existing documents to avoid duplicates. Comment out this line if
    // incremental imports are desired.
    await Information.deleteMany();
    await Information.insertMany(documents);

    console.log(`Imported ${documents.length} records into Information collection`);
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
}

importData();
