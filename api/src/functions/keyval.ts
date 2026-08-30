import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { connectToMongo, verifySession } from './db';

interface KeyValPair {
  key: string;
  value: string;
  updatedAt: Date;
}

export async function keyValHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const targetKey = request.params.key;

  try {
    const db = await connectToMongo();
    const col = db.collection('keyval');

    // 1. GET - Fetch key-values (publicly readable)
    if (method === 'GET') {
      if (targetKey) {
        const pair = await col.findOne({ key: targetKey.trim() });
        if (!pair) {
          return { status: 404, jsonBody: { error: 'Key not found.' } };
        }
        return {
          status: 200,
          jsonBody: { key: pair.key, value: pair.value, updatedAt: pair.updatedAt }
        };
      }
      
      const pairs = await col.find({}).toArray();
      const cleaned = pairs.map(p => ({
        key: p.key,
        value: p.value,
        updatedAt: p.updatedAt
      }));
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: cleaned
      };
    }

    // Auth validation for all write/delete operations
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const isAuthorized = await verifySession(token);
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized. Login required to manage key-value pairs.' } };
    }

    // 2. POST - Create/Update key-value pair (Upsert)
    if (method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { key, value } = body;
      if (!key || typeof key !== 'string' || key.trim() === '') {
        return { status: 400, jsonBody: { error: 'Key is required.' } };
      }
      if (value === undefined || typeof value !== 'string') {
        return { status: 400, jsonBody: { error: 'Value string is required.' } };
      }

      const cleanKey = key.trim();
      const cleanValue = value.trim();

      const pair: KeyValPair = {
        key: cleanKey,
        value: cleanValue,
        updatedAt: new Date()
      };

      await col.updateOne(
        { key: cleanKey },
        { $set: pair },
        { upsert: true }
      );

      return {
        status: 200,
        jsonBody: { success: true, key: cleanKey, value: cleanValue, message: 'Key-value saved successfully.' }
      };
    }

    // 3. DELETE - Delete key-value pair
    if (method === 'DELETE') {
      if (!targetKey) {
        return { status: 400, jsonBody: { error: 'Key parameter is required.' } };
      }

      const result = await col.deleteOne({ key: targetKey.trim() });
      if (result.deletedCount === 0) {
        return { status: 404, jsonBody: { error: 'Key not found.' } };
      }

      return {
        status: 200,
        jsonBody: { success: true, message: 'Key-value pair deleted successfully.' }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('KeyVal handler error:', err);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error.', details: err.message }
    };
  }
}

app.http('keyval', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'keyval/{key?}',
  handler: keyValHandler
});
