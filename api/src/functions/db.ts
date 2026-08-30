import { MongoClient, Db } from 'mongodb';

const DB_NAME = 'shudkara';

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
    cachedDb = client.db(DB_NAME);
  }
  return cachedDb!;
}

// Extract token from request - uses X-Session-Token to avoid SWA proxy stripping Authorization header
export function extractToken(request: { headers: { get: (key: string) => string | null } }): string {
  // Try custom header first (not stripped by Azure SWA proxy)
  const custom = request.headers.get('X-Session-Token') || '';
  if (custom.trim()) return custom.trim();
  // Fallback to Authorization header
  const auth = request.headers.get('Authorization') || '';
  return auth.replace('Bearer ', '').trim();
}

export async function verifySession(token: string | null): Promise<boolean> {
  if (!token) return false;
  const db = await connectToMongo();
  const session = await db.collection('sessions').findOne({ token: token.trim() });
  if (!session) return false;

  const expiresAt = new Date(session.expiresAt);
  if (expiresAt.getTime() < Date.now()) {
    await db.collection('sessions').deleteOne({ token: token.trim() });
    return false;
  }
  return true;
}
