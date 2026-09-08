import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo, verifySession, extractToken } from './db';

export async function listsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const listId = request.params.id;

  try {
    const db = await connectToMongo();
    const col = db.collection('lists');

    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // ── 1. GET - Fetch all list categories ────────────────────────────────────
    if (method === 'GET') {
      let lists = await col.find({}).toArray();

      // Legacy auto-migration
      if (lists.length === 0) {
        const userDataCol = db.collection('userData');
        const legacyDoc = await userDataCol.findOne({ syncKey: 'global_user' });
        if (legacyDoc && Array.isArray(legacyDoc.lists) && legacyDoc.lists.length > 0) {
          await col.insertMany(legacyDoc.lists);
          lists = legacyDoc.lists;
        }
      }

      // Filter private items for unauthenticated visitors
      const filtered = lists.filter(cat => isAuthorized || !cat.isPrivate).map(cat => {
        const visibleItems = cat.items ? cat.items.filter((item: any) => isAuthorized || !item.isPrivate) : [];
        const { _id, ...rest } = cat;
        return { ...rest, items: visibleItems };
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: filtered
      };
    }

    // ── Writes & Deletes require Auth ─────────────────────────────────────────
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized. Login required to manage lists.' } };
    }

    // ── 2. POST - Save/Update category list ──────────────────────────────────
    if (method === 'POST') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const { name, description, isPrivate, items } = body;
      if (!name || typeof name !== 'string') {
        return { status: 400, jsonBody: { error: 'Category name is required.' } };
      }

      const id = body.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));
      const categoryDoc = {
        id,
        name: name.trim(),
        description: (description || '').trim(),
        isPrivate: !!isPrivate,
        items: Array.isArray(items) ? items : []
      };

      await col.updateOne({ id }, { $set: categoryDoc }, { upsert: true });

      return { status: 201, jsonBody: { success: true, category: categoryDoc } };
    }

    // ── 3. PUT - Update list category or its items ──────────────────────────
    if (method === 'PUT') {
      if (!listId) return { status: 400, jsonBody: { error: 'List ID is required.' } };
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const updates: Record<string, any> = {};
      if (body.name !== undefined) updates.name = body.name.trim();
      if (body.description !== undefined) updates.description = body.description.trim();
      if (body.isPrivate !== undefined) updates.isPrivate = !!body.isPrivate;
      if (body.items !== undefined) updates.items = Array.isArray(body.items) ? body.items : [];

      const result = await col.updateOne({ id: listId }, { $set: updates });
      if (result.matchedCount === 0) {
        return { status: 404, jsonBody: { error: 'List category not found.' } };
      }

      return { status: 200, jsonBody: { success: true } };
    }

    // ── 4. DELETE - Remove list category ──────────────────────────────────────
    if (method === 'DELETE') {
      if (!listId) return { status: 400, jsonBody: { error: 'List ID is required.' } };
      const result = await col.deleteOne({ id: listId });
      if (result.deletedCount === 0) return { status: 404, jsonBody: { error: 'List category not found.' } };

      return { status: 200, jsonBody: { success: true } };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Lists handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('lists', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'lists/{id?}',
  handler: listsHandler
});
