import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { connectToMongo } from './db';
import { runCaretakerCycle, processCaretakerChat } from './agent/caretakerCore';
import {
  getCoreMemory,
  updateCoreMemory,
  archivalMemoryInsert,
  archivalMemorySearch,
  getOrCreateActiveSession
} from './agent/memoryEngine';
import { getGeminiApiKey, saveGeminiApiKey } from './agent/geminiClient';
import { harvestSystemState } from './agent/harvester';

export async function caretakerHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const method = request.method;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Paths:
  // /api/caretaker/digest
  // /api/caretaker/trigger
  // /api/caretaker/chat
  // /api/caretaker/memory
  // /api/caretaker/settings

  const isApi = pathParts[0] === 'api';
  const baseIndex = isApi ? 1 : 0;
  const sub = pathParts[baseIndex + 1] || 'digest';

  try {
    const db = await connectToMongo();

    // ── 1. GET /api/caretaker/digest ───────────────────────────────────────────
    if (method === 'GET' && sub === 'digest') {
      const digestsCol = db.collection('caretaker_digests');
      let latest: any = await digestsCol.findOne({}, { sort: { timestamp: -1 } });

      if (!latest) {
        // Run initial cycle if none exists yet
        const cycle = await runCaretakerCycle(db, 'manual');
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            digest: cycle.analysis,
            state: cycle.state,
            coreMemory: cycle.coreMemory,
            timestamp: cycle.timestamp
          }
        };
      }

      const { _id, ...clean } = latest;
      const state = await harvestSystemState(db);
      const core = await getCoreMemory(db);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          digest: clean,
          state,
          coreMemory: core,
          timestamp: clean.timestamp
        }
      };
    }

    // ── 2. POST /api/caretaker/trigger ─────────────────────────────────────────
    if (method === 'POST' && sub === 'trigger') {
      const cycle = await runCaretakerCycle(db, 'manual');
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          success: true,
          digest: cycle.analysis,
          state: cycle.state,
          emailSent: cycle.emailSent,
          timestamp: cycle.timestamp
        }
      };
    }

    // ── 3. POST /api/caretaker/chat ────────────────────────────────────────────
    if (method === 'POST' && sub === 'chat') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const message = (body.message || '').trim();
      if (!message) {
        return { status: 400, jsonBody: { error: 'Message cannot be empty.' } };
      }

      const sessionId = body.sessionId || 'main_session';
      const result = await processCaretakerChat(db, message, sessionId);
      const session = await getOrCreateActiveSession(db, sessionId);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          reply: result.replyText,
          coreMemory: result.coreMemory,
          sessionMessages: session.messages
        }
      };
    }

    // ── 4. GET /api/caretaker/memory ───────────────────────────────────────────
    if (method === 'GET' && sub === 'memory') {
      const core = await getCoreMemory(db);
      const session = await getOrCreateActiveSession(db, 'main_session');
      const archivalCol = db.collection('agent_archival');
      const archival = await archivalCol.find({}).sort({ timestamp: -1 }).limit(20).toArray();

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          coreMemory: core,
          session,
          archival: archival.map(({ _id, ...rest }: any) => rest)
        }
      };
    }

    // ── 5. POST /api/caretaker/memory ──────────────────────────────────────────
    if (method === 'POST' && sub === 'memory') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      if (body.type === 'core') {
        const updated = await updateCoreMemory(db, body.human, body.persona);
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: true, coreMemory: updated }
        };
      }

      if (body.type === 'archival') {
        const item = await archivalMemoryInsert(db, body.content, body.tags || []);
        return {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: true, item }
        };
      }

      if (body.type === 'search_archival') {
        const results = await archivalMemorySearch(db, body.query || '', 10);
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { results }
        };
      }

      return { status: 400, jsonBody: { error: 'Invalid memory operation type.' } };
    }

    // ── 6. GET /api/caretaker/settings ─────────────────────────────────────────
    if (method === 'GET' && sub === 'settings') {
      const apiKey = await getGeminiApiKey(db);
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          hasGeminiKey: Boolean(apiKey),
          apiKeyMasked: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '',
          ownerEmail: process.env.OWNER_EMAIL || 'shudarsanregmi555@gmail.com',
          hasEmailConfigured: Boolean(process.env.GMAIL_APP_PASSWORD)
        }
      };
    }

    // ── 7. POST /api/caretaker/settings ────────────────────────────────────────
    if (method === 'POST' && sub === 'settings') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      if (body.geminiApiKey !== undefined) {
        await saveGeminiApiKey(db, String(body.geminiApiKey || ''));
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed on caretaker.` } };
  } catch (err: any) {
    context.error('Caretaker handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('caretaker', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'caretaker/{*subpath}',
  handler: caretakerHandler
});
