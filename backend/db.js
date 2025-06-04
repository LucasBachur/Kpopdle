const { MongoClient, ServerApiVersion } = require('mongodb');
const { MONGODB_URI } = require('./config');
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function getFromDB(dataset) {
  try {
    await client.connect();
    const db = client.db('kpopdle');
    const idols = db.collection(dataset);

    const allIdols = await idols.find({}).toArray();
    return allIdols;
  } catch (err) {
    console.error('Error fetching'+ dataset +':', err);
    return [];
  } finally {
    await client.close();
  }
}

async function saveAnswers(entries) {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('kpopdle');
  const collection = db.collection('dailyAnswers');
  await collection.insertMany(entries);
  await client.close();
}


module.exports = { getFromDB, saveAnswers };
