import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo } from './db';

export interface LifeProfile {
  id: string;
  dob: string; // ISO date e.g. "2000-01-01"
  maxAge: number; // e.g. 85
  heroName: string;
  heroTitle: string;
  heroClass: string;
  motto: string;
  updatedAt: string;
}

export type MilestoneCategory =
  | 'career'
  | 'wealth'
  | 'health'
  | 'skills'
  | 'travel'
  | 'relationships'
  | 'creative'
  | 'spirit';

export type RpgAttribute =
  | 'vitality'
  | 'intellect'
  | 'wealth'
  | 'agility'
  | 'charisma';

export interface LifeMilestone {
  id: string;
  title: string;
  description?: string;
  category: MilestoneCategory;
  targetAge: number | null; // null if in Backlog
  targetDate?: string | null;
  status: 'backlog' | 'planned' | 'in_progress' | 'achieved';
  xp: number;
  attribute: RpgAttribute;
  isEpicBoss?: boolean;
  achievedAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_PROFILE: LifeProfile = {
  id: 'main',
  dob: '2001-01-01',
  maxAge: 85,
  heroName: 'Chronomancer',
  heroTitle: 'Architect of Destiny',
  heroClass: 'Visionary',
  motto: 'Memento Mori • Carpe Diem • Level Up Every Year',
  updatedAt: new Date().toISOString()
};

const DEFAULT_MILESTONES: LifeMilestone[] = [
  {
    id: 'm-genesis',
    title: 'The Great Awakening (Birth into World)',
    description: 'Began the legendary journey of life on Earth.',
    category: 'spirit',
    targetAge: 0,
    targetDate: null,
    status: 'achieved',
    xp: 100,
    attribute: 'vitality',
    isEpicBoss: true,
    achievedAt: '2001-01-01T00:00:00.000Z',
    notes: 'Level 0 unlocked.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm-quarter-century',
    title: 'Decadal Boss: Conquer Age 25',
    description: 'Reach financial independence baseline, ship flagship projects, peak physical shape.',
    category: 'career',
    targetAge: 25,
    targetDate: null,
    status: 'in_progress',
    xp: 500,
    attribute: 'intellect',
    isEpicBoss: true,
    achievedAt: null,
    notes: 'Epic decadal trial of youth and mastery.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm-first-100k',
    title: 'Net Worth Milestone: $100K Liquid Vault',
    description: 'Build compounding investment portfolio and multi-channel asset streams.',
    category: 'wealth',
    targetAge: 27,
    targetDate: null,
    status: 'planned',
    xp: 350,
    attribute: 'wealth',
    isEpicBoss: false,
    achievedAt: null,
    notes: 'Asset allocation & financial resilience.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm-ironman',
    title: 'Run a Full 42.195km Marathon / Triathlon',
    description: 'Push physical vitality and lung endurance to elite athletic status.',
    category: 'health',
    targetAge: 28,
    targetDate: null,
    status: 'planned',
    xp: 400,
    attribute: 'vitality',
    isEpicBoss: true,
    achievedAt: null,
    notes: 'Zone 2 cardio mastery.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm-japan-odyssey',
    title: 'Wanderlust: Month-long Solo Expedition to Japan & Alps',
    description: 'Experience ancient cultures, mountaintop sunrises, and deep introspective wandering.',
    category: 'travel',
    targetAge: null, // In Backlog
    targetDate: null,
    status: 'backlog',
    xp: 250,
    attribute: 'agility',
    isEpicBoss: false,
    achievedAt: null,
    notes: 'Currently in backlog quests awaiting assigned target age.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export async function lifeOdysseyHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const method = request.method;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Paths:
  // /api/life-odyssey
  // /api/life-odyssey/profile
  // /api/life-odyssey/milestones
  // /api/life-odyssey/milestones/{id}
  // /api/life-odyssey/sync

  const isApi = pathParts[0] === 'api';
  const baseIndex = isApi ? 1 : 0;
  const sub1 = pathParts[baseIndex + 1]; // 'profile' | 'milestones' | 'sync'
  const sub2 = pathParts[baseIndex + 2]; // milestoneId

  try {
    const db = await connectToMongo();
    const profileCol = db.collection('life_odyssey_profiles');
    const milestoneCol = db.collection('life_odyssey_milestones');

    // ── 1. GET Root or Profile or Milestones ─────────────────────────────────
    if (method === 'GET') {
      let profile: any = await profileCol.findOne({ id: 'main' });
      if (!profile) {
        await profileCol.insertOne(DEFAULT_PROFILE as any);
        profile = DEFAULT_PROFILE;
      }

      let milestones = await milestoneCol.find({}).sort({ targetAge: 1, createdAt: 1 }).toArray();
      if (milestones.length === 0) {
        await milestoneCol.insertMany(DEFAULT_MILESTONES);
        milestones = DEFAULT_MILESTONES as any;
      }

      const cleanProfile = (({ _id, ...rest }: any) => rest)(profile);
      const cleanMilestones = milestones.map(({ _id, ...rest }: any) => rest);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          profile: cleanProfile,
          milestones: cleanMilestones
        }
      };
    }

    // ── 2. POST /api/life-odyssey/profile - Update Profile ────────────────────
    if (method === 'POST' && sub1 === 'profile') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const updateData: Partial<LifeProfile> = {
        updatedAt: new Date().toISOString()
      };

      if (body.dob) updateData.dob = String(body.dob).trim();
      if (body.maxAge !== undefined) updateData.maxAge = Math.max(30, Math.min(130, Number(body.maxAge) || 85));
      if (body.heroName !== undefined) updateData.heroName = String(body.heroName).trim();
      if (body.heroTitle !== undefined) updateData.heroTitle = String(body.heroTitle).trim();
      if (body.heroClass !== undefined) updateData.heroClass = String(body.heroClass).trim();
      if (body.motto !== undefined) updateData.motto = String(body.motto).trim();

      await profileCol.updateOne(
        { id: 'main' },
        { $set: updateData },
        { upsert: true }
      );

      const updated = await profileCol.findOne({ id: 'main' });
      const clean = (({ _id, ...rest }: any) => rest)(updated);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, profile: clean }
      };
    }

    // ── 3. POST /api/life-odyssey/milestones - Create Milestone ───────────────
    if (method === 'POST' && sub1 === 'milestones') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const title = (body.title || '').trim();
      if (!title) {
        return { status: 400, jsonBody: { error: 'Milestone title is required.' } };
      }

      const id = body.id || `m-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const now = new Date().toISOString();

      let targetAge: number | null = null;
      if (body.targetAge !== null && body.targetAge !== undefined && body.targetAge !== '') {
        const num = parseFloat(body.targetAge);
        if (!isNaN(num) && num >= 0 && num <= 130) {
          targetAge = num;
        }
      }

      let status = body.status;
      if (!status) {
        status = targetAge === null ? 'backlog' : 'planned';
      }

      const newMilestone: LifeMilestone = {
        id,
        title,
        description: (body.description || '').trim(),
        category: body.category || 'career',
        targetAge,
        targetDate: body.targetDate || null,
        status,
        xp: Number(body.xp) || 100,
        attribute: body.attribute || 'intellect',
        isEpicBoss: Boolean(body.isEpicBoss),
        achievedAt: status === 'achieved' ? (body.achievedAt || now) : null,
        notes: (body.notes || '').trim(),
        createdAt: now,
        updatedAt: now
      };

      await milestoneCol.insertOne(newMilestone as any);

      return {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, milestone: newMilestone }
      };
    }

    // ── 4. PUT /api/life-odyssey/milestones/{id} - Update Milestone ───────────
    if (method === 'PUT' && sub1 === 'milestones' && sub2) {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const existing = await milestoneCol.findOne({ id: sub2 });
      if (!existing) {
        return { status: 404, jsonBody: { error: 'Milestone not found.' } };
      }

      const updateFields: any = { updatedAt: new Date().toISOString() };
      if (body.title !== undefined) updateFields.title = String(body.title).trim();
      if (body.description !== undefined) updateFields.description = String(body.description).trim();
      if (body.category !== undefined) updateFields.category = body.category;
      if (body.attribute !== undefined) updateFields.attribute = body.attribute;
      if (body.xp !== undefined) updateFields.xp = Number(body.xp) || 100;
      if (body.isEpicBoss !== undefined) updateFields.isEpicBoss = Boolean(body.isEpicBoss);
      if (body.notes !== undefined) updateFields.notes = String(body.notes).trim();
      if (body.targetDate !== undefined) updateFields.targetDate = body.targetDate || null;

      if (body.targetAge !== undefined) {
        if (body.targetAge === null || body.targetAge === '') {
          updateFields.targetAge = null;
          if (updateFields.status === undefined && existing.status !== 'achieved') {
            updateFields.status = 'backlog';
          }
        } else {
          const num = parseFloat(body.targetAge);
          if (!isNaN(num)) {
            updateFields.targetAge = num;
            if (existing.status === 'backlog' && updateFields.status === undefined) {
              updateFields.status = 'planned';
            }
          }
        }
      }

      if (body.status !== undefined) {
        updateFields.status = body.status;
        if (body.status === 'achieved') {
          updateFields.achievedAt = body.achievedAt || new Date().toISOString();
        } else {
          updateFields.achievedAt = null;
        }
      }

      await milestoneCol.updateOne({ id: sub2 }, { $set: updateFields });
      const updated = await milestoneCol.findOne({ id: sub2 });
      const clean = (({ _id, ...rest }: any) => rest)(updated);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, milestone: clean }
      };
    }

    // ── 5. DELETE /api/life-odyssey/milestones/{id} ───────────────────────────
    if (method === 'DELETE' && sub1 === 'milestones' && sub2) {
      const res = await milestoneCol.deleteOne({ id: sub2 });
      if (res.deletedCount === 0) {
        return { status: 404, jsonBody: { error: 'Milestone not found.' } };
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, id: sub2 }
      };
    }

    // ── 6. POST /api/life-odyssey/sync - Full Synchronize / Restore ─────────
    if (method === 'POST' && sub1 === 'sync') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      if (body.profile) {
        const { _id, ...p } = body.profile;
        p.id = 'main';
        p.updatedAt = new Date().toISOString();
        await profileCol.updateOne({ id: 'main' }, { $set: p }, { upsert: true });
      }

      if (Array.isArray(body.milestones)) {
        await milestoneCol.deleteMany({});
        const cleaned = body.milestones.map(({ _id, ...m }: any) => m);
        if (cleaned.length > 0) {
          await milestoneCol.insertMany(cleaned);
        }
      }

      const finalProfile = await profileCol.findOne({ id: 'main' });
      const finalMilestones = await milestoneCol.find({}).sort({ targetAge: 1, createdAt: 1 }).toArray();

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          success: true,
          profile: (({ _id, ...rest }: any) => rest)(finalProfile),
          milestones: finalMilestones.map(({ _id, ...rest }: any) => rest)
        }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('LifeOdyssey handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('lifeOdyssey', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'life-odyssey/{*subpath}',
  handler: lifeOdysseyHandler
});
