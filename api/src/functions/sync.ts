import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { connectToMongo } from './db';

export async function syncHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;

  try {
    const database = await connectToMongo();
    const col = database.collection('userData');

    if (method === 'GET') {
      const syncKey = request.query.get('key');
      if (!syncKey) {
        return { status: 400, jsonBody: { error: 'Sync key is required.' } };
      }

      const doc = await col.findOne({ syncKey: syncKey.trim() });
      if (doc) {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            exists: true,
            syncKey: doc.syncKey,
            leetcodeProgress: doc.leetcodeProgress || {},
            leetcodeNotes: doc.leetcodeNotes || {},
            prompts: doc.prompts || [],
            todos: doc.todos || [],
            todoBoardPrivate: !!doc.todoBoardPrivate,
            lists: doc.lists || [],
            updatedAt: doc.updatedAt
          }
        };
      } else {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            exists: false,
            leetcodeProgress: {},
            leetcodeNotes: {},
            prompts: [],
            todos: [],
            todoBoardPrivate: false,
            lists: []
          }
        };
      }
    }

    if (method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch (e) {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { syncKey, leetcodeProgress, leetcodeNotes, prompts, todos, todoBoardPrivate, lists } = body;
      if (!syncKey || typeof syncKey !== 'string' || syncKey.trim() === '') {
        return { status: 400, jsonBody: { error: 'Sync key is required to save data.' } };
      }

      const updatedData = {
        syncKey: syncKey.trim(),
        leetcodeProgress: leetcodeProgress || {},
        leetcodeNotes: leetcodeNotes || {},
        prompts: prompts || [],
        todos: todos || [],
        todoBoardPrivate: !!todoBoardPrivate,
        lists: lists || [],
        updatedAt: new Date()
      };

      await col.updateOne(
        { syncKey: updatedData.syncKey },
        { $set: updatedData },
        { upsert: true }
      );

      return {
        status: 200,
        jsonBody: {
          success: true,
          message: 'Data synced successfully.'
        }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Error in syncHandler:', err);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error.', details: err.message }
    };
  }
}

app.http('sync', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'sync',
  handler: syncHandler
});
