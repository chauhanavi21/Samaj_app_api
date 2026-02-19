const { db, auth, admin } = require('../firebase');

/**
 * Firestore Helper Functions
 * These functions provide a clean interface for Firestore operations
 * similar to Mongoose methods
 */

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  AUTHORIZED_MEMBERS: 'authorizedMembers',
  FAMILY_TREE: 'familyTree',
  INFORMATION: 'information',
  COMMITTEE_MEMBERS: 'committeeMembers',
  GALLERY_IMAGES: 'galleryImages',
  SPONSORS: 'sponsors',
  SPIRITUAL_PLACES: 'spiritualPlaces',
  SPECIAL_OFFERS: 'specialOffers',
  UPCOMING_EVENTS: 'upcomingEvents',
};

/**
 * Generic Firestore CRUD operations
 */

// Create a new document
async function createDocument(collectionName, data, docId = null) {
  const timestamp = admin.firestore.Timestamp.now();
  const documentData = {
    ...data,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (docId) {
    await db.collection(collectionName).doc(docId).set(documentData);
    return { id: docId, ...documentData };
  } else {
    const docRef = await db.collection(collectionName).add(documentData);
    return { id: docRef.id, ...documentData };
  }
}

// Get a document by ID
async function getDocumentById(collectionName, docId) {
  const doc = await db.collection(collectionName).doc(docId).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
}

// Get documents by field
async function getDocumentsByField(collectionName, field, value) {
  const snapshot = await db.collection(collectionName).where(field, '==', value).get();
  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Get all documents in a collection
async function getAllDocuments(collectionName, orderByField = null, orderDirection = 'asc') {
  let query = db.collection(collectionName);
  
  if (orderByField) {
    query = query.orderBy(orderByField, orderDirection);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Update a document
async function updateDocument(collectionName, docId, data) {
  const timestamp = admin.firestore.Timestamp.now();
  const updateData = {
    ...data,
    updatedAt: timestamp,
  };

  await db.collection(collectionName).doc(docId).update(updateData);
  return await getDocumentById(collectionName, docId);
}

// Delete a document
async function deleteDocument(collectionName, docId) {
  await db.collection(collectionName).doc(docId).delete();
  return { id: docId };
}

// Query documents with complex conditions
async function queryDocuments(collectionName, conditions = [], orderByField = null, orderDirection = 'asc', limit = null) {
  let query = db.collection(collectionName);

  // Apply where conditions
  conditions.forEach(({ field, operator, value }) => {
    query = query.where(field, operator, value);
  });

  // Apply ordering
  if (orderByField) {
    query = query.orderBy(orderByField, orderDirection);
  }

  // Apply limit
  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Check if document exists
async function documentExists(collectionName, docId) {
  const doc = await db.collection(collectionName).doc(docId).get();
  return doc.exists;
}

// Count documents in a collection
async function countDocuments(collectionName, conditions = []) {
  let query = db.collection(collectionName);
  
  conditions.forEach(({ field, operator, value }) => {
    query = query.where(field, operator, value);
  });
  
  const snapshot = await query.get();
  return snapshot.size;
}

// Find one document by conditions
async function findOneDocument(collectionName, conditions) {
  const results = await queryDocuments(collectionName, conditions, null, 'asc', 1);
  return results.length > 0 ? results[0] : null;
}

// Batch operations
async function batchWrite(operations) {
  const batch = db.batch();
  const timestamp = admin.firestore.Timestamp.now();

  operations.forEach(({ type, collectionName, docId, data }) => {
    const docRef = db.collection(collectionName).doc(docId);

    switch (type) {
      case 'set':
        batch.set(docRef, { ...data, createdAt: timestamp, updatedAt: timestamp });
        break;
      case 'update':
        batch.update(docRef, { ...data, updatedAt: timestamp });
        break;
      case 'delete':
        batch.delete(docRef);
        break;
    }
  });

  await batch.commit();
}

// Pagination helper
async function getPaginatedDocuments(collectionName, pageSize = 10, lastDocId = null, orderByField = 'createdAt') {
  let query = db.collection(collectionName).orderBy(orderByField, 'desc').limit(pageSize);

  if (lastDocId) {
    const lastDoc = await db.collection(collectionName).doc(lastDocId).get();
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc);
    }
  }

  const snapshot = await query.get();
  const documents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];

  return {
    documents,
    lastDocId: lastVisible ? lastVisible.id : null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

// Convert Firestore timestamp to ISO string
function timestampToDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000);
  }
  if (timestamp.toDate) {
    return timestamp.toDate();
  }
  return timestamp;
}

// Convert date to Firestore timestamp
function dateToTimestamp(date) {
  if (!date) return null;
  if (date instanceof Date) {
    return admin.firestore.Timestamp.fromDate(date);
  }
  if (typeof date === 'string' || typeof date === 'number') {
    return admin.firestore.Timestamp.fromDate(new Date(date));
  }
  return date;
}

module.exports = {
  db,
  auth,
  admin,
  COLLECTIONS,
  createDocument,
  getDocumentById,
  getDocumentsByField,
  getAllDocuments,
  updateDocument,
  deleteDocument,
  queryDocuments,
  documentExists,
  countDocuments,
  findOneDocument,
  batchWrite,
  getPaginatedDocuments,
  timestampToDate,
  dateToTimestamp,
};
