import { MongoClient, Db } from 'mongodb';

const DB_NAME = 'shudkara';

let client: MongoClient | null = null;
let cachedDb: Db | null = null;
let indexesCreated = false;

export async function connectToMongo(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  if (!client) {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    await client.connect();
    cachedDb = client.db(DB_NAME);
  }

  if (!indexesCreated && cachedDb) {
    indexesCreated = true;
    // Create token index for ultra-fast <1ms session authentication queries
    cachedDb.collection('sessions').createIndex({ token: 1 }, { unique: true }).catch(err => {
      console.error('Failed to create session index:', err);
    });
  }

  return cachedDb!;
}

// Extract token from request - uses X-Session-Token to avoid SWA proxy stripping Authorization header
export function extractToken(request: { headers: { get: (key: string) => string | null } }): string {
  const custom = request.headers.get('X-Session-Token') || '';
  if (custom.trim()) return custom.trim();
  const auth = request.headers.get('Authorization') || '';
  return auth.replace('Bearer ', '').trim();
}

/**
 * Verify session token validity and apply sliding expiration renewal.
 * Extends session by 365 days if remaining validity drops below 180 days.
 */
export async function verifySession(token: string | null): Promise<boolean> {
  if (!token || !token.trim()) return false;

  const db = await connectToMongo();
  const cleanToken = token.trim();
  const session = await db.collection('sessions').findOne({ token: cleanToken });

  if (!session) return false;

  const now = Date.now();
  const expiresAt = new Date(session.expiresAt);

  if (expiresAt.getTime() < now) {
    // Session explicitly expired — delete from DB
    await db.collection('sessions').deleteOne({ token: cleanToken });
    return false;
  }

  // Sliding session renewal: automatically extend session validity to 365 days if remaining validity < 180 days
  const daysRemaining = (expiresAt.getTime() - now) / (1000 * 60 * 60 * 24);
  if (daysRemaining < 180) {
    const newExpiresAt = new Date(now + 365 * 24 * 60 * 60 * 1000); // +1 Year
    db.collection('sessions').updateOne(
      { token: cleanToken },
      { $set: { expiresAt: newExpiresAt } }
    ).catch(err => {
      console.error('Failed to apply sliding session renewal:', err);
    });
  }

  return true;
}
