import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToMongo(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    cachedDb = client.db();
  }
  return cachedDb!;
}

export async function verifySession(token: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    const db = await connectToMongo();
    const session = await db.collection('sessions').findOne({ token: token.trim() });
    if (!session) return false;
    
    const expiresAt = new Date(session.expiresAt);
    if (expiresAt.getTime() < Date.now()) {
      await db.collection('sessions').deleteOne({ token: token.trim() });
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
