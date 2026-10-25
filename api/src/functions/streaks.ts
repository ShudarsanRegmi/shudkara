import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { connectToMongo } from './db';

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'shudarsanregmi555@gmail.com';

function createEmailTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: OWNER_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD || ''
    }
  });
}

export interface StreakCheckIn {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  photoUrl?: string;
  photos?: string[];
  title?: string;
  notes?: string;
  isLeaveDay?: boolean;
}

export interface StreakItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  targetTime: string; // HH:mm format, e.g. "17:00"
  restDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  freezesRemaining: number;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt?: string;
  checkIns: StreakCheckIn[];
}

export interface StreakNotificationSettings {
  email: string;
  emailRemindersEnabled: boolean;
  browserNotificationsEnabled: boolean;
  remindHoursBefore: number[]; // e.g. [2, 0.5]
  annoyanceLevel: 'chill' | 'firm' | 'unhinged_duolingo';
}

const DEFAULT_SETTINGS: StreakNotificationSettings = {
  email: OWNER_EMAIL,
  emailRemindersEnabled: true,
  browserNotificationsEnabled: true,
  remindHoursBefore: [2, 0.5],
  annoyanceLevel: 'unhinged_duolingo'
};

export async function streaksHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Expected paths:
  // /api/streaks
  // /api/streaks/{id}
  // /api/streaks/{id}/checkin
  // /api/streaks/{id}/checkin/{date}
  // /api/streaks/settings
  // /api/streaks/send-alert

  const isApi = pathParts[0] === 'api';
  const baseIndex = isApi ? 1 : 0;
  const subPath1 = pathParts[baseIndex + 1]; // streakId OR 'settings' OR 'send-alert'
  const subPath2 = pathParts[baseIndex + 2]; // 'checkin'
  const subPath3 = pathParts[baseIndex + 3]; // date for delete checkin

  try {
    const db = await connectToMongo();
    const streaksCol = db.collection('streaks');
    const settingsCol = db.collection('userSettings');

    // ── 1. Notification Settings: GET /api/streaks/settings ──────────────────
    if (method === 'GET' && subPath1 === 'settings') {
      const doc = await settingsCol.findOne({ key: 'streakNotifications' });
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { settings: doc ? doc.settings : DEFAULT_SETTINGS }
      };
    }

    // ── 2. Notification Settings: POST /api/streaks/settings ─────────────────
    if (method === 'POST' && subPath1 === 'settings') {
      let body: any;
      try { body = await request.json(); } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }
      const newSettings = { ...DEFAULT_SETTINGS, ...(body.settings || body) };
      await settingsCol.updateOne(
        { key: 'streakNotifications' },
        { $set: { key: 'streakNotifications', settings: newSettings, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      return { status: 200, jsonBody: { success: true, settings: newSettings } };
    }

    // ── 3. Send Email Alert / Reminder: POST /api/streaks/send-alert ─────────
    if (method === 'POST' && subPath1 === 'send-alert') {
      let body: any;
      try { body = await request.json(); } catch { body = {}; }

      const streakTitle = body.streakTitle || 'Daily Challenge';
      const streakCount = body.streakCount || 0;
      const targetTime = body.targetTime || 'End of Day';
      const urgency = body.urgency || 'urgent'; // 'warning' | 'urgent' | 'critical' | 'test'
      const customEmail = body.email;

      // Fetch saved settings for email
      const settingsDoc = await settingsCol.findOne({ key: 'streakNotifications' });
      const currentSettings = settingsDoc?.settings || DEFAULT_SETTINGS;
      const recipient = customEmail || currentSettings.email || OWNER_EMAIL;

      if (!process.env.GMAIL_APP_PASSWORD) {
        return {
          status: 503,
          jsonBody: {
            error: 'GMAIL_APP_PASSWORD is not set in server environment. Notifications cannot be sent.'
          }
        };
      }

      const transporter = createEmailTransporter();

      let subject = `URGENT: Complete your ${streakTitle} streak!`;
      let headline = `Don't let your ${streakCount}-day streak die!`;
      let duolingoRant = "Looks like you haven't checked in yet today. Is whatever you're doing right now really worth breaking your streak? Discipline requires daily consistency.";
      let headerBg = '#dc2626'; // red

      if (urgency === 'test') {
        subject = `Streaks Alert Test: Shudkara Reminders Configured`;
        headline = `Test Alert for ${streakTitle}`;
        duolingoRant = `Great job! Your email notification system is operational. When your streak is in danger, you will receive reminders right here.`;
        headerBg = '#2563eb'; // blue
      } else if (urgency === 'warning') {
        subject = `Reminder: ${streakTitle} due today by ${targetTime}`;
        headline = `Keep your ${streakCount}-day momentum alive!`;
        duolingoRant = `You still have time before ${targetTime}, but don't leave it to the last second! Grab your photo proof now!`;
        headerBg = '#ea580c'; // orange
      } else if (urgency === 'critical') {
        subject = `CRITICAL ALERT: ${streakTitle} streak expires TONIGHT!`;
        headline = `CRITICAL ALERT: Your ${streakCount}-day streak is about to be ERASED!`;
        duolingoRant = `You are past your target time! Upload your photo proof immediately before midnight or say goodbye to all your hard-earned streak days!`;
        headerBg = '#b91c1c'; // dark red
      }

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: ${headerBg}; padding: 32px 24px; text-align: center; color: #ffffff;">
            <div style="font-size: 16px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; opacity: 0.9;">STREAK GUARDIAN</div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${headline}</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; font-weight: 600;">Target Time: ${targetTime}</p>
          </div>
          
          <div style="padding: 32px 24px; color: #1e293b;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">Current Streak</span>
              <span style="display: block; font-size: 44px; font-weight: 900; color: #ea580c; line-height: 1.2;">${streakCount} DAYS</span>
              <span style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-top: 4px;">Challenge: ${streakTitle}</span>
            </div>

            <div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #991b1b; font-weight: 500;">
                "${duolingoRant}"
              </p>
            </div>

            <div style="text-align: center; margin: 32px 0 16px 0;">
              <a href="https://shudkara.shudarsanregmi.com.np/?tab=streaks" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                Check In & Upload Photo Proof
              </a>
            </div>

            <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px;">
              Sent by Shudkara Streaks Reminders • Discipline and Consistency System
            </p>
          </div>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: `"Shudkara Streaks" <${OWNER_EMAIL}>`,
          to: recipient,
          subject,
          html: emailHtml
        });
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: true, message: `Email alert sent to ${recipient}` }
        };
      } catch (mailErr: any) {
        context.error('Failed to send streak email:', mailErr);
        return {
          status: 500,
          jsonBody: { error: 'Failed to send email alert.', details: mailErr.message }
        };
      }
    }

    // ── 4. Checkin Submission / Edit: POST /api/streaks/{id}/checkin ────────
    if (method === 'POST' && subPath1 && subPath2 === 'checkin') {
      const streakId = subPath1;
      let body: any;
      try { body = await request.json(); } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { date, photoUrl, photos, title, notes, isLeaveDay } = body;
      if (!date || typeof date !== 'string') {
        return { status: 400, jsonBody: { error: 'Check-in date (YYYY-MM-DD) is required.' } };
      }

      const streak = await streaksCol.findOne({ id: streakId });
      if (!streak) {
        return { status: 404, jsonBody: { error: 'Streak not found.' } };
      }

      const existingCheckIns: StreakCheckIn[] = Array.isArray(streak.checkIns) ? streak.checkIns : [];
      const existingItem = existingCheckIns.find(c => c.date === date.trim());

      // Normalize photos array (supports both multi-photo array and legacy single photoUrl)
      let photosArray: string[] = [];
      if (Array.isArray(photos) && photos.length > 0) {
        photosArray = photos.filter((p: any) => typeof p === 'string' && p.trim().length > 0);
      } else if (photoUrl && typeof photoUrl === 'string') {
        photosArray = [photoUrl];
      } else if (existingItem?.photos && Array.isArray(existingItem.photos)) {
        photosArray = existingItem.photos;
      } else if (existingItem?.photoUrl) {
        photosArray = [existingItem.photoUrl];
      }

      const checkInItem: StreakCheckIn = {
        id: existingItem?.id || crypto.randomBytes(8).toString('hex'),
        date: date.trim(),
        timestamp: existingItem?.timestamp || new Date().toISOString(),
        photoUrl: photosArray[0] || undefined,
        photos: photosArray,
        title: title !== undefined ? (title?.trim() || undefined) : existingItem?.title,
        notes: notes !== undefined ? (notes?.trim() || undefined) : existingItem?.notes,
        isLeaveDay: isLeaveDay !== undefined ? !!isLeaveDay : !!existingItem?.isLeaveDay
      };

      // Upsert: replace check-in for the same date if it already exists, or append
      const filtered = existingCheckIns.filter(c => c.date !== checkInItem.date);
      filtered.push(checkInItem);
      filtered.sort((a, b) => a.date.localeCompare(b.date));

      await streaksCol.updateOne(
        { id: streakId },
        { $set: { checkIns: filtered, updatedAt: new Date().toISOString() } }
      );

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, checkIn: checkInItem }
      };
    }

    // ── 5. Delete Checkin: DELETE /api/streaks/{id}/checkin/{date} ───────────
    if (method === 'DELETE' && subPath1 && subPath2 === 'checkin' && subPath3) {
      const streakId = subPath1;
      const targetDate = subPath3;

      const streak = await streaksCol.findOne({ id: streakId });
      if (!streak) {
        return { status: 404, jsonBody: { error: 'Streak not found.' } };
      }

      const existingCheckIns: StreakCheckIn[] = Array.isArray(streak.checkIns) ? streak.checkIns : [];
      const updated = existingCheckIns.filter(c => c.date !== targetDate);

      await streaksCol.updateOne(
        { id: streakId },
        { $set: { checkIns: updated, updatedAt: new Date().toISOString() } }
      );

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, removedDate: targetDate }
      };
    }

    // ── 6. GET /api/streaks - List all streaks + settings ─────────────────────
    if (method === 'GET' && !subPath1) {
      const streaks = await streaksCol.find({}).sort({ createdAt: -1 }).toArray();
      const settingsDoc = await settingsCol.findOne({ key: 'streakNotifications' });

      const cleaned = streaks.map(s => {
        const { _id, ...rest } = s;
        return rest;
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          streaks: cleaned,
          notificationSettings: settingsDoc ? settingsDoc.settings : DEFAULT_SETTINGS
        }
      };
    }

    // ── 7. POST /api/streaks - Create a new streak ───────────────────────────
    if (method === 'POST' && !subPath1) {
      let body: any;
      try { body = await request.json(); } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { title, description, category, targetTime, restDays, color, icon } = body;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return { status: 400, jsonBody: { error: 'Streak title is required.' } };
      }

      const newStreak: StreakItem = {
        id: crypto.randomBytes(12).toString('hex'),
        title: title.trim(),
        description: description?.trim() || undefined,
        category: category?.trim() || 'General',
        targetTime: targetTime?.trim() || '17:00',
        restDays: Array.isArray(restDays) ? restDays : [],
        freezesRemaining: 3,
        color: color || '#ea580c',
        icon: icon || 'Flame',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checkIns: []
      };

      await streaksCol.insertOne(newStreak);

      return {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, streak: newStreak }
      };
    }

    // ── 8. PUT /api/streaks/{id} - Update streak definition ───────────────────
    if (method === 'PUT' && subPath1 && !subPath2) {
      const streakId = subPath1;
      let body: any;
      try { body = await request.json(); } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { title, description, category, targetTime, restDays, color, icon, freezesRemaining } = body;
      const updateFields: any = { updatedAt: new Date().toISOString() };
      if (title !== undefined) updateFields.title = title.trim();
      if (description !== undefined) updateFields.description = description.trim();
      if (category !== undefined) updateFields.category = category.trim();
      if (targetTime !== undefined) updateFields.targetTime = targetTime.trim();
      if (restDays !== undefined && Array.isArray(restDays)) updateFields.restDays = restDays;
      if (color !== undefined) updateFields.color = color;
      if (icon !== undefined) updateFields.icon = icon;
      if (freezesRemaining !== undefined) updateFields.freezesRemaining = Number(freezesRemaining);

      const res = await streaksCol.updateOne({ id: streakId }, { $set: updateFields });
      if (res.matchedCount === 0) {
        return { status: 404, jsonBody: { error: 'Streak not found.' } };
      }

      const updated = await streaksCol.findOne({ id: streakId });
      const { _id, ...rest } = updated!;
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, streak: rest }
      };
    }

    // ── 9. DELETE /api/streaks/{id} - Delete streak ───────────────────────────
    if (method === 'DELETE' && subPath1 && !subPath2) {
      const streakId = subPath1;
      const res = await streaksCol.deleteOne({ id: streakId });
      if (res.deletedCount === 0) {
        return { status: 404, jsonBody: { error: 'Streak not found.' } };
      }
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, id: streakId }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Streaks handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('streaks', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'streaks/{*subpath}',
  handler: streaksHandler
});
