import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { Db } from 'mongodb';
import { connectToMongo, verifySession, extractToken } from './db';

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

// ── Default Worksets Seeder (Clean icon names, no emojis) ────────────────────
const DEFAULT_WORKSETS = [
  { id: 'work', title: 'Work & Projects', icon: 'Briefcase', color: 'blue', order: 1, createdAt: new Date().toISOString() },
  { id: 'research', title: 'Research & Study', icon: 'BookOpen', color: 'purple', order: 2, createdAt: new Date().toISOString() },
  { id: 'dev', title: 'Development', icon: 'Code', color: 'emerald', order: 3, createdAt: new Date().toISOString() },
  { id: 'personal', title: 'Personal & Home', icon: 'Home', color: 'amber', order: 4, createdAt: new Date().toISOString() }
];

// ── Email Alert Dispatcher (Harmonic with Shudkara Warm Palette) ──────────────
export async function sendCommitmentEmailAlert(
  commitment: any,
  alertType: string,
  extraReason?: string
): Promise<{ success: boolean; error?: string }> {
  const transporter = createEmailTransporter();
  const deadlineDate = new Date(commitment.deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const isOverdue = diffMs <= 0;

  // Format human-friendly time remaining without emojis
  let timeRemainingStr = '';
  if (isOverdue) {
    const overdueMins = Math.abs(Math.floor(diffMs / (1000 * 60)));
    const overdueHours = Math.floor(overdueMins / 60);
    const overdueDays = Math.floor(overdueHours / 24);
    timeRemainingStr = overdueDays > 0
      ? `OVERDUE BY ${overdueDays}d ${overdueHours % 24}h`
      : `OVERDUE BY ${overdueHours}h ${overdueMins % 60}m`;
  } else {
    const remMins = Math.floor(diffMs / (1000 * 60));
    const remHours = Math.floor(remMins / 60);
    const remDays = Math.floor(remHours / 24);
    timeRemainingStr = remDays > 0
      ? `Due in ${remDays}d ${remHours % 24}h`
      : `Due in ${remHours}h ${remMins % 60}m`;
  }

  const istDeadline = deadlineDate.toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  // Clean, professional subject line with zero emojis
  let subjectPrefix = '[PRATIGYA]';
  if (alertType === 'breach' || isOverdue) {
    subjectPrefix = '[PRATIGYA BREACH]';
  } else if (commitment.urgency === 'sacred') {
    subjectPrefix = '[SACRED COVENANT]';
  } else if (alertType.includes('24h')) {
    subjectPrefix = '[PRATIGYA 24H]';
  } else if (alertType.includes('6h')) {
    subjectPrefix = '[PRATIGYA 6H]';
  } else if (alertType === 'test') {
    subjectPrefix = '[PRATIGYA NOTICE]';
  }

  const subject = `${subjectPrefix} Word to ${commitment.recipientName}: "${commitment.title}"`;

  // Harmonic warm colors matching Shudkara's ivory/charcoal/amber palette
  const statusBg = isOverdue ? '#fdf2f2' : '#f5eedf';
  const statusText = isOverdue ? '#991b1b' : '#8c6e35';
  const statusBorder = isOverdue ? '#f87171' : '#caa15d';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fdfbf7; margin: 0; padding: 24px; color: #1c1714; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e3dfda; box-shadow: 0 4px 20px -2px rgba(46, 39, 36, 0.06); }
    .header { background: #1c1714; padding: 26px 28px 22px; color: #ffffff; border-bottom: 3px solid #caa15d; }
    .header-sub { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #caa15d; margin-bottom: 4px; }
    .header-motto { font-size: 13px; color: #d6d0c7; font-style: italic; margin-top: 6px; }
    .body { padding: 28px; }
    .status-badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; background: ${statusBg}; color: ${statusText}; border: 1px solid ${statusBorder}; margin-bottom: 20px; text-transform: uppercase; }
    .title { font-size: 20px; font-weight: 800; color: #1c1714; margin: 0 0 16px; line-height: 1.35; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fdfbf7; border-radius: 10px; margin-bottom: 8px; border: 1px solid #e3dfda; }
    .info-label { font-size: 12px; font-weight: 600; color: #6e645c; }
    .info-val { font-size: 13px; font-weight: 700; color: #1c1714; }
    .desc-box { background: #fdfbf7; border-left: 3px solid #caa15d; padding: 12px 16px; border-radius: 0 10px 10px 0; margin: 16px 0; font-size: 13px; line-height: 1.5; color: #2e2724; }
    .reneg-box { background: #f5eedf; border: 1px solid #ebddc2; border-radius: 10px; padding: 12px 16px; margin: 16px 0; font-size: 12px; color: #8c6e35; }
    .button { display: block; text-align: center; background: #1c1714; color: #ffffff !important; font-weight: 700; font-size: 13px; padding: 13px 20px; border-radius: 10px; text-decoration: none; margin-top: 24px; }
    .footer { text-align: center; padding: 18px; font-size: 11px; color: #8a8076; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-sub">Shudkara Pratigya &bull; Covenant Ledger</div>
      <div style="font-size: 16px; font-weight: 800; color: #ffffff;">Commitment Alert</div>
      <div class="header-motto">"रघुकुल रीत सदा चली आई, प्राण जाई पर वचन न जाई"</div>
    </div>
    <div class="body">
      <div class="status-badge">
        ${timeRemainingStr}
      </div>

      <h1 class="title">${commitment.title}</h1>

      <div class="info-row">
        <span class="info-label">Word Given To</span>
        <span class="info-val">${commitment.recipientName}${commitment.recipientContact ? ` (${commitment.recipientContact})` : ''}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Deadline (IST)</span>
        <span class="info-val">${istDeadline}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Urgency Tier</span>
        <span class="info-val" style="text-transform: uppercase;">${commitment.urgency}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Notification Type</span>
        <span class="info-val" style="color: #6e645c;">${extraReason || alertType}</span>
      </div>

      ${commitment.description ? `
      <div class="desc-box">
        <strong>Context & Scope:</strong><br/>
        ${commitment.description.replace(/\n/g, '<br/>')}
      </div>` : ''}

      ${Array.isArray(commitment.renegotiationHistory) && commitment.renegotiationHistory.length > 0 ? `
      <div class="reneg-box">
        <strong>Renegotiation Notice:</strong> Extended ${commitment.renegotiationHistory.length} time(s).<br/>
        Latest justification: <em>"${commitment.renegotiationHistory[commitment.renegotiationHistory.length - 1].reason}"</em>
      </div>` : ''}

      <a href="https://regmishudarsan.com.np/?tab=todos&pillar=pratigya" class="button">
        Open Commitment in Shudkara &rarr;
      </a>
    </div>
    <div class="footer">
      Autonomous Sentinel &bull; Shudkara Tasks & Covenant Engine &bull; Dispatched to ${OWNER_EMAIL}
    </div>
  </div>
</body>
</html>
`;

  try {
    await transporter.sendMail({
      from: `"Shudkara Pratigya" <${OWNER_EMAIL}>`,
      to: OWNER_EMAIL,
      subject,
      html
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Autonomous Alerting Audit Algorithm ───────────────────────────────────────
export async function runPratigyaAlertAudit(
  db: Db,
  context?: InvocationContext
): Promise<{ checkedCount: number; sentCount: number }> {
  const commitmentsCol = db.collection('commitments');
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Retrieve active commitments (active, renegotiated, breached)
  const activeCommitments = await commitmentsCol.find({
    status: { $in: ['active', 'renegotiated', 'breached'] }
  }).toArray();

  let sentCount = 0;

  for (const item of activeCommitments) {
    try {
      const deadline = new Date(item.deadline);
      const createdAt = item.createdAt ? new Date(item.createdAt) : new Date(now.getTime() - 86400000);
      const diffMs = deadline.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const horizonSpanDays = Math.max(0.1, (deadline.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const alertHistory: any[] = Array.isArray(item.alertHistory) ? item.alertHistory : [];

      const hasAlert = (key: string) => alertHistory.some(a => a.alertKey === key);

      let targetAlertKey: string | null = null;
      let targetAlertType: string | null = null;
      let reasonText: string = '';

      // ── Condition 1: Overdue / Breached ───────────────────────────────────
      if (diffMs <= 0) {
        const breachKey = `breach_${todayStr}`;
        if (!hasAlert(breachKey)) {
          targetAlertKey = breachKey;
          targetAlertType = 'breach';
          reasonText = `Daily Overdue Covenant Notice (${todayStr})`;
        }
      } 
      // ── Condition 2: Short-Term (<= 3 Days) ──────────────────────────────
      else if (horizonSpanDays <= 3) {
        if (diffHours <= 6 && !hasAlert('short_T-6h')) {
          targetAlertKey = 'short_T-6h';
          targetAlertType = 'short_T-6h';
          reasonText = 'Short-term horizon: 6 hours remaining';
        } else if (diffHours <= 24 && !hasAlert('short_T-24h')) {
          targetAlertKey = 'short_T-24h';
          targetAlertType = 'short_T-24h';
          reasonText = 'Short-term horizon: 24 hours remaining';
        } else if (diffHours <= 12 && !hasAlert(`short_morning_${todayStr}`)) {
          targetAlertKey = `short_morning_${todayStr}`;
          targetAlertType = 'short_morning';
          reasonText = 'Short-term horizon: Deadline morning';
        }
      }
      // ── Condition 3: Medium-Term (3 to 14 Days) ───────────────────────────
      else if (horizonSpanDays <= 14) {
        if (diffHours <= 24 && !hasAlert('med_T-24h')) {
          targetAlertKey = 'med_T-24h';
          targetAlertType = 'med_T-24h';
          reasonText = 'Medium-term horizon: 24 hours final day alert';
        } else if (diffHours <= 72 && !hasAlert('med_T-3d')) {
          targetAlertKey = 'med_T-3d';
          targetAlertType = 'med_T-3d';
          reasonText = 'Medium-term horizon: 3 days remaining';
        } else if (diffHours <= 12 && !hasAlert(`med_morning_${todayStr}`)) {
          targetAlertKey = `med_morning_${todayStr}`;
          targetAlertType = 'med_morning';
          reasonText = 'Medium-term horizon: Due today morning';
        }
      }
      // ── Condition 4: Long-Term (> 14 Days) ────────────────────────────────
      else {
        if (diffHours <= 24 && !hasAlert('long_T-24h')) {
          targetAlertKey = 'long_T-24h';
          targetAlertType = 'long_T-24h';
          reasonText = 'Long-term horizon: 24-hour final call';
        } else if (diffHours <= 72 && !hasAlert('long_T-3d')) {
          targetAlertKey = 'long_T-3d';
          targetAlertType = 'long_T-3d';
          reasonText = 'Long-term horizon: 3 days countdown checkpoint';
        } else if (diffHours <= 168 && !hasAlert('long_T-7d')) {
          targetAlertKey = 'long_T-7d';
          targetAlertType = 'long_T-7d';
          reasonText = 'Long-term horizon: 1 week (7 days) advance warning';
        } else if (diffHours <= 336 && !hasAlert('long_T-14d')) {
          targetAlertKey = 'long_T-14d';
          targetAlertType = 'long_T-14d';
          reasonText = 'Long-term horizon: 2 weeks (14 days) advance notice';
        } else {
          // Bi-weekly progress ping check
          const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          const biweeklyIndex = Math.floor(daysSinceCreation / 14);
          if (biweeklyIndex > 0 && daysSinceCreation % 14 === 0 && !hasAlert(`long_biweekly_${biweeklyIndex}`)) {
            targetAlertKey = `long_biweekly_${biweeklyIndex}`;
            targetAlertType = 'biweekly_digest';
            reasonText = `Long-term bi-weekly commitment digest (Checkpoint #${biweeklyIndex})`;
          }
        }
      }

      if (targetAlertKey && targetAlertType) {
        const emailRes = await sendCommitmentEmailAlert(item, targetAlertType, reasonText);
        if (emailRes.success) {
          sentCount++;
          const newRecord = {
            alertKey: targetAlertKey,
            sentAt: now.toISOString(),
            type: targetAlertType
          };
          const updatePayload: any = {
            $push: { alertHistory: newRecord }
          };
          if (targetAlertType === 'breach' && item.status === 'active') {
            updatePayload.$set = { status: 'breached' };
          }
          await commitmentsCol.updateOne({ id: item.id }, updatePayload);
          context?.log?.(`Dispatched Pratigya alert [${targetAlertKey}] for "${item.title}" to ${OWNER_EMAIL}`);
        } else {
          context?.warn?.(`Failed to send Pratigya alert email for "${item.title}":`, emailRes.error);
        }
      }
    } catch (itemErr: any) {
      context?.error?.(`Error evaluating commitment ${item.id}:`, itemErr);
    }
  }

  return { checkedCount: activeCommitments.length, sentCount };
}

// ── Main HTTP Handler ────────────────────────────────────────────────────────
export async function todosHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/^\/api\/todos\/?/, '').split('/').filter(Boolean);

  const primarySection = pathParts[0] || '';
  const secondParam = pathParts[1] || '';
  const thirdParam = pathParts[2] || '';

  try {
    const db = await connectToMongo();
    const whiteboardCol = db.collection('todos');
    const worksetsCol = db.collection('task_worksets');
    const tasksCol = db.collection('tasks');
    const commitmentsCol = db.collection('commitments');
    const settingsCol = db.collection('userSettings');

    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // ── 1. GET - Fetch Complete Three-Pillar State ────────────────────────────
    if (method === 'GET') {
      // 1.1 Whiteboard Notes
      let whiteboardNotes = await whiteboardCol.find({}).toArray();

      // Legacy auto-migration check
      if (whiteboardNotes.length === 0) {
        const userDataCol = db.collection('userData');
        const legacyDoc = await userDataCol.findOne({ syncKey: 'global_user' });
        if (legacyDoc && Array.isArray(legacyDoc.todos) && legacyDoc.todos.length > 0) {
          await whiteboardCol.insertMany(legacyDoc.todos);
          if (legacyDoc.todoBoardPrivate !== undefined) {
            await settingsCol.updateOne(
              { key: 'todoBoardPrivate' },
              { $set: { key: 'todoBoardPrivate', value: !!legacyDoc.todoBoardPrivate } },
              { upsert: true }
            );
          }
          whiteboardNotes = legacyDoc.todos;
        }
      }

      // 1.2 Board Privacy
      const privacyDoc = await settingsCol.findOne({ key: 'todoBoardPrivate' });
      const isBoardPrivate = privacyDoc ? !!privacyDoc.value : false;

      // 1.3 Worksets
      let worksets = await worksetsCol.find({}).sort({ order: 1, createdAt: 1 }).toArray();
      if (worksets.length === 0) {
        await worksetsCol.insertMany(DEFAULT_WORKSETS);
        worksets = DEFAULT_WORKSETS as any[];
      }

      // 1.4 Tasks
      let tasks = await tasksCol.find({}).sort({ order: 1, createdAt: -1 }).toArray();

      // 1.5 Commitments
      let commitments = await commitmentsCol.find({}).sort({ deadline: 1 }).toArray();

      // Filter for unauthenticated visitor
      const visibleWhiteboard = isAuthorized
        ? whiteboardNotes
        : (isBoardPrivate ? [] : whiteboardNotes.filter(t => !t.isPrivate));

      const visibleTasks = isAuthorized
        ? tasks
        : (isBoardPrivate ? [] : tasks.filter(t => !t.isPrivate));

      const visibleCommitments = isAuthorized
        ? commitments
        : (isBoardPrivate ? [] : commitments.filter(c => c.urgency !== 'sacred'));

      const cleanDoc = (doc: any) => {
        const { _id, ...rest } = doc;
        return rest;
      };

      const cleanedWhiteboard = visibleWhiteboard.map(cleanDoc);
      const cleanedWorksets = worksets.map(cleanDoc);
      const cleanedTasks = visibleTasks.map(cleanDoc);
      const cleanedCommitments = visibleCommitments.map(cleanDoc);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          todos: cleanedWhiteboard, // 100% backward compatibility
          whiteboard: cleanedWhiteboard,
          worksets: cleanedWorksets,
          tasks: cleanedTasks,
          commitments: cleanedCommitments,
          isBoardPrivate
        }
      };
    }

    // ── 2. POST /api/todos/privacy — Toggle Privacy ──────────────────────────
    if (primarySection === 'privacy') {
      if (!isAuthorized) return { status: 401, jsonBody: { error: 'Unauthorized.' } };
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const isBoardPrivate = !!body.isBoardPrivate;
      await settingsCol.updateOne(
        { key: 'todoBoardPrivate' },
        { $set: { key: 'todoBoardPrivate', value: isBoardPrivate } },
        { upsert: true }
      );
      return { status: 200, jsonBody: { success: true, isBoardPrivate } };
    }

    // ── Writes & Modifications Require Authentication ────────────────────────
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized. Authentication required for write operations.' } };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── 3. WORKSETS CRUD ─────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────
    if (primarySection === 'worksets') {
      if (method === 'POST') {
        let body: any;
        try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
        const { title, icon, color, order } = body;
        if (!title || typeof title !== 'string') {
          return { status: 400, jsonBody: { error: 'Workset title is required.' } };
        }
        const id = body.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 12));
        const newWorkset = {
          id,
          title: title.trim(),
          icon: icon || 'Folder',
          color: color || 'blue',
          order: typeof order === 'number' ? order : Date.now(),
          createdAt: body.createdAt || new Date().toISOString()
        };
        await worksetsCol.updateOne({ id }, { $set: newWorkset }, { upsert: true });
        return { status: 201, jsonBody: { success: true, workset: newWorkset } };
      }

      if (method === 'PUT' && secondParam) {
        let body: any;
        try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
        const updates: Record<string, any> = {};
        if (body.title !== undefined) updates.title = body.title.trim();
        if (body.icon !== undefined) updates.icon = body.icon;
        if (body.color !== undefined) updates.color = body.color;
        if (body.order !== undefined) updates.order = body.order;

        const res = await worksetsCol.updateOne({ id: secondParam }, { $set: updates });
        if (res.matchedCount === 0) return { status: 404, jsonBody: { error: 'Workset not found.' } };
        return { status: 200, jsonBody: { success: true } };
      }

      if (method === 'DELETE' && secondParam) {
        await worksetsCol.deleteOne({ id: secondParam });
        // Re-assign orphaned tasks to default 'work'
        await tasksCol.updateMany({ worksetId: secondParam }, { $set: { worksetId: 'work' } });
        return { status: 200, jsonBody: { success: true } };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── 4. TASKS CRUD (Kārya) ────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────
    if (primarySection === 'tasks') {
      if (method === 'POST') {
        let body: any;
        try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
        const { title, worksetId, notes, dueDate, priority, subtasks, tags, order } = body;
        if (!title || typeof title !== 'string') {
          return { status: 400, jsonBody: { error: 'Task title is required.' } };
        }
        const id = body.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 12));
        const newTask = {
          id,
          worksetId: worksetId || 'work',
          title: title.trim(),
          notes: notes || '',
          dueDate: dueDate || null,
          priority: ['p1', 'p2', 'p3'].includes(priority) ? priority : 'p3',
          subtasks: Array.isArray(subtasks) ? subtasks : [],
          tags: Array.isArray(tags) ? tags : [],
          completed: !!body.completed,
          completedAt: body.completed ? new Date().toISOString() : null,
          order: typeof order === 'number' ? order : Date.now(),
          createdAt: body.createdAt || new Date().toISOString()
        };
        await tasksCol.updateOne({ id }, { $set: newTask }, { upsert: true });
        return { status: 201, jsonBody: { success: true, task: newTask } };
      }

      if (method === 'PUT' && secondParam) {
        let body: any;
        try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
        const updates: Record<string, any> = {};
        if (body.title !== undefined) updates.title = body.title.trim();
        if (body.worksetId !== undefined) updates.worksetId = body.worksetId;
        if (body.notes !== undefined) updates.notes = body.notes;
        if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
        if (body.priority !== undefined) updates.priority = body.priority;
        if (body.subtasks !== undefined) updates.subtasks = body.subtasks;
        if (body.tags !== undefined) updates.tags = body.tags;
        if (body.order !== undefined) updates.order = body.order;
        if (body.completed !== undefined) {
          updates.completed = !!body.completed;
          updates.completedAt = body.completed ? new Date().toISOString() : null;
        }

        const res = await tasksCol.updateOne({ id: secondParam }, { $set: updates });
        if (res.matchedCount === 0) return { status: 404, jsonBody: { error: 'Task not found.' } };
        return { status: 200, jsonBody: { success: true } };
      }

      if (method === 'DELETE') {
        if (secondParam === 'completed') {
          await tasksCol.deleteMany({ completed: true });
          return { status: 200, jsonBody: { success: true, message: 'Cleared completed tasks.' } };
        }
        if (!secondParam) return { status: 400, jsonBody: { error: 'Task ID required.' } };
        const res = await tasksCol.deleteOne({ id: secondParam });
        if (res.deletedCount === 0) return { status: 404, jsonBody: { error: 'Task not found.' } };
        return { status: 200, jsonBody: { success: true } };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── 5. PRATIGYA COMMITMENTS CRUD (प्रतिज्ञा) ──────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────
    if (primarySection === 'commitments') {
      // 5.1 POST /api/todos/commitments/test-alert
      if (secondParam === 'test-alert' && method === 'POST') {
        let body: any = {};
        try { body = await request.json(); } catch {}

        let targetCommitment = body.commitment;
        if (!targetCommitment && body.id) {
          targetCommitment = await commitmentsCol.findOne({ id: body.id });
        }
        if (!targetCommitment) {
          targetCommitment = {
            id: 'sample-commitment',
            title: 'Deliver Core Milestone Documentation & Architectural Audit',
            recipientName: 'Prof. Sharma (Advisor)',
            recipientContact: 'advisor@university.edu',
            deadline: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
            urgency: 'sacred',
            status: 'active',
            description: 'Demonstrating complete end-to-end multi-tenant synchronization and horizon alert tests.'
          };
        }

        const alertRes = await sendCommitmentEmailAlert(targetCommitment, 'test', 'Manual Alert Verification');
        if (!alertRes.success) {
          return { status: 500, jsonBody: { error: 'Failed to send alert email.', details: alertRes.error } };
        }
        return { status: 200, jsonBody: { success: true, message: `Alert dispatched to ${OWNER_EMAIL}` } };
      }

      // 5.2 PUT /api/todos/commitments/:id/honor
      if (method === 'PUT' && thirdParam === 'honor') {
        let body: any = {};
        try { body = await request.json(); } catch {}
        const now = new Date().toISOString();
        const res = await commitmentsCol.updateOne(
          { id: secondParam },
          {
            $set: {
              status: 'honored',
              fulfilledAt: now,
              proofNotes: body.proofNotes || ''
            }
          }
        );
        if (res.matchedCount === 0) return { status: 404, jsonBody: { error: 'Commitment not found.' } };
        return { status: 200, jsonBody: { success: true, status: 'honored', fulfilledAt: now } };
      }

      // 5.3 PUT /api/todos/commitments/:id/renegotiate
      if (method === 'PUT' && thirdParam === 'renegotiate') {
        let body: any;
        try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
        const { newDeadline, reason } = body;
        if (!newDeadline || !reason) {
          return { status: 400, jsonBody: { error: 'New deadline and renegotiation justification reason are required.' } };
        }

        const existing = await commitmentsCol.findOne({ id: secondParam });
        if (!existing) return { status: 404, jsonBody: { error: 'Commitment not found.' } };

        const renegotiationRecord = {
          previousDeadline: existing.deadline,
          newDeadline,
          reason: reason.trim(),
          timestamp: new Date().toISOString()
        };

        await commitmentsCol.updateOne(
          { id: secondParam },
          {
            $set: {
              deadline: newDeadline,
              status: 'renegotiated'
            },
            $push: {
              renegotiationHistory: renegotiationRecord
            } as any
          }
        );

        return { status: 200, jsonBody: { success: true, renegotiation: renegotiationRecord } };
      }

      // 5.4 POST /api/todos/commitments - Create new commitment
      if (method === 'POST') {
        let body: any;
        try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
        const { title, description, recipientName, recipientContact, deadline, urgency, proofNotes } = body;

        if (!title || !recipientName || !deadline) {
          return { status: 400, jsonBody: { error: 'Title, recipientName, and deadline are required.' } };
        }

        const id = body.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 12));
        const newCommitment = {
          id,
          title: title.trim(),
          description: description ? description.trim() : '',
          recipientName: recipientName.trim(),
          recipientContact: recipientContact ? recipientContact.trim() : '',
          deadline: new Date(deadline).toISOString(),
          urgency: ['sacred', 'high', 'standard', 'flexible'].includes(urgency) ? urgency : 'standard',
          status: 'active',
          fulfilledAt: null,
          proofNotes: proofNotes || '',
          renegotiationHistory: [],
          alertHistory: [],
          createdAt: body.createdAt || new Date().toISOString()
        };

        await commitmentsCol.updateOne({ id }, { $set: newCommitment }, { upsert: true });
        return { status: 201, jsonBody: { success: true, commitment: newCommitment } };
      }

      // 5.5 PUT /api/todos/commitments/:id - Update commitment
      if (method === 'PUT' && secondParam) {
        let body: any;
        try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
        const updates: Record<string, any> = {};
        if (body.title !== undefined) updates.title = body.title.trim();
        if (body.description !== undefined) updates.description = body.description.trim();
        if (body.recipientName !== undefined) updates.recipientName = body.recipientName.trim();
        if (body.recipientContact !== undefined) updates.recipientContact = body.recipientContact.trim();
        if (body.deadline !== undefined) updates.deadline = new Date(body.deadline).toISOString();
        if (body.urgency !== undefined) updates.urgency = body.urgency;
        if (body.status !== undefined) updates.status = body.status;
        if (body.proofNotes !== undefined) updates.proofNotes = body.proofNotes;

        const res = await commitmentsCol.updateOne({ id: secondParam }, { $set: updates });
        if (res.matchedCount === 0) return { status: 404, jsonBody: { error: 'Commitment not found.' } };
        return { status: 200, jsonBody: { success: true } };
      }

      // 5.6 DELETE /api/todos/commitments/:id
      if (method === 'DELETE' && secondParam) {
        await commitmentsCol.deleteOne({ id: secondParam });
        return { status: 200, jsonBody: { success: true } };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── 6. WHITEBOARD CRUD & LEGACY FALLBACK ─────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────
    if (method === 'POST' && (primarySection === '' || primarySection === 'whiteboard')) {
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }
      const { text, completed, isPrivate, color, x, y } = body;
      if (!text || typeof text !== 'string') {
        return { status: 400, jsonBody: { error: 'Text is required.' } };
      }

      const id = body.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));
      const newTodo = {
        id,
        text: text.trim(),
        completed: !!completed,
        isPrivate: !!isPrivate,
        color: color || 'yellow',
        x: typeof x === 'number' ? x : Math.floor(Math.random() * 200),
        y: typeof y === 'number' ? y : Math.floor(Math.random() * 200),
        createdAt: body.createdAt || new Date().toISOString()
      };

      await whiteboardCol.updateOne({ id }, { $set: newTodo }, { upsert: true });
      return { status: 201, jsonBody: { success: true, todo: newTodo } };
    }

    const targetWhiteboardId = primarySection === 'whiteboard' ? secondParam : primarySection;
    if (method === 'PUT' && targetWhiteboardId) {
      let body: any;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const updates: Record<string, any> = {};
      if (body.text !== undefined) updates.text = body.text.trim();
      if (body.completed !== undefined) updates.completed = !!body.completed;
      if (body.isPrivate !== undefined) updates.isPrivate = !!body.isPrivate;
      if (body.color !== undefined) updates.color = body.color;
      if (body.x !== undefined) updates.x = body.x;
      if (body.y !== undefined) updates.y = body.y;

      const result = await whiteboardCol.updateOne({ id: targetWhiteboardId }, { $set: updates });
      if (result.matchedCount === 0) {
        return { status: 404, jsonBody: { error: 'Whiteboard item not found.' } };
      }

      return { status: 200, jsonBody: { success: true } };
    }

    if (method === 'DELETE') {
      const deleteId = primarySection === 'whiteboard' ? secondParam : primarySection;
      if (deleteId === 'completed') {
        await whiteboardCol.deleteMany({ completed: true });
        return { status: 200, jsonBody: { success: true, message: 'Cleared completed todos.' } };
      }

      if (!deleteId) return { status: 400, jsonBody: { error: 'Todo ID required.' } };
      const result = await whiteboardCol.deleteOne({ id: deleteId });
      if (result.deletedCount === 0) return { status: 404, jsonBody: { error: 'Todo item not found.' } };

      return { status: 200, jsonBody: { success: true } };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed for path '${url.pathname}'.` } };
  } catch (err: any) {
    context.error('Todos handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('todos', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'todos/{*subpath}',
  handler: todosHandler
});
