import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo, verifySession, extractToken } from './db';

export async function timersHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const path = new URL(request.url).pathname;
  const timerId = request.params.id;

  try {
    const db = await connectToMongo();
    const col = db.collection('timers');
    const settingsCol = db.collection('userSettings');

    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // ── 1. GET - Fetch timers & section privacy ──────────────────────────────
    if (method === 'GET') {
      // Check single timer request by query or id param
      const singleId = timerId || new URL(request.url).searchParams.get('id');
      if (singleId && singleId !== 'privacy') {
        const timer = await col.findOne({ id: singleId });
        if (!timer) {
          return { status: 404, jsonBody: { error: 'Timer not found.' } };
        }
        if (timer.isPrivate && !isAuthorized) {
          return { status: 401, jsonBody: { error: 'Unauthorized. This timer is private.' } };
        }
        const { _id, ...rest } = timer;
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: rest
        };
      }

      const timers = await col.find({}).sort({ isPinned: -1, targetDate: 1 }).toArray();

      // Fetch board privacy setting
      const privacyDoc = await settingsCol.findOne({ key: 'timerBoardPrivate' });
      const isBoardPrivate = privacyDoc ? !!privacyDoc.value : false;

      // Filter private items if unauthenticated visitor
      const visibleTimers = isAuthorized
        ? timers
        : (isBoardPrivate ? [] : timers.filter(t => !t.isPrivate));

      const cleaned = visibleTimers.map(t => {
        const { _id, ...rest } = t;
        return rest;
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { timers: cleaned, isBoardPrivate }
      };
    }

    // ── 2. POST /api/timers/privacy — Toggle Section Privacy ─────────────────
    if (timerId === 'privacy' || path.endsWith('/privacy')) {
      if (!isAuthorized) return { status: 401, jsonBody: { error: 'Unauthorized.' } };
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const isBoardPrivate = !!body.isBoardPrivate;
      await settingsCol.updateOne(
        { key: 'timerBoardPrivate' },
        { $set: { key: 'timerBoardPrivate', value: isBoardPrivate } },
        { upsert: true }
      );
      return { status: 200, jsonBody: { success: true, isBoardPrivate } };
    }

    // ── Writes & Deletes require Auth ─────────────────────────────────────────
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized. Login required to edit timers.' } };
    }

    // ── 3. POST - Create new countdown timer ──────────────────────────────────
    if (method === 'POST') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const { title, targetDate, description, category, color, isPinned, isPrivate } = body;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return { status: 400, jsonBody: { error: 'Title is required.' } };
      }
      if (!targetDate) {
        return { status: 400, jsonBody: { error: 'Target date is required.' } };
      }

      const id = body.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));
      const newTimer = {
        id,
        title: title.trim(),
        targetDate: new Date(targetDate).toISOString(),
        description: description ? description.trim() : '',
        category: category ? category.trim() : 'Personal',
        color: color || 'indigo',
        isPinned: !!isPinned,
        isPrivate: !!isPrivate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await col.insertOne(newTimer);
      return { status: 201, jsonBody: newTimer };
    }

    // ── 4. PUT - Update timer ─────────────────────────────────────────────────
    if (method === 'PUT' && timerId) {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const existing = await col.findOne({ id: timerId });
      if (!existing) {
        return { status: 404, jsonBody: { error: 'Timer not found.' } };
      }

      const updateFields: any = { updatedAt: new Date().toISOString() };
      if (body.title !== undefined) updateFields.title = body.title.trim();
      if (body.targetDate !== undefined) updateFields.targetDate = new Date(body.targetDate).toISOString();
      if (body.description !== undefined) updateFields.description = body.description.trim();
      if (body.category !== undefined) updateFields.category = body.category.trim();
      if (body.color !== undefined) updateFields.color = body.color;
      if (body.isPinned !== undefined) updateFields.isPinned = !!body.isPinned;
      if (body.isPrivate !== undefined) updateFields.isPrivate = !!body.isPrivate;

      await col.updateOne({ id: timerId }, { $set: updateFields });
      const updated = await col.findOne({ id: timerId });
      const { _id, ...rest } = updated!;
      return { status: 200, jsonBody: rest };
    }

    // ── 5. DELETE - Remove timer ──────────────────────────────────────────────
    if (method === 'DELETE' && timerId) {
      const result = await col.deleteOne({ id: timerId });
      if (result.deletedCount === 0) {
        return { status: 404, jsonBody: { error: 'Timer not found.' } };
      }
      return { status: 200, jsonBody: { success: true, id: timerId } };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Timers handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('timers', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'timers/{*id}',
  handler: timersHandler
});
