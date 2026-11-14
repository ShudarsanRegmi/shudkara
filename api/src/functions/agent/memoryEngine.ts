import { Db } from 'mongodb';
import * as crypto from 'crypto';

export interface CoreMemory {
  id: string;
  human: string;
  persona: string;
  updatedAt: string;
}

export interface ArchivalMemoryItem {
  id: string;
  content: string;
  tags: string[];
  timestamp: string;
}

export interface ChatMessage {
  sender: 'user' | 'caretaker';
  content: string;
  timestamp: string;
}

export interface CaretakerSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  bufferSummary?: string;
  messages: ChatMessage[];
}

const DEFAULT_HUMAN_CORE = `
- Identity: Shudkara Commander (Aparichit)
- Core Life Goal: Building resilient software, financial independence, physical vigor, reaching Master level before Age 30.
- Communication Style: Prefers direct, stoic, high-signal, tough-love feedback. Hates corporate fluff or sycophancy.
- Values: Radical honesty, Memento Mori consciousness, protecting time and physical energy.
- Key People:
  * Ram (close friend, frequent lender/borrower)
  * Shyam (collaborator)
`.trim();

const DEFAULT_PERSONA_CORE = `
- Name: The Sentinel (Caretaker of Shudkara)
- Role: Autonomous watchman, advisor, accountability partner.
- Philosophy: "Memento Mori • Carpe Diem • No Zero Days"
- Directives:
  * Audit commitments and debts rigorously.
  * Hold the user to their stated standards (streaks, deadlines, budget).
  * Always provide concrete, actionable next steps.
`.trim();

// Rough token estimation (~4 characters per token in English)
export function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

// ── 1. Core Memory (Virtual RAM) ───────────────────────────────────────────
export async function getCoreMemory(db: Db): Promise<CoreMemory> {
  const col = db.collection('agent_core_memory');
  let doc: any = await col.findOne({ id: 'main_core_memory' });

  if (!doc) {
    const initial: CoreMemory = {
      id: 'main_core_memory',
      human: DEFAULT_HUMAN_CORE,
      persona: DEFAULT_PERSONA_CORE,
      updatedAt: new Date().toISOString()
    };
    await col.insertOne(initial as any);
    return initial;
  }

  const { _id, ...clean } = doc;
  return clean as CoreMemory;
}

export async function updateCoreMemory(
  db: Db,
  human?: string,
  persona?: string
): Promise<CoreMemory> {
  const col = db.collection('agent_core_memory');
  const updateData: any = { updatedAt: new Date().toISOString() };
  if (human !== undefined) updateData.human = human.trim();
  if (persona !== undefined) updateData.persona = persona.trim();

  await col.updateOne({ id: 'main_core_memory' }, { $set: updateData }, { upsert: true });
  return getCoreMemory(db);
}

export async function coreMemoryAppend(
  db: Db,
  section: 'human' | 'persona',
  content: string
): Promise<{ success: boolean; updated: string }> {
  const mem = await getCoreMemory(db);
  const current = mem[section] || '';
  const addition = content.trim();

  if (!addition) return { success: false, updated: current };

  const updated = `${current}\n- ${addition}`.trim();
  if (section === 'human') {
    await updateCoreMemory(db, updated, undefined);
  } else {
    await updateCoreMemory(db, undefined, updated);
  }

  return { success: true, updated };
}

export async function coreMemoryReplace(
  db: Db,
  section: 'human' | 'persona',
  oldText: string,
  newText: string
): Promise<{ success: boolean; updated: string }> {
  const mem = await getCoreMemory(db);
  const current = mem[section] || '';

  if (!current.includes(oldText)) {
    return { success: false, updated: current };
  }

  const updated = current.replace(oldText, newText.trim());
  if (section === 'human') {
    await updateCoreMemory(db, updated, undefined);
  } else {
    await updateCoreMemory(db, undefined, updated);
  }

  return { success: true, updated };
}

// ── 2. Archival Storage (Virtual Disk) ─────────────────────────────────────
export async function archivalMemoryInsert(
  db: Db,
  content: string,
  tags: string[] = []
): Promise<ArchivalMemoryItem> {
  const col = db.collection('agent_archival');
  const item: ArchivalMemoryItem = {
    id: `arch-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    content: content.trim(),
    tags: tags.map(t => t.toLowerCase().trim()),
    timestamp: new Date().toISOString()
  };

  await col.insertOne(item as any);
  return item;
}

export async function archivalMemorySearch(
  db: Db,
  query: string,
  limit: number = 5
): Promise<ArchivalMemoryItem[]> {
  const col = db.collection('agent_archival');
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  // Match by regex against content or tags
  const regex = new RegExp(cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const items = await col
    .find({ $or: [{ content: regex }, { tags: regex }] })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();

  return items.map(({ _id, ...rest }: any) => rest as ArchivalMemoryItem);
}

// ── 3. Sessions & Token-Budget Dynamic Window ──────────────────────────────
export async function getOrCreateActiveSession(db: Db, sessionId: string = 'main_session'): Promise<CaretakerSession> {
  const col = db.collection('caretaker_sessions');
  let session: any = await col.findOne({ id: sessionId });

  if (!session) {
    const newSession: CaretakerSession = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      bufferSummary: '',
      messages: []
    };
    await col.insertOne(newSession as any);
    return newSession;
  }

  const { _id, ...clean } = session;
  return clean as CaretakerSession;
}

export async function appendMessageToSession(
  db: Db,
  sessionId: string,
  msg: ChatMessage
): Promise<CaretakerSession> {
  const col = db.collection('caretaker_sessions');
  const now = new Date().toISOString();

  await col.updateOne(
    { id: sessionId },
    {
      $push: { messages: msg } as any,
      $set: { updatedAt: now }
    },
    { upsert: true }
  );

  return getOrCreateActiveSession(db, sessionId);
}

// Compact messages when tokens exceed budget (Memory Paging)
export async function compactSessionBufferIfNeeded(
  db: Db,
  sessionId: string,
  maxTokenBudget: number = 3000
): Promise<CaretakerSession> {
  const session = await getOrCreateActiveSession(db, sessionId);
  const messages = session.messages || [];

  let totalTokens = estimateTokens(session.bufferSummary || '');
  for (const m of messages) {
    totalTokens += estimateTokens(m.content);
  }

  if (totalTokens <= maxTokenBudget || messages.length <= 6) {
    return session;
  }

  // Take oldest 4 messages to roll into buffer summary
  const toCompact = messages.slice(0, 4);
  const keep = messages.slice(4);

  const compactedText = toCompact
    .map(m => `[${m.sender.toUpperCase()}]: ${m.content}`)
    .join('\n');

  const prevSummary = session.bufferSummary ? `${session.bufferSummary}\n` : '';
  const newSummary = `${prevSummary}Earlier exchange summary: ${compactedText.slice(0, 400)}...`.slice(-1500);

  const col = db.collection('caretaker_sessions');
  await col.updateOne(
    { id: sessionId },
    {
      $set: {
        bufferSummary: newSummary,
        messages: keep,
        updatedAt: new Date().toISOString()
      }
    }
  );

  return getOrCreateActiveSession(db, sessionId);
}
