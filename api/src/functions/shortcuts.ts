import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { connectToMongo } from './db';

export interface ShortcutPreference {
  id: string;
  visible: boolean;
  customLabel?: string;
}

export async function shortcutsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;

  try {
    const db = await connectToMongo();
    const settingsCol = db.collection('userSettings');

    // ── 1. GET - Fetch global shortcut configuration ──────────────────────────
    if (method === 'GET') {
      const doc = await settingsCol.findOne({ key: 'appDrawerShortcuts' });
      if (doc && Array.isArray(doc.shortcuts)) {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            shortcuts: doc.shortcuts,
            updatedAt: doc.updatedAt
          }
        };
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          shortcuts: null
        }
      };
    }

    // ── 2. POST / PUT - Save shortcut configuration ───────────────────────────
    if (method === 'POST' || method === 'PUT') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON.' } };
      }

      const { shortcuts } = body;
      if (!Array.isArray(shortcuts)) {
        return { status: 400, jsonBody: { error: 'shortcuts array is required.' } };
      }

      // Sanitize shortcuts array
      const sanitized: ShortcutPreference[] = shortcuts
        .filter((item: any) => item && typeof item.id === 'string')
        .map((item: any) => ({
          id: String(item.id).trim(),
          visible: item.visible !== false,
          customLabel: typeof item.customLabel === 'string' && item.customLabel.trim() ? item.customLabel.trim() : undefined
        }));

      const now = new Date().toISOString();
      await settingsCol.updateOne(
        { key: 'appDrawerShortcuts' },
        {
          $set: {
            key: 'appDrawerShortcuts',
            shortcuts: sanitized,
            updatedAt: now
          }
        },
        { upsert: true }
      );

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          success: true,
          shortcuts: sanitized,
          updatedAt: now
        }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Shortcuts handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('shortcuts', {
  methods: ['GET', 'POST', 'PUT'],
  authLevel: 'anonymous',
  route: 'shortcuts',
  handler: shortcutsHandler
});
