import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo, verifySession, extractToken } from './db';

export async function concurrencyHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const path = new URL(request.url).pathname;
  const restParam = request.params.rest || '';
  const pathSegments = restParam.split('/').filter(Boolean);

  try {
    const db = await connectToMongo();
    const workstreamsCol = db.collection('workstreams');
    const sessionsCol = db.collection('concurrencySessions');
    const notificationsCol = db.collection('concurrencyNotifications');
    const settingsCol = db.collection('userSettings');

    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // ── 1. GET - Fetch state, workstreams, sessions, notifications, settings ──────
    if (method === 'GET') {
      const configDoc = await settingsCol.findOne({ key: 'concurrencyConfig' });
      const privacyDoc = await settingsCol.findOne({ key: 'concurrencyBoardPrivate' });
      const isBoardPrivate = privacyDoc ? !!privacyDoc.value : false;

      const defaultConfig = {
        maxActiveWorkstreams: 3,
        focusModeEnabled: false,
        soundAlerts: true,
        isBoardPrivate
      };
      const config = configDoc ? { ...defaultConfig, ...configDoc.value } : defaultConfig;

      // If user requesting specific workstream
      if (pathSegments.length === 1 && pathSegments[0] !== 'session' && pathSegments[0] !== 'notifications' && pathSegments[0] !== 'telemetry') {
        const id = pathSegments[0];
        const ws = await workstreamsCol.findOne({ id });
        if (!ws) {
          return { status: 404, jsonBody: { error: 'Workstream not found.' } };
        }
        if (ws.isPrivate && !isAuthorized) {
          return { status: 401, jsonBody: { error: 'Unauthorized.' } };
        }
        const { _id, ...rest } = ws;
        return { status: 200, jsonBody: rest };
      }

      // Fetch all workstreams
      const rawWorkstreams = await workstreamsCol.find({}).sort({ isPinned: -1, order: 1, updatedAt: -1 }).toArray();
      const visibleWorkstreams = isAuthorized
        ? rawWorkstreams
        : (isBoardPrivate ? [] : rawWorkstreams.filter(w => !w.isPrivate));

      const cleanedWorkstreams = visibleWorkstreams.map(w => {
        const { _id, ...rest } = w;
        return rest;
      });

      // Fetch active session if any
      let activeSession = null;
      if (isAuthorized) {
        const sessionDoc = await sessionsCol.findOne({ status: 'ACTIVE' });
        if (sessionDoc) {
          const { _id, ...restSession } = sessionDoc;
          activeSession = restSession;
        }
      }

      // Fetch unread notifications
      let notifications: any[] = [];
      if (isAuthorized) {
        const rawNotifs = await notificationsCol.find({ read: false }).sort({ timestamp: -1 }).limit(20).toArray();
        notifications = rawNotifs.map(n => {
          const { _id, ...restN } = n;
          return restN;
        });
      }

      // Fetch recent sessions history for telemetry
      let recentSessions: any[] = [];
      if (isAuthorized) {
        const rawSessions = await sessionsCol.find({}).sort({ startTime: -1 }).limit(10).toArray();
        recentSessions = rawSessions.map(s => {
          const { _id, ...restS } = s;
          return restS;
        });
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          workstreams: cleanedWorkstreams,
          config,
          activeSession,
          notifications,
          recentSessions,
          isAuthorized
        }
      };
    }

    // Write operations require Auth
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized. Login required.' } };
    }

    // ── 2. POST /api/concurrency/privacy — Toggle Privacy ─────────────────
    if (pathSegments[0] === 'privacy') {
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
      const isBoardPrivate = !!body.isBoardPrivate;
      await settingsCol.updateOne(
        { key: 'concurrencyBoardPrivate' },
        { $set: { key: 'concurrencyBoardPrivate', value: isBoardPrivate } },
        { upsert: true }
      );
      return { status: 200, jsonBody: { success: true, isBoardPrivate } };
    }

    // ── 3. POST /api/concurrency/config — Update Concurrency Config ─────
    if (pathSegments[0] === 'config') {
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
      const existingDoc = await settingsCol.findOne({ key: 'concurrencyConfig' });
      const currentConfig = existingDoc ? existingDoc.value : {};
      const newConfig = {
        ...currentConfig,
        maxActiveWorkstreams: Math.min(Math.max(Number(body.maxActiveWorkstreams) || 3, 1), 4),
        focusModeEnabled: body.focusModeEnabled !== undefined ? !!body.focusModeEnabled : (currentConfig.focusModeEnabled ?? false),
        soundAlerts: body.soundAlerts !== undefined ? !!body.soundAlerts : (currentConfig.soundAlerts ?? true)
      };

      await settingsCol.updateOne(
        { key: 'concurrencyConfig' },
        { $set: { key: 'concurrencyConfig', value: newConfig } },
        { upsert: true }
      );

      return { status: 200, jsonBody: { success: true, config: newConfig } };
    }

    // ── 4. POST /api/concurrency/session — Start / End / Switch Session ─────
    if (pathSegments[0] === 'session') {
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
      
      const action = body.action; // 'start' | 'end' | 'switch'

      if (action === 'start') {
        // End any active sessions first
        await sessionsCol.updateMany(
          { status: 'ACTIVE' },
          { $set: { status: 'COMPLETED', endTime: new Date().toISOString() } }
        );

        const newSession = {
          id: crypto.randomUUID(),
          status: 'ACTIVE',
          startTime: new Date().toISOString(),
          endTime: null,
          totalContextSwitches: 0,
          switchesHistory: [],
          parkedThoughtsCount: 0,
          microTasksCompleted: 0,
          attentionHealthScore: 100,
          targetConcurrencyLevel: body.targetConcurrencyLevel || 3
        };

        await sessionsCol.insertOne(newSession);
        return { status: 201, jsonBody: newSession };
      }

      if (action === 'end') {
        const activeSession = await sessionsCol.findOne({ status: 'ACTIVE' });
        if (!activeSession) {
          return { status: 404, jsonBody: { error: 'No active concurrency session.' } };
        }

        const endTime = new Date().toISOString();
        const durationMinutes = Math.max(1, Math.round((new Date(endTime).getTime() - new Date(activeSession.startTime).getTime()) / 60000));
        
        // Calculate health score: high switches per min lowers health score
        const switchesPerMin = activeSession.totalContextSwitches / durationMinutes;
        let attentionHealthScore = 100;
        if (switchesPerMin > 0.5) attentionHealthScore = Math.max(30, 100 - Math.round(switchesPerMin * 30));

        await sessionsCol.updateOne(
          { id: activeSession.id },
          {
            $set: {
              status: 'COMPLETED',
              endTime,
              durationMinutes,
              attentionHealthScore
            }
          }
        );

        const updated = await sessionsCol.findOne({ id: activeSession.id });
        const { _id, ...rest } = updated!;
        return { status: 200, jsonBody: rest };
      }

      if (action === 'switch') {
        const { fromWorkstreamId, toWorkstreamId, reason } = body;
        const activeSession = await sessionsCol.findOne({ status: 'ACTIVE' });

        const switchEvent = {
          fromId: fromWorkstreamId || null,
          toId: toWorkstreamId,
          timestamp: new Date().toISOString(),
          reason: reason || 'Manual Switch'
        };

        if (activeSession) {
          await sessionsCol.updateOne(
            { id: activeSession.id },
            {
              $inc: { totalContextSwitches: 1 },
              $push: { switchesHistory: switchEvent as any }
            }
          );
        }

        // Update active workstream timestamp & state
        if (toWorkstreamId) {
          await workstreamsCol.updateOne(
            { id: toWorkstreamId },
            { $set: { state: 'ACTIVE', lastActiveTime: new Date().toISOString() } }
          );
        }
        if (fromWorkstreamId && fromWorkstreamId !== toWorkstreamId) {
          await workstreamsCol.updateOne(
            { id: fromWorkstreamId },
            { $set: { state: 'PAUSED' } }
          );
        }

        return { status: 200, jsonBody: { success: true, switchEvent } };
      }
    }

    // ── 5. POST /api/concurrency/notifications — Push or Mark Read ───────────
    if (pathSegments[0] === 'notifications') {
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      if (body.action === 'clear') {
        await notificationsCol.updateMany({ read: false }, { $set: { read: true } });
        return { status: 200, jsonBody: { success: true } };
      }

      const notif = {
        id: crypto.randomUUID(),
        workstreamId: body.workstreamId,
        workstreamTitle: body.workstreamTitle || 'Workstream',
        severity: body.severity || 'MEDIUM', // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
        message: body.message,
        timestamp: new Date().toISOString(),
        read: false
      };

      await notificationsCol.insertOne(notif);
      return { status: 201, jsonBody: notif };
    }

    // ── 6. POST /api/concurrency/reorder — Bulk Reorder Workstreams ─────────
    if (pathSegments[0] === 'reorder') {
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
      const items: Array<{ id: string; order: number }> = Array.isArray(body.items) ? body.items : [];
      const bulkOps = items.map(item => ({
        updateOne: {
          filter: { id: item.id },
          update: { $set: { order: item.order, updatedAt: new Date().toISOString() } }
        }
      }));
      if (bulkOps.length > 0) {
        await workstreamsCol.bulkWrite(bulkOps);
      }
      return { status: 200, jsonBody: { success: true } };
    }

    // ── 7. POST /api/concurrency/workstreams — Create Workstream ────────────
    if (method === 'POST' && pathSegments.length === 0) {
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      if (!body.title || !body.title.trim()) {
        return { status: 400, jsonBody: { error: 'Title is required.' } };
      }

      // Check max active workstream constraint if new workstream is ACTIVE
      const activeCount = await workstreamsCol.countDocuments({ state: 'ACTIVE' });
      const configDoc = await settingsCol.findOne({ key: 'concurrencyConfig' });
      const maxActive = configDoc?.value?.maxActiveWorkstreams || 3;

      let initialState = body.state || 'PAUSED';
      if (initialState === 'ACTIVE' && activeCount >= maxActive) {
        initialState = 'PAUSED'; // Fallback to PAUSED if active limit reached
      }

      const now = new Date().toISOString();
      const newWorkstream = {
        id: crypto.randomUUID(),
        title: body.title.trim(),
        description: (body.description || '').trim(),
        category: (body.category || 'General').trim(),
        color: body.color || 'blue',
        state: initialState, // 'ACTIVE' | 'PAUSED' | 'WAITING' | 'SUSPENDED'
        isPinned: !!body.isPinned,
        isPrivate: body.isPrivate !== undefined ? !!body.isPrivate : true,
        order: body.order || 0,
        lastActiveTime: now,
        totalActiveSeconds: 0,

        // Context preservation
        currentTask: (body.currentTask || '').trim(),
        nextAction: (body.nextAction || '').trim(),
        whereILeftOff: (body.whereILeftOff || '').trim(),
        filesOrLinks: Array.isArray(body.filesOrLinks) ? body.filesOrLinks : [],

        // Sub-lists
        microTasks: Array.isArray(body.microTasks) ? body.microTasks : [],
        timers: Array.isArray(body.timers) ? body.timers : [],
        parkingLot: Array.isArray(body.parkingLot) ? body.parkingLot : [],

        createdAt: now,
        updatedAt: now
      };

      await workstreamsCol.insertOne(newWorkstream);
      const { _id, ...rest } = newWorkstream;
      return { status: 201, jsonBody: rest };
    }

    // ── 8. PUT /api/concurrency/workstreams/:id — Update Workstream ──────────
    if (method === 'PUT' && pathSegments.length === 1) {
      const workstreamId = pathSegments[0];
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const existing = await workstreamsCol.findOne({ id: workstreamId });
      if (!existing) {
        return { status: 404, jsonBody: { error: 'Workstream not found.' } };
      }

      // Check max active constraint if setting to ACTIVE
      if (body.state === 'ACTIVE' && existing.state !== 'ACTIVE') {
        const activeCount = await workstreamsCol.countDocuments({ state: 'ACTIVE', id: { $ne: workstreamId } });
        const configDoc = await settingsCol.findOne({ key: 'concurrencyConfig' });
        const maxActive = configDoc?.value?.maxActiveWorkstreams || 3;
        if (activeCount >= maxActive) {
          return {
            status: 400,
            jsonBody: {
              error: `Cannot activate workstream. Active workstream limit (${maxActive}) reached. Pause or suspend another workstream first.`
            }
          };
        }
      }

      const updateFields: any = { updatedAt: new Date().toISOString() };
      if (body.title !== undefined) updateFields.title = body.title.trim();
      if (body.description !== undefined) updateFields.description = body.description.trim();
      if (body.category !== undefined) updateFields.category = body.category.trim();
      if (body.color !== undefined) updateFields.color = body.color;
      if (body.state !== undefined) updateFields.state = body.state;
      if (body.isPinned !== undefined) updateFields.isPinned = !!body.isPinned;
      if (body.isPrivate !== undefined) updateFields.isPrivate = !!body.isPrivate;
      if (body.order !== undefined) updateFields.order = body.order;
      if (body.totalActiveSeconds !== undefined) updateFields.totalActiveSeconds = body.totalActiveSeconds;

      // Context preservation fields
      if (body.currentTask !== undefined) updateFields.currentTask = body.currentTask.trim();
      if (body.nextAction !== undefined) updateFields.nextAction = body.nextAction.trim();
      if (body.whereILeftOff !== undefined) updateFields.whereILeftOff = body.whereILeftOff.trim();
      if (body.filesOrLinks !== undefined) updateFields.filesOrLinks = body.filesOrLinks;

      // Arrays
      if (body.microTasks !== undefined) updateFields.microTasks = body.microTasks;
      if (body.timers !== undefined) updateFields.timers = body.timers;
      if (body.parkingLot !== undefined) updateFields.parkingLot = body.parkingLot;

      if (body.state === 'ACTIVE') {
        updateFields.lastActiveTime = new Date().toISOString();
      }

      await workstreamsCol.updateOne({ id: workstreamId }, { $set: updateFields });
      const updated = await workstreamsCol.findOne({ id: workstreamId });
      const { _id, ...rest } = updated!;
      return { status: 200, jsonBody: rest };
    }

    // ── 9. DELETE /api/concurrency/workstreams/:id — Delete Workstream ───────
    if (method === 'DELETE' && pathSegments.length === 1) {
      const workstreamId = pathSegments[0];
      const result = await workstreamsCol.deleteOne({ id: workstreamId });
      if (result.deletedCount === 0) {
        return { status: 404, jsonBody: { error: 'Workstream not found.' } };
      }
      return { status: 200, jsonBody: { success: true, id: workstreamId } };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Concurrency handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('concurrency', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'concurrency/{*rest}',
  handler: concurrencyHandler
});
