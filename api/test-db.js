const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Load settings
let uri = 'mongodb+srv://shudarsanregmi555_db_user:tQUcibBMsYlPL7pc@cluster0.bi4u2mq.mongodb.net/?appName=Cluster0';
try {
  const settingsPath = path.join(__dirname, 'local.settings.json');
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.Values && settings.Values.MONGODB_URI) {
      uri = settings.Values.MONGODB_URI;
    }
  }
} catch (err) {}

async function run() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected successfully!');
    const db = client.db('shudkara'); // explicit database name
    
    // Check auth configs
    const auths = await db.collection('auth').find({}).toArray();
    console.log('\n--- AUTH CONFIGS ---');
    console.log(JSON.stringify(auths, null, 2));

    // Check sessions
    const sessions = await db.collection('sessions').find({}).toArray();
    console.log('\n--- ACTIVE SESSIONS ---');
    console.log(JSON.stringify(sessions, null, 2));

    // Check links count
    const linksCount = await db.collection('links').countDocuments();
    console.log(`\nLinks count: ${linksCount}`);

  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    await client.close();
  }
}

run();
