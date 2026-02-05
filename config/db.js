const mongoose = require('mongoose');

async function cleanupLegacyUniqueIndexes() {
  try {
    // Loaded lazily to avoid circular deps during startup
    const User = require('../models/User');
    if (!User?.collection || !User?.schema?.paths) return;

    const allowedFields = new Set(Object.keys(User.schema.paths));
    const indexes = await User.collection.indexes();

    const legacyUniqueIndexes = indexes.filter((idx) => {
      if (!idx?.unique) return false;
      if (!idx?.key || typeof idx.key !== 'object') return false;
      // Never drop Mongo's primary index
      if (idx.name === '_id_') return false;
      // If any indexed field isn't part of the current schema, it's legacy.
      return Object.keys(idx.key).some((field) => !allowedFields.has(field));
    });

    for (const idx of legacyUniqueIndexes) {
      await User.collection.dropIndex(idx.name);
      console.log(`🧹 Dropped legacy unique index: ${idx.name}`);
    }
  } catch (error) {
    // Best-effort cleanup; never block startup.
    const message = error?.message || String(error);
    if (message.includes('index not found') || message.includes('ns not found')) return;
    console.log('🧹 Legacy unique-index cleanup skipped:', message);
  }
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // If this DB had old unique indexes on fields no longer in the schema,
    // they can block new signups (e.g., duplicate key on null).
    await cleanupLegacyUniqueIndexes();
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
