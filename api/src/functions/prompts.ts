import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo, verifySession, extractToken } from './db';

export async function promptsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const promptId = request.params.id;

  try {
    const db = await connectToMongo();
    const col = db.collection('prompts');

    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // ── 1. GET - Fetch all prompts ──────────────────────────────────────────
    if (method === 'GET') {
      let prompts = await col.find({}).toArray();

      // Legacy auto-migration
      if (prompts.length === 0) {
        const userDataCol = db.collection('userData');
        const legacyDoc = await userDataCol.findOne({ syncKey: 'global_user' });
        if (legacyDoc && Array.isArray(legacyDoc.prompts) && legacyDoc.prompts.length > 0) {
          await col.insertMany(legacyDoc.prompts);
          prompts = legacyDoc.prompts;
        }
      }

      // Filter private items if visitor is not logged in
      const filtered = isAuthorized
        ? prompts
        : prompts.filter(p => !p.isPrivate);

      const cleaned = filtered.map(p => {
        const { _id, ...rest } = p;
        return rest;
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: cleaned
      };
    }

    // ── Writes & Deletes require Auth ─────────────────────────────────────────
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized. Login required to manage prompts.' } };
    }

    // ── 2. POST - Create new prompt ─────────────────────────────────────────
    if (method === 'POST') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const { title, prompt, description, tags, isPrivate } = body;
      if (!title || typeof title !== 'string') {
        return { status: 400, jsonBody: { error: 'Title is required.' } };
      }

      const id = body.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));
      const newPrompt = {
        id,
        title: title.trim(),
        prompt: (prompt || '').trim(),
        description: (description || '').trim(),
        tags: Array.isArray(tags) ? tags : [],
        isPrivate: !!isPrivate,
        createdAt: body.createdAt || new Date().toISOString()
      };

      await col.updateOne({ id }, { $set: newPrompt }, { upsert: true });

      return { status: 201, jsonBody: { success: true, prompt: newPrompt } };
    }

    // ── 3. PUT - Update prompt ──────────────────────────────────────────────
    if (method === 'PUT') {
      if (!promptId) return { status: 400, jsonBody: { error: 'Prompt ID is required.' } };
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const updates: Record<string, any> = {};
      if (body.title !== undefined) updates.title = body.title.trim();
      if (body.prompt !== undefined) updates.prompt = body.prompt.trim();
      if (body.description !== undefined) updates.description = body.description.trim();
      if (body.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags : [];
      if (body.isPrivate !== undefined) updates.isPrivate = !!body.isPrivate;

      const result = await col.updateOne({ id: promptId }, { $set: updates });
      if (result.matchedCount === 0) {
        return { status: 404, jsonBody: { error: 'Prompt not found.' } };
      }

      return { status: 200, jsonBody: { success: true } };
    }

    // ── 4. DELETE - Delete prompt ────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!promptId) return { status: 400, jsonBody: { error: 'Prompt ID is required.' } };
      const result = await col.deleteOne({ id: promptId });
      if (result.deletedCount === 0) return { status: 404, jsonBody: { error: 'Prompt not found.' } };

      return { status: 200, jsonBody: { success: true } };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Prompts handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('prompts', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'prompts/{id?}',
  handler: promptsHandler
});
