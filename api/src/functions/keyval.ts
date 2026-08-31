import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { connectToMongo, verifySession, extractToken } from './db';

export async function keyValHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const targetKey = (request.params.key || '').trim();

  try {
    const db = await connectToMongo();
    const col = db.collection('keyval');
    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // ── GET ───────────────────────────────────────────────────────────────────
    if (method === 'GET') {
      // Admin-only: list all key names (no values) — targetKey == '__list__'
      if (targetKey === '__list__') {
        if (!isAuthorized) return { status: 401, jsonBody: { error: 'Unauthorized.' } };
        const pairs = await col.find({}, { projection: { _id: 0, key: 1, updatedAt: 1 } }).toArray();
        return { status: 200, jsonBody: pairs };
      }

      // No key provided — listing forbidden
      if (!targetKey) {
        return { status: 403, jsonBody: { error: 'Key listing is disabled.' } };
      }

      // Single key lookup — returns value (frontend copies, never displays)
      const pair = await col.findOne({ key: targetKey });
      if (!pair) return { status: 404, jsonBody: { error: 'Key not found.' } };
      return { status: 200, jsonBody: { value: pair.value } };
    }

    // ── Writes require auth ───────────────────────────────────────────────────
    if (!isAuthorized) return { status: 401, jsonBody: { error: 'Unauthorized.' } };

    // ── POST — Create/Update ──────────────────────────────────────────────────
    if (method === 'POST') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON body.' } }; }

      const { key, value } = body;
      if (!key?.trim()) return { status: 400, jsonBody: { error: 'Key is required.' } };
      if (value === undefined || typeof value !== 'string') {
        return { status: 400, jsonBody: { error: 'Value string is required.' } };
      }

      await col.updateOne(
        { key: key.trim() },
        { $set: { key: key.trim(), value: value.trim(), updatedAt: new Date() } },
        { upsert: true }
      );
      return { status: 200, jsonBody: { success: true, key: key.trim() } };
    }

    // ── DELETE — Remove key ───────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!targetKey) return { status: 400, jsonBody: { error: 'Key parameter required.' } };
      const result = await col.deleteOne({ key: targetKey });
      if (result.deletedCount === 0) return { status: 404, jsonBody: { error: 'Key not found.' } };
      return { status: 200, jsonBody: { success: true } };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('KeyVal handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('keyval', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'keyval/{key?}',
  handler: keyValHandler
});
