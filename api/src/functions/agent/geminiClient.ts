import { Db } from 'mongodb';
import { SystemStateSnapshot } from './harvester';
import { CoreMemory } from './memoryEngine';

export interface CaretakerAnalysisResult {
  status: 'all_clear' | 'attention_required' | 'critical_alert';
  headline: string;
  digestMarkdown: string;
  actionItems: Array<{
    id: string;
    subapp: 'finance' | 'streaks' | 'lifeodyssey' | 'todos' | 'general';
    label: string;
    urgency: 'low' | 'medium' | 'high';
  }>;
  sendEmail: boolean;
  emailSubject?: string;
  memoryModifications?: Array<{
    type: 'core_append' | 'archival_insert';
    content: string;
  }>;
}

export async function getGeminiApiKey(db: Db): Promise<string> {
  const envKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (envKey && envKey.trim()) return envKey.trim();

  // Try reading from MongoDB user settings
  try {
    const settingsCol = db.collection('agent_settings');
    const doc = await settingsCol.findOne({ key: 'gemini_api_key' });
    if (doc && doc.value) return String(doc.value).trim();
  } catch (e) {}

  return '';
}

export async function saveGeminiApiKey(db: Db, apiKey: string): Promise<void> {
  const settingsCol = db.collection('agent_settings');
  await settingsCol.updateOne(
    { key: 'gemini_api_key' },
    { $set: { key: 'gemini_api_key', value: apiKey.trim(), updatedAt: new Date().toISOString() } },
    { upsert: true }
  );
}

// ── Fallback Heuristic Rule-Based Synthesizer ──────────────────────────────
// Runs whenever an API key is not yet set, ensuring zero downtime/crashes!
export function synthesizeHeuristicBriefing(state: SystemStateSnapshot, coreMemory: CoreMemory): CaretakerAnalysisResult {
  const actionItems: CaretakerAnalysisResult['actionItems'] = [];
  let status: CaretakerAnalysisResult['status'] = 'all_clear';
  let sendEmail = false;
  let emailSubject = 'Shudkara Daily Sentinel Briefing';

  const sections: string[] = [];

  // Memento Mori Header
  sections.push(`### ⏳ Mortal Perspective (Age ${state.user.currentAge})
- **Weeks Lived:** ${state.user.weeksLivedPct}% (${state.user.weeksRemaining.toLocaleString()} weeks of unwritten potential remaining).
- **Next Level Up:** ${state.user.daysToNextBirthday} days until your next birthday milestone.`);

  // 1. Finance Audit
  const overdueLends = state.finance.overdueLends || [];
  const overdueBorrows = state.finance.overdueBorrows || [];

  if (overdueLends.length > 0) {
    status = 'critical_alert';
    sendEmail = true;
    emailSubject = `🚨 URGENT: ${overdueLends.length} Overdue Debt Return(s) in Finance`;
    sections.push(`\n### 💰 Critical Financial Notice
The following lend commitments have breached their promised return dates:`);

    for (const l of overdueLends) {
      sections.push(`- **${l.personName}**: Rs. ${l.amount.toLocaleString()} (Overdue by **${l.daysOverdue} days** since ${l.expectedReturnDate})`);
      actionItems.push({
        id: `act-lend-${l.id}`,
        subapp: 'finance',
        label: `Send debt return reminder to ${l.personName} (Rs. ${l.amount.toLocaleString()})`,
        urgency: 'high'
      });
    }
  }

  if (overdueBorrows.length > 0) {
    if (status !== 'critical_alert') status = 'attention_required';
    sections.push(`\n### ⚠️ Pending Repayments You Owe
Honor your commitments promptly:`);
    for (const b of overdueBorrows) {
      sections.push(`- **${b.personName}**: Rs. ${b.amount.toLocaleString()} was expected on ${b.expectedReturnDate}`);
      actionItems.push({
        id: `act-borrow-${b.id}`,
        subapp: 'finance',
        label: `Repay borrowed Rs. ${b.amount.toLocaleString()} to ${b.personName}`,
        urgency: 'high'
      });
    }
  }

  // 2. Streaks Audit
  const dangerStreaks = state.streaks.items.filter(s => s.isInDanger);
  const pendingStreaks = state.streaks.items.filter(s => !s.checkedInToday);

  if (dangerStreaks.length > 0) {
    if (status !== 'critical_alert') status = 'critical_alert';
    sendEmail = true;
    sections.push(`\n### 🔥 Streak Danger Alert
The sun is setting, and you have **${dangerStreaks.length} unbroken streak(s)** in danger:`);
    for (const s of dangerStreaks) {
      sections.push(`- **${s.title}**: Current Streak: **${s.currentStreak} days**. Needs proof before midnight!`);
      actionItems.push({
        id: `act-streak-${s.id}`,
        subapp: 'streaks',
        label: `Log photo proof for "${s.title}"`,
        urgency: 'high'
      });
    }
  } else if (pendingStreaks.length > 0) {
    if (status === 'all_clear') status = 'attention_required';
    sections.push(`\n### ⚡ Active Streaks Pending
- ${pendingStreaks.length} of ${state.streaks.totalStreaks} daily streak check-ins remain open for today.`);
    for (const s of pendingStreaks.slice(0, 3)) {
      actionItems.push({
        id: `act-streak-${s.id}`,
        subapp: 'streaks',
        label: `Complete streak: ${s.title}`,
        urgency: 'medium'
      });
    }
  }

  // 3. Life Odyssey Milestones
  if (state.lifeOdyssey.upcomingMilestones.length > 0) {
    const nextMilestone = state.lifeOdyssey.upcomingMilestones[0];
    sections.push(`\n### 🎯 Next Life Horizon
- **Target Quest:** "${nextMilestone.title}" (Age ${nextMilestone.targetAge})
- **Countdown:** **${nextMilestone.daysRemaining} days** remaining.`);
  }

  // Conclude
  let headline = 'All systems monitored and within nominal boundaries.';
  if (status === 'critical_alert') {
    headline = 'Urgent commitments require immediate attention.';
  } else if (status === 'attention_required') {
    headline = 'Daily actions pending completion before nightfall.';
  }

  sections.push(`\n*Generated by The Sentinel (Core Memory synchronized).*`);

  return {
    status,
    headline,
    digestMarkdown: sections.join('\n'),
    actionItems,
    sendEmail,
    emailSubject
  };
}

// ── Gemini 2.5 Flash API Caller ─────────────────────────────────────────────
export async function callGeminiAnalysis(
  apiKey: string,
  state: SystemStateSnapshot,
  coreMemory: CoreMemory
): Promise<CaretakerAnalysisResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemInstruction = `
You are "The Sentinel", the stoic, hyper-vigilant personal caretaker of Shudkara for ${state.user.heroName}.
You adhere to the MemGPT virtual memory architecture.

CORE DIRECTIVES:
1. MEMENTO MORI: You are acutely conscious of finite mortal time (weeks lived, birthdays, age milestones).
2. RADICAL HONESTY & TOUGH LOVE: Do not flatter. Audit financial commitments, overdue money given/taken, and daily photo habits with razor-sharp precision.
3. CONCRETE ACTIONS: Always provide 1 to 4 high-leverage micro-actions the user should take right now.
4. Output strictly valid JSON conforming to the requested schema.

CURRENT CORE MEMORY (Virtual RAM):
HUMAN PROFILE:
${coreMemory.human}

SENTINEL PERSONA:
${coreMemory.persona}
`.trim();

  const prompt = `
Analyze the current live state of Shudkara:
${JSON.stringify(state, null, 2)}

Provide your executive assessment.
Return a JSON object with:
- "status": "all_clear" | "attention_required" | "critical_alert"
- "headline": Short 1-sentence executive summary
- "digestMarkdown": Inspiring, stoic, structured markdown briefing (use bolding, clean bullets)
- "actionItems": Array of { "id": string, "subapp": "finance"|"streaks"|"lifeodyssey"|"todos"|"general", "label": string, "urgency": "low"|"medium"|"high" }
- "sendEmail": boolean (true if critical debt expiry or broken streak risk)
- "emailSubject": string (required if sendEmail is true)
`.trim();

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned empty candidate response.');
  }

  return JSON.parse(text) as CaretakerAnalysisResult;
}

// ── Gemini Conversational Chat with MemGPT Tools ───────────────────────────
export async function callGeminiChat(
  apiKey: string,
  userMessage: string,
  state: SystemStateSnapshot,
  coreMemory: CoreMemory,
  bufferSummary?: string,
  recentMessages: Array<{ sender: 'user' | 'caretaker'; content: string }> = []
): Promise<{ replyText: string; memoryCommands?: Array<{ action: string; args: any }> }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemInstruction = `
You are "The Sentinel", the autonomous caretaker and companion of the Shudkara operating ecosystem.
You have access to the user's live system state across Finance, Streaks, Life Odyssey, Todos, Timers, Notes, and Concurrency.

MEMGPT VIRTUAL MEMORY (RAM):
[HUMAN PROFILE]
${coreMemory.human}

[PERSONA DIRECTIVES]
${coreMemory.persona}

[CURRENT SYSTEM PULSE]
- User Age: ${state.user.currentAge} (Weeks Lived: ${state.user.weeksLivedPct}%, ${state.user.weeksRemaining} wks left)
- Active Lent: Rs. ${state.finance.totalActiveLent.toLocaleString()} (Overdue: ${state.finance.overdueLends.length})
- Active Borrowed: Rs. ${state.finance.totalActiveBorrowed.toLocaleString()} (Overdue: ${state.finance.overdueBorrows.length})
- Streaks: ${state.streaks.completedTodayCount}/${state.streaks.totalStreaks} checked in today (In danger: ${state.streaks.inDangerCount})
- Workstreams Active: ${state.workstreams.activeCount}

${bufferSummary ? `[PREVIOUS DIALOGUE BUFFER SUMMARY]\n${bufferSummary}\n` : ''}

Be direct, insightful, proactive, and compassionate yet firm.
If the user shares an enduring preference, habit, or life commitment, acknowledge it and update your core memory.
`.trim();

  const formattedContents = recentMessages.map(m => ({
    role: m.sender === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  // Append new user message
  formattedContents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const requestBody = {
    contents: formattedContents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.6
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I have audited your request.';

  return { replyText };
}
