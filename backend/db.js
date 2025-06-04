const { MongoClient, ServerApiVersion } = require('mongodb');
const { MONGODB_URI } = require('./config');

let client;
let db;

async function connectToDB() {
  if (db) return db; // Already connected

  client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  await client.connect();
  db = client.db('kpopdle');
  return db;
}

async function getFromDB(dataset) {
  try {
    const db = await connectToDB();
    const idols = db.collection(dataset);
    const allIdols = await idols.find({}).toArray();
    return allIdols;
  } catch (err) {
    console.error('Error fetching'+ dataset +':', err);
    return [];
  }
}

async function saveAnswers(entries) {
  try {
    const db = await connectToDB();
    const collection = db.collection('dailyAnswers');
    await collection.insertMany(entries);
  } catch (err) {
    console.error('Error saving answers:', err);
  }
}

async function closeClient() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { getFromDB, saveAnswers, closeClient };
