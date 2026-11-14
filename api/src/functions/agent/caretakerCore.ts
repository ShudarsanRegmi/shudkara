import { Db } from 'mongodb';
import * as nodemailer from 'nodemailer';
import { harvestSystemState, SystemStateSnapshot } from './harvester';
import {
  getCoreMemory,
  getOrCreateActiveSession,
  appendMessageToSession,
  compactSessionBufferIfNeeded,
  CoreMemory
} from './memoryEngine';
import {
  getGeminiApiKey,
  synthesizeHeuristicBriefing,
  callGeminiAnalysis,
  callGeminiChat,
  CaretakerAnalysisResult
} from './geminiClient';

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

export interface CaretakerCycleResult {
  success: boolean;
  trigger: 'cron' | 'manual' | 'alert';
  timestamp: string;
  state: SystemStateSnapshot;
  coreMemory: CoreMemory;
  analysis: CaretakerAnalysisResult;
  emailSent: boolean;
}

export async function runCaretakerCycle(
  db: Db,
  trigger: 'cron' | 'manual' | 'alert' = 'manual'
): Promise<CaretakerCycleResult> {
  const state = await harvestSystemState(db);
  const coreMemory = await getCoreMemory(db);
  const apiKey = await getGeminiApiKey(db);

  let analysis: CaretakerAnalysisResult;
  if (apiKey) {
    try {
      analysis = await callGeminiAnalysis(apiKey, state, coreMemory);
    } catch (err) {
      console.warn('Caretaker: Gemini API call failed, falling back to heuristic engine:', err);
      analysis = synthesizeHeuristicBriefing(state, coreMemory);
    }
  } else {
    analysis = synthesizeHeuristicBriefing(state, coreMemory);
  }

  // Save digest to MongoDB
  const digestsCol = db.collection('caretaker_digests');
  const now = new Date().toISOString();
  const digestDoc = {
    id: `dig-${Date.now()}`,
    trigger,
    timestamp: now,
    status: analysis.status,
    headline: analysis.headline,
    digestMarkdown: analysis.digestMarkdown,
    actionItems: analysis.actionItems,
    stateSnapshot: state,
    emailSent: false
  };

  // Dispatch Email if required
  let emailSent = false;
  const shouldSendEmail = analysis.sendEmail || (trigger === 'manual' && analysis.status === 'critical_alert');
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  if (shouldSendEmail && appPassword) {
    try {
      const transporter = createEmailTransporter();
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b;">
          <div style="border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h2 style="color: #818cf8; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">SHUDKARA SENTINEL</h2>
              <span style="background-color: ${analysis.status === 'critical_alert' ? '#ef4444' : '#f59e0b'}; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
                ${analysis.status.replace('_', ' ')}
              </span>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0;">${analysis.headline}</p>
          </div>

          <div style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px;">
            ${analysis.digestMarkdown.replace(/\n/g, '<br/>')}
          </div>

          ${
            analysis.actionItems.length > 0
              ? `
            <div style="background-color: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid #334155;">
              <h4 style="margin: 0 0 10px 0; color: #fbbf24; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Recommended Micro-Actions</h4>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #f1f5f9;">
                ${analysis.actionItems.map(a => `<li style="margin-bottom: 6px;"><strong>[${a.subapp.toUpperCase()}]</strong> ${a.label}</li>`).join('')}
              </ul>
            </div>
            `
              : ''
          }

          <div style="border-top: 1px solid #334155; padding-top: 16px; text-align: center; font-size: 12px; color: #64748b;">
            <p style="margin: 0;">Sent by The Sentinel • Shudkara Autonomous Caretaker Engine</p>
            <p style="margin: 4px 0 0 0;"><a href="https://shudkara.com" style="color: #818cf8; text-decoration: none;">Open Shudkara Dashboard →</a></p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"Shudkara Sentinel" <${OWNER_EMAIL}>`,
        to: OWNER_EMAIL,
        subject: analysis.emailSubject || `[Sentinel] ${analysis.headline}`,
        html: htmlBody
      });

      emailSent = true;
      digestDoc.emailSent = true;
    } catch (mailErr) {
      console.error('Caretaker: Failed to send email briefing:', mailErr);
    }
  }

  await digestsCol.insertOne(digestDoc as any);

  return {
    success: true,
    trigger,
    timestamp: now,
    state,
    coreMemory,
    analysis,
    emailSent
  };
}

export async function processCaretakerChat(
  db: Db,
  userMessage: string,
  sessionId: string = 'main_session'
): Promise<{ replyText: string; coreMemory: CoreMemory }> {
  const state = await harvestSystemState(db);
  const coreMemory = await getCoreMemory(db);
  const session = await getOrCreateActiveSession(db, sessionId);
  const apiKey = await getGeminiApiKey(db);

  const now = new Date().toISOString();
  await appendMessageToSession(db, sessionId, {
    sender: 'user',
    content: userMessage,
    timestamp: now
  });

  let replyText = '';

  if (apiKey) {
    try {
      const chatRes = await callGeminiChat(
        apiKey,
        userMessage,
        state,
        coreMemory,
        session.bufferSummary,
        session.messages.slice(-6)
      );
      replyText = chatRes.replyText;
    } catch (err: any) {
      replyText = `I ran into an issue connecting to Gemini: ${err.message}. However, I am still actively watching your system state. Overdue debts: ${state.finance.overdueLends.length}, Pending streaks: ${state.streaks.pendingTodayCount}.`;
    }
  } else {
    // High-signal rule-based conversational responses when API key is pending
    const lower = userMessage.toLowerCase();
    if (lower.includes('debt') || lower.includes('money') || lower.includes('lend') || lower.includes('ram')) {
      const count = state.finance.overdueLends.length;
      if (count > 0) {
        const top = state.finance.overdueLends[0];
        replyText = `You currently have ${count} overdue debt(s). Specifically, ${top.personName} owes you Rs. ${top.amount.toLocaleString()}, which was due on ${top.expectedReturnDate} (${top.daysOverdue} days ago). Would you like to send a reminder?`;
      } else {
        replyText = `All your active lends (Rs. ${state.finance.totalActiveLent.toLocaleString()} total) are currently within their agreed return deadlines.`;
      }
    } else if (lower.includes('streak') || lower.includes('habit')) {
      replyText = `You have ${state.streaks.totalStreaks} tracked streaks. ${state.streaks.completedTodayCount} are completed today, and ${state.streaks.pendingTodayCount} are still pending. ${state.streaks.inDangerCount > 0 ? `⚠️ ${state.streaks.inDangerCount} streak(s) are in danger of breaking tonight!` : 'No streaks are in immediate danger.'}`;
    } else if (lower.includes('age') || lower.includes('life') || lower.includes('odyssey') || lower.includes('countdown')) {
      replyText = `You are Level ${state.user.currentAge}. You have lived ${state.user.weeksLivedPct}% of your estimated lifespan, with ${state.user.weeksRemaining.toLocaleString()} weeks ahead. Your next milestone is "${state.lifeOdyssey.upcomingMilestones[0]?.title || 'Upcoming Quest'}" in ${state.lifeOdyssey.upcomingMilestones[0]?.daysRemaining || 0} days.`;
    } else {
      replyText = `Greetings, Commander. I am The Sentinel, guarding your Shudkara ecosystem. Your system status: ${state.finance.overdueLends.length > 0 ? '⚠️ Overdue debts detected.' : '✅ Debts clear.'} Streaks: ${state.streaks.completedTodayCount}/${state.streaks.totalStreaks} done today. Add your Gemini API key in Caretaker Settings to unlock deep natural reasoning!`;
    }
  }

  await appendMessageToSession(db, sessionId, {
    sender: 'caretaker',
    content: replyText,
    timestamp: new Date().toISOString()
  });

  await compactSessionBufferIfNeeded(db, sessionId);

  const updatedCore = await getCoreMemory(db);
  return { replyText, coreMemory: updatedCore };
}
