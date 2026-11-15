import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo, verifySession, extractToken, logAppError } from './db';
import { sendPushNotificationToAll } from './notifications';

export interface AlarmItem {
  id: string;
  type: 'alarm' | 'reminder';
  title: string;
  label?: string;
  message?: string;
  hour?: number; // 0-23
  minutes?: number; // 0-59
  days?: number[]; // [1..7] Calendar.SUNDAY..SATURDAY
  targetDate?: string; // ISO string for reminders
  priority?: 'normal' | 'important' | 'urgent';
  notificationStyle?: 'clock_alarm' | 'in_app_popup' | 'web_push' | 'heads_up';
  isEnabled: boolean;
  isCompleted?: boolean;
  vibrate?: boolean;
  skipUi?: boolean;
  syncToDevice?: boolean;
  deviceSyncStatus?: 'pending' | 'synced' | 'failed' | 'skipped';
  syncedAt?: string | null;
  dismissedAt?: string | null;
  snoozedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function alarmsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const alarmId = request.params.id;
  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/^\/api\/alarms\/?/, '').split('/').filter(Boolean);

  try {
    const db = await connectToMongo();
    const col = db.collection('alarms');

    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // ── 1. GET /api/alarms ───────────────────────────────────────────────────────
    if (method === 'GET') {
      const typeFilter = url.searchParams.get('type');
      const pendingSync = url.searchParams.get('pending_device_sync');
      const singleId = alarmId || url.searchParams.get('id');

      if (singleId && singleId !== 'trigger' && singleId !== 'stats') {
        const item = await col.findOne({ id: singleId });
        if (!item) return { status: 404, jsonBody: { error: 'Alarm or reminder not found.' } };
        const { _id, ...rest } = item;
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: rest
        };
      }

      const query: any = {};
      if (typeFilter && (typeFilter === 'alarm' || typeFilter === 'reminder')) {
        query.type = typeFilter;
      }
      if (pendingSync === 'true') {
        query.syncToDevice = true;
        query.deviceSyncStatus = 'pending';
        query.isEnabled = true;
      }

      const items = await col.find(query).sort({ createdAt: -1 }).toArray();
      const cleaned = items.map(i => {
        const { _id, ...rest } = i;
        return rest;
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { alarms: cleaned, total: cleaned.length }
      };
    }

    // ── 2. POST /api/alarms/:id/sync-ack (Android Companion Acknowledgment) ─────
    if (method === 'POST' && (pathParts[1] === 'sync-ack' || url.pathname.endsWith('/sync-ack'))) {
      const targetId = alarmId || pathParts[0];
      if (!targetId) return { status: 400, jsonBody: { error: 'Missing alarm ID.' } };

      const now = new Date().toISOString();
      const result = await col.updateOne(
        { id: targetId },
        {
          $set: {
            deviceSyncStatus: 'synced',
            syncedAt: now,
            updatedAt: now
          }
        }
      );

      if (result.matchedCount === 0) {
        return { status: 404, jsonBody: { error: 'Alarm not found.' } };
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, message: 'Device sync acknowledged.', syncedAt: now }
      };
    }

    // ── 3. POST /api/alarms/test-trigger (Dispatches test notification/alarm) ──
    if (method === 'POST' && (alarmId === 'test-trigger' || pathParts[0] === 'test-trigger')) {
      let body: any = {};
      try { body = await request.json(); } catch {}

      const title = body.title || '🔔 Shudkara Alarm / Reminder Test';
      const text = body.message || 'Testing notification and alarm sound system from Shudkara!';

      const pushResult = await sendPushNotificationToAll({
        title,
        body: text,
        url: '/?tab=alarms',
        tag: 'shudkara-alarm-test'
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          success: true,
          message: 'Trigger dispatched.',
          pushResult
        }
      };
    }

    // ── Writes require Auth (Companion token or web session) ──────────────────
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized. Login or valid session token required.' } };
    }

    // ── 4. POST /api/alarms (Create Alarm or Reminder) ──────────────────────────
    if (method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      if (!body.title || typeof body.title !== 'string') {
        return { status: 400, jsonBody: { error: 'Title is required.' } };
      }

      const now = new Date().toISOString();
      const id = body.id || crypto.randomUUID();
      const type: 'alarm' | 'reminder' = body.type === 'reminder' ? 'reminder' : 'alarm';

      const newAlarm: AlarmItem = {
        id,
        type,
        title: body.title.trim(),
        label: (body.label || body.title || '').trim(),
        message: (body.message || '').trim(),
        hour: typeof body.hour === 'number' ? Math.max(0, Math.min(23, body.hour)) : undefined,
        minutes: typeof body.minutes === 'number' ? Math.max(0, Math.min(59, body.minutes)) : undefined,
        days: Array.isArray(body.days) ? body.days : [],
        targetDate: body.targetDate || undefined,
        priority: ['urgent', 'important', 'normal'].includes(body.priority) ? body.priority : 'normal',
        notificationStyle: body.notificationStyle || (type === 'alarm' ? 'clock_alarm' : 'in_app_popup'),
        isEnabled: body.isEnabled !== undefined ? !!body.isEnabled : true,
        isCompleted: false,
        vibrate: body.vibrate !== undefined ? !!body.vibrate : true,
        skipUi: body.skipUi !== undefined ? !!body.skipUi : true,
        syncToDevice: body.syncToDevice !== undefined ? !!body.syncToDevice : true,
        deviceSyncStatus: (body.syncToDevice !== false) ? 'pending' : 'skipped',
        syncedAt: null,
        dismissedAt: null,
        snoozedUntil: null,
        createdAt: now,
        updatedAt: now
      };

      await col.insertOne(newAlarm as any);

      // If user also requested immediate push dispatch
      if (body.dispatchPush) {
        sendPushNotificationToAll({
          title: `⏰ ${newAlarm.title}`,
          body: newAlarm.message || (newAlarm.type === 'alarm' ? `Alarm set for ${newAlarm.hour}:${String(newAlarm.minutes).padStart(2, '0')}` : 'Scheduled reminder'),
          url: '/?tab=alarms',
          tag: `alarm-${id}`
        }).catch(err => context.error('Error dispatching push for alarm:', err));
      }

      return {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, alarm: newAlarm }
      };
    }

    // ── 5. PUT /api/alarms/:id (Update Alarm or Reminder) ──────────────────────
    if (method === 'PUT') {
      const targetId = alarmId || pathParts[0];
      if (!targetId) return { status: 400, jsonBody: { error: 'Missing alarm ID in URL.' } };

      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const updates: any = { updatedAt: new Date().toISOString() };
      if (body.title !== undefined) updates.title = String(body.title).trim();
      if (body.label !== undefined) updates.label = String(body.label).trim();
      if (body.message !== undefined) updates.message = String(body.message).trim();
      if (body.hour !== undefined) updates.hour = Math.max(0, Math.min(23, Number(body.hour)));
      if (body.minutes !== undefined) updates.minutes = Math.max(0, Math.min(59, Number(body.minutes)));
      if (Array.isArray(body.days)) updates.days = body.days;
      if (body.targetDate !== undefined) updates.targetDate = body.targetDate;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.notificationStyle !== undefined) updates.notificationStyle = body.notificationStyle;
      if (body.isEnabled !== undefined) updates.isEnabled = !!body.isEnabled;
      if (body.isCompleted !== undefined) updates.isCompleted = !!body.isCompleted;
      if (body.vibrate !== undefined) updates.vibrate = !!body.vibrate;
      if (body.skipUi !== undefined) updates.skipUi = !!body.skipUi;
      if (body.syncToDevice !== undefined) updates.syncToDevice = !!body.syncToDevice;
      if (body.deviceSyncStatus !== undefined) updates.deviceSyncStatus = body.deviceSyncStatus;
      if (body.snoozedUntil !== undefined) updates.snoozedUntil = body.snoozedUntil;
      if (body.dismissedAt !== undefined) updates.dismissedAt = body.dismissedAt;

      // If time changed or re-enabled, reset device sync status to pending so phone updates
      if (body.hour !== undefined || body.minutes !== undefined || body.targetDate !== undefined || body.isEnabled === true) {
        if (updates.syncToDevice !== false) {
          updates.deviceSyncStatus = 'pending';
        }
      }

      const result = await col.updateOne({ id: targetId }, { $set: updates });
      if (result.matchedCount === 0) {
        return { status: 404, jsonBody: { error: 'Alarm item not found.' } };
      }

      const updated = await col.findOne({ id: targetId });
      const { _id, ...rest } = updated || {};

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, alarm: rest }
      };
    }

    // ── 6. DELETE /api/alarms/:id (Delete Alarm or Reminder) ───────────────────
    if (method === 'DELETE') {
      const targetId = alarmId || pathParts[0];
      if (!targetId) return { status: 400, jsonBody: { error: 'Missing alarm ID in URL.' } };

      const result = await col.deleteOne({ id: targetId });
      if (result.deletedCount === 0) {
        return { status: 404, jsonBody: { error: 'Alarm item not found.' } };
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, message: 'Deleted alarm item.' }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Alarms handler error:', err);
    await logAppError('alarms', err, { method, url: request.url });
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('alarms', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'alarms/{*subpath}',
  handler: alarmsHandler
});
