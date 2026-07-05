const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let isConnected = false;
let fallbackStore = null;

// JSON File fallback database for standalone local execution if MongoDB isn't running
class JSONFallbackDB {
  constructor() {
    this.filepath = path.join(__dirname, 'fallback_db.json');
    if (!fs.existsSync(this.filepath)) {
      fs.writeFileSync(this.filepath, JSON.stringify({ users: [], reports: [], templates: [] }, null, 2));
    }
  }

  read() {
    try {
      const content = fs.readFileSync(this.filepath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return { users: [], reports: [], templates: [] };
    }
  }

  write(data) {
    fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2));
  }

  async getCollection(name) {
    const db = this.read();
    if (!db[name]) {
      db[name] = [];
      this.write(db);
    }
    return db[name];
  }

  async save(name, item) {
    const db = this.read();
    if (!db[name]) db[name] = [];
    if (!item.id && !item._id) {
      item._id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
    const id = item._id || item.id;
    const idx = db[name].findIndex(x => (x._id || x.id) === id);
    item.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      db[name][idx] = { ...db[name][idx], ...item };
    } else {
      item.createdAt = new Date().toISOString();
      db[name].push(item);
    }
    this.write(db);
    return item;
  }

  async delete(name, id) {
    const db = this.read();
    if (!db[name]) return false;
    const initialLen = db[name].length;
    db[name] = db[name].filter(x => (x._id || x.id) !== id);
    this.write(db);
    return db[name].length < initialLen;
  }
}

async function connectDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/activity_reports';
  console.log(`Attempting to connect to MongoDB at: ${mongoUri.replace(/:([^@]+)@/, ':****@')}`);
  
  try {
    // Attempt connection with a short 3-second timeout
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000
    });
    isConnected = true;
    console.log('MongoDB connected successfully.');
  } catch (err) {
    console.warn('------------------------------------------------------------');
    console.warn('WARNING: Failed to connect to MongoDB.');
    console.warn('Falling back to local JSON file database (fallback_db.json).');
    console.warn('All features will remain fully functional!');
    console.warn('------------------------------------------------------------');
    isConnected = false;
    fallbackStore = new JSONFallbackDB();
  }
}

function getFallbackStore() {
  if (!isConnected && !fallbackStore) {
    fallbackStore = new JSONFallbackDB();
  }
  return fallbackStore;
}

module.exports = {
  connectDB,
  isConnected: () => isConnected,
  getFallbackStore
};
