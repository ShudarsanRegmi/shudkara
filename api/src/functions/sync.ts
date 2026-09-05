import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { connectToMongo } from './db';

export async function syncHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;

  try {
    const database = await connectToMongo();
    const col = database.collection('userData');
    const historyCol = database.collection('userData_history');

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

      const key = syncKey.trim();

      // Fetch existing document to prevent accidental empty state overwrites
      const existingDoc = await col.findOne({ syncKey: key });

      // Automatically store a historical backup snapshot in MongoDB before updating
      if (existingDoc) {
        const { _id, ...backupData } = existingDoc;
        await historyCol.insertOne({
          ...backupData,
          snapshotAt: new Date(),
          reason: 'auto-save-backup'
        }).catch(err => context.error('Failed to save history snapshot:', err));
      }

      // Build safe $set payload preserving existing data if incoming payload is empty/undefined
      const setPayload: Record<string, any> = {
        syncKey: key,
        updatedAt: new Date()
      };

      // Safeguard leetcodeProgress with Deep Merging
      const existingProg = existingDoc?.leetcodeProgress || {};
      const incomingProg = (leetcodeProgress && typeof leetcodeProgress === 'object') ? leetcodeProgress : {};

      const mergedProg: Record<string, any> = { ...existingProg };

      for (const [id, inc] of Object.entries(incomingProg)) {
        const incObj = inc as any;
        if (!mergedProg[id]) {
          mergedProg[id] = incObj;
        } else {
          mergedProg[id] = {
            ...mergedProg[id],
            ...incObj,
            notes: (incObj.notes && incObj.notes.trim() !== '') ? incObj.notes : (mergedProg[id].notes || ''),
            runLogs: (() => {
              const existingLogs = mergedProg[id].runLogs || [];
              const incomingLogs = incObj.runLogs || [];
              const logMap = new Map();
              [...existingLogs, ...incomingLogs].forEach((l: any) => {
                if (l && l.id) logMap.set(l.id, l);
              });
              return Array.from(logMap.values());
            })()
          };
        }
      }

      setPayload.leetcodeProgress = mergedProg;

      // Safeguard leetcodeNotes
      if (leetcodeNotes !== undefined) {
        setPayload.leetcodeNotes = leetcodeNotes;
      } else if (existingDoc?.leetcodeNotes) {
        setPayload.leetcodeNotes = existingDoc.leetcodeNotes;
      }

      // Safeguard prompts
      if (Array.isArray(prompts) && (prompts.length > 0 || !existingDoc?.prompts)) {
        setPayload.prompts = prompts;
      } else if (existingDoc?.prompts) {
        setPayload.prompts = existingDoc.prompts;
      } else {
        setPayload.prompts = [];
      }

      // Safeguard todos
      if (Array.isArray(todos) && (todos.length > 0 || !existingDoc?.todos)) {
        setPayload.todos = todos;
      } else if (existingDoc?.todos) {
        setPayload.todos = existingDoc.todos;
      } else {
        setPayload.todos = [];
      }

      // Safeguard todoBoardPrivate
      if (todoBoardPrivate !== undefined) {
        setPayload.todoBoardPrivate = !!todoBoardPrivate;
      } else if (existingDoc?.todoBoardPrivate !== undefined) {
        setPayload.todoBoardPrivate = !!existingDoc.todoBoardPrivate;
      }

      // Safeguard lists
      if (Array.isArray(lists) && (lists.length > 0 || !existingDoc?.lists)) {
        setPayload.lists = lists;
      } else if (existingDoc?.lists) {
        setPayload.lists = existingDoc.lists;
      } else {
        setPayload.lists = [];
      }

      await col.updateOne(
        { syncKey: key },
        { $set: setPayload },
        { upsert: true }
      );

      return {
        status: 200,
        jsonBody: {
          success: true,
          message: 'Data synced safely to MongoDB with backup snapshot.'
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
