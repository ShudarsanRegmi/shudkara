import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { connectToMongo } from './db';

export async function trackerHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const problemIdParam = request.params.problemId;

  try {
    const db = await connectToMongo();
    const col = db.collection('tracker_progress');

    // ── 1. GET - Fetch progress dictionary ───────────────────────────────────
    if (method === 'GET') {
      let doc: any = await col.findOne({ key: 'global_tracker' });

      // Legacy auto-migration check
      if (!doc) {
        const userDataCol = db.collection('userData');
        const legacyDoc = await userDataCol.findOne({ syncKey: 'global_user' });
        if (legacyDoc && legacyDoc.leetcodeProgress) {
          const progressMap = legacyDoc.leetcodeProgress || {};
          doc = { key: 'global_tracker', progress: progressMap, updatedAt: new Date() };
          await col.updateOne(
            { key: 'global_tracker' },
            { $set: { key: 'global_tracker', progress: progressMap, updatedAt: new Date() } },
            { upsert: true }
          );
        }
      }

      const progress = doc?.progress || {};
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { progress }
      };
    }

    // ── 2. POST - Update problem progress ─────────────────────────────────────
    if (method === 'POST') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const { problemId, status, notes, runLogs, batchProgress } = body;

      if (batchProgress && typeof batchProgress === 'object') {
        // Bulk update / set whole progress map safely
        await col.updateOne(
          { key: 'global_tracker' },
          { $set: { key: 'global_tracker', progress: batchProgress, updatedAt: new Date() } },
          { upsert: true }
        );
        return { status: 200, jsonBody: { success: true } };
      }

      if (!problemId) {
        return { status: 400, jsonBody: { error: 'problemId is required.' } };
      }

      const pKey = String(problemId);
      const updateObject: Record<string, any> = {};
      if (status !== undefined) updateObject[`progress.${pKey}.status`] = status;
      if (notes !== undefined) updateObject[`progress.${pKey}.notes`] = notes;
      if (runLogs !== undefined) updateObject[`progress.${pKey}.runLogs`] = runLogs;
      updateObject['updatedAt'] = new Date();

      await col.updateOne(
        { key: 'global_tracker' },
        { $set: updateObject },
        { upsert: true }
      );

      return { status: 200, jsonBody: { success: true, problemId: pKey } };
    }

    // ── 3. DELETE - Reset problem progress ────────────────────────────────────
    if (method === 'DELETE') {
      if (!problemIdParam) {
        return { status: 400, jsonBody: { error: 'problemId parameter required.' } };
      }

      const pKey = String(problemIdParam);
      await col.updateOne(
        { key: 'global_tracker' },
        { $unset: { [`progress.${pKey}`]: "" }, $set: { updatedAt: new Date() } }
      );

      return { status: 200, jsonBody: { success: true, problemId: pKey } };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Tracker handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('tracker', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'tracker/{problemId?}',
  handler: trackerHandler
});
