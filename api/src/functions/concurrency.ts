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
    const sittingsCol = db.collection('concurrencySittings');
    const notificationsCol = db.collection('concurrencyNotifications');
    const settingsCol = db.collection('userSettings');

    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // ── 1. GET - Fetch state, workstreams, sessions, sittings, notifications, settings ──
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
      if (pathSegments.length === 1 && !['session', 'sittings', 'notifications', 'telemetry', 'config', 'privacy', 'reorder'].includes(pathSegments[0])) {
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

      // Fetch sittings (Current Sitting management)
      let sittings: any[] = [];
      let activeSitting = null;
      if (isAuthorized) {
        const rawSittings = await sittingsCol.find({}).sort({ createdAt: -1 }).toArray();
        sittings = rawSittings.map(s => {
          const { _id, ...restS } = s;
          return restS;
        });
        activeSitting = sittings.find(s => s.active) || null;
      }

      // Fetch active telemetry session if any
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
          sittings,
          activeSitting,
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

    // ── 4. SITTINGS ENDPOINTS (/api/concurrency/sittings) ───────────────────
    if (pathSegments[0] === 'sittings') {
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const action = body.action || (method === 'POST' ? 'create' : 'update');

      if (action === 'create') {
        if (!body.title || !body.title.trim()) {
          return { status: 400, jsonBody: { error: 'Sitting title is required.' } };
        }

        if (body.active) {
          await sittingsCol.updateMany({}, { $set: { active: false } });
        }

        const newSitting = {
          id: crypto.randomUUID(),
          title: body.title.trim(),
          workstreamIds: Array.isArray(body.workstreamIds) ? body.workstreamIds : [],
          active: body.active !== undefined ? !!body.active : true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await sittingsCol.insertOne(newSitting);
        const { _id, ...rest } = newSitting;
        return { status: 201, jsonBody: rest };
      }

      if (action === 'activate') {
        const sittingId = body.id;
        await sittingsCol.updateMany({}, { $set: { active: false } });
        if (sittingId) {
          await sittingsCol.updateOne({ id: sittingId }, { $set: { active: true, updatedAt: new Date().toISOString() } });
        }
        return { status: 200, jsonBody: { success: true, activeSittingId: sittingId || null } };
      }

      if (action === 'update' && body.id) {
        const updateFields: any = { updatedAt: new Date().toISOString() };
        if (body.title) updateFields.title = body.title.trim();
        if (body.workstreamIds) updateFields.workstreamIds = body.workstreamIds;
        if (body.active !== undefined) {
          if (body.active) await sittingsCol.updateMany({}, { $set: { active: false } });
          updateFields.active = !!body.active;
        }

        await sittingsCol.updateOne({ id: body.id }, { $set: updateFields });
        const updated = await sittingsCol.findOne({ id: body.id });
        const { _id, ...rest } = updated!;
        return { status: 200, jsonBody: rest };
      }

      if (action === 'delete' && body.id) {
        await sittingsCol.deleteOne({ id: body.id });
        return { status: 200, jsonBody: { success: true, id: body.id } };
      }
    }

    // ── 5. POST /api/concurrency/session — Telemetry Session ─────────────────
    if (pathSegments[0] === 'session') {
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
      
      const action = body.action;

      if (action === 'start') {
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

        const now = new Date().toISOString();

        if (toWorkstreamId) {
          const wsTo = await workstreamsCol.findOne({ id: toWorkstreamId });
          const newTimeLog = {
            id: crypto.randomUUID(),
            startTime: now,
            endTime: null,
            durationSeconds: 0,
            taskName: wsTo?.currentTask || 'Focus Task'
          };
          await workstreamsCol.updateOne(
            { id: toWorkstreamId },
            {
              $set: { state: 'ACTIVE', lastActiveTime: now },
              $push: { timeLogs: newTimeLog as any }
            }
          );
        }

        if (fromWorkstreamId && fromWorkstreamId !== toWorkstreamId) {
          const wsFrom = await workstreamsCol.findOne({ id: fromWorkstreamId });
          if (wsFrom && wsFrom.timeLogs && wsFrom.timeLogs.length > 0) {
            const updatedLogs = wsFrom.timeLogs.map((log: any) => {
              if (!log.endTime) {
                const duration = Math.max(0, Math.round((new Date(now).getTime() - new Date(log.startTime).getTime()) / 1000));
                return { ...log, endTime: now, durationSeconds: duration };
              }
              return log;
            });
            await workstreamsCol.updateOne(
              { id: fromWorkstreamId },
              { $set: { state: 'PAUSED', timeLogs: updatedLogs } }
            );
          } else {
            await workstreamsCol.updateOne(
              { id: fromWorkstreamId },
              { $set: { state: 'PAUSED' } }
            );
          }
        }

        return { status: 200, jsonBody: { success: true, switchEvent } };
      }
    }

    // ── 6. POST /api/concurrency/notifications ──────────────────────────────
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
        severity: body.severity || 'MEDIUM',
        message: body.message,
        timestamp: new Date().toISOString(),
        read: false
      };

      await notificationsCol.insertOne(notif);
      return { status: 201, jsonBody: notif };
    }

    // ── 7. POST /api/concurrency/reorder — Bulk Reorder ─────────────────────
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

    // ── 8. POST /api/concurrency/workstreams — Create Workstream ────────────
    if (method === 'POST' && pathSegments.length === 0) {
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      if (!body.title || !body.title.trim()) {
        return { status: 400, jsonBody: { error: 'Title is required.' } };
      }

      const activeCount = await workstreamsCol.countDocuments({ state: 'ACTIVE' });
      const configDoc = await settingsCol.findOne({ key: 'concurrencyConfig' });
      const maxActive = configDoc?.value?.maxActiveWorkstreams || 3;

      let initialState = body.state || 'PAUSED';
      if (initialState === 'ACTIVE' && activeCount >= maxActive) {
        initialState = 'PAUSED';
      }

      const now = new Date().toISOString();
      const newWorkstream = {
        id: crypto.randomUUID(),
        title: body.title.trim(),
        description: (body.description || '').trim(),
        category: (body.category || 'General').trim(),
        color: body.color || 'indigo',
        state: initialState,
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

        // Sub-lists & Granular Time Logs
        microTasks: Array.isArray(body.microTasks) ? body.microTasks : [],
        timers: Array.isArray(body.timers) ? body.timers : [],
        parkingLot: Array.isArray(body.parkingLot) ? body.parkingLot : [],
        timeLogs: [],
        backgroundAlarms: [],

        createdAt: now,
        updatedAt: now
      };

      await workstreamsCol.insertOne(newWorkstream);
      const { _id, ...rest } = newWorkstream;
      return { status: 201, jsonBody: rest };
    }

    // ── 9. PUT /api/concurrency/workstreams/:id — Update Workstream ──────────
    if (method === 'PUT' && pathSegments.length === 1) {
      const workstreamId = pathSegments[0];
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const existing = await workstreamsCol.findOne({ id: workstreamId });
      if (!existing) {
        return { status: 404, jsonBody: { error: 'Workstream not found.' } };
      }

      if (body.state === 'ACTIVE' && existing.state !== 'ACTIVE') {
        const activeCount = await workstreamsCol.countDocuments({ state: 'ACTIVE', id: { $ne: workstreamId } });
        const configDoc = await settingsCol.findOne({ key: 'concurrencyConfig' });
        const maxActive = configDoc?.value?.maxActiveWorkstreams || 3;
        if (activeCount >= maxActive) {
          return {
            status: 400,
            jsonBody: {
              error: `Cannot activate workstream. Active limit (${maxActive}) reached. Pause or suspend another workstream first.`
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
      if (body.timeLogs !== undefined) updateFields.timeLogs = body.timeLogs;
      if (body.backgroundAlarms !== undefined) updateFields.backgroundAlarms = body.backgroundAlarms;

      if (body.state === 'ACTIVE') {
        updateFields.lastActiveTime = new Date().toISOString();
      }

      await workstreamsCol.updateOne({ id: workstreamId }, { $set: updateFields });
      const updated = await workstreamsCol.findOne({ id: workstreamId });
      const { _id, ...rest } = updated!;
      return { status: 200, jsonBody: rest };
    }

    // ── 10. DELETE /api/concurrency/workstreams/:id — Delete Workstream ──────
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
