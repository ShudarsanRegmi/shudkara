import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo } from './db';

export interface NoteCategory {
  id: string;
  name: string;
  description?: string;
  color?: string; // 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan'
  icon?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;
  color?: string; // 'default' | 'sky' | 'emerald' | 'amber' | 'rose' | 'purple'
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_CATEGORIES: NoteCategory[] = [
  {
    id: 'general',
    name: 'General',
    description: 'Default category for general notes and quick memos',
    color: 'slate',
    icon: 'Folder',
    isDefault: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'work',
    name: 'Work & Projects',
    description: 'Tasks, architecture, and project documentations',
    color: 'blue',
    icon: 'Briefcase',
    isDefault: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'ideas',
    name: 'Ideas & Brainstorm',
    description: 'Creative inspirations, feature ideas and sketches',
    color: 'purple',
    icon: 'Sparkles',
    isDefault: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'personal',
    name: 'Personal & Journal',
    description: 'Personal reflections, logs and reading notes',
    color: 'emerald',
    icon: 'Heart',
    isDefault: false,
    createdAt: new Date().toISOString()
  }
];

export async function notesHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Expected paths:
  // /api/notes
  // /api/notes/{id}
  // /api/notes/categories
  // /api/notes/categories/{id}

  const isApi = pathParts[0] === 'api';
  const baseIndex = isApi ? 1 : 0;
  const subPath1 = pathParts[baseIndex + 1]; // noteId OR 'categories'
  const subPath2 = pathParts[baseIndex + 2]; // categoryId if subPath1 === 'categories'

  try {
    const db = await connectToMongo();
    const notesCol = db.collection('notes');
    const categoriesCol = db.collection('noteCategories');

    // ── 1. Seed default categories if none exist ─────────────────────────────
    const catCount = await categoriesCol.countDocuments({});
    if (catCount === 0) {
      await categoriesCol.insertMany(DEFAULT_CATEGORIES);
    }

    // ── 2. Categories CRUD ───────────────────────────────────────────────────
    if (subPath1 === 'categories') {
      // POST /api/notes/categories (Create or Update Category)
      if (method === 'POST') {
        let body: any;
        try { body = await request.json(); } catch {
          return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
        }

        const catData = body.category || body;
        const name = (catData.name || '').trim();
        if (!name) {
          return { status: 400, jsonBody: { error: 'Category name is required.' } };
        }

        const id = catData.id
          ? catData.id.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
          : name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || crypto.randomBytes(4).toString('hex');

        const now = new Date().toISOString();
        const existing = await categoriesCol.findOne({ id });

        const category: NoteCategory = {
          id,
          name,
          description: catData.description ? String(catData.description).trim() : undefined,
          color: catData.color || 'slate',
          icon: catData.icon || 'Folder',
          isDefault: existing ? !!existing.isDefault : id === 'general',
          createdAt: existing?.createdAt || now,
          updatedAt: now
        };

        await categoriesCol.updateOne(
          { id },
          { $set: category },
          { upsert: true }
        );

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: true, category }
        };
      }

      // DELETE /api/notes/categories/{id}
      if (method === 'DELETE' && subPath2) {
        const catId = subPath2;
        if (catId === 'general') {
          return { status: 400, jsonBody: { error: 'Cannot delete the default General category.' } };
        }

        const cat = await categoriesCol.findOne({ id: catId });
        if (cat?.isDefault) {
          return { status: 400, jsonBody: { error: 'Cannot delete a default category.' } };
        }

        // Reassign any notes currently under this category to 'general'
        await notesCol.updateMany(
          { categoryId: catId },
          { $set: { categoryId: 'general', updatedAt: new Date().toISOString() } }
        );

        await categoriesCol.deleteOne({ id: catId });

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: true, id: catId }
        };
      }
    }

    // ── 3. GET /api/notes - List notes and categories ─────────────────────────
    if (method === 'GET' && !subPath1) {
      const [notes, categories] = await Promise.all([
        notesCol.find({}).sort({ isPinned: -1, updatedAt: -1 }).toArray(),
        categoriesCol.find({}).sort({ isDefault: -1, name: 1 }).toArray()
      ]);

      const cleanedNotes = notes.map(n => {
        const { _id, ...rest } = n;
        return rest;
      });

      const cleanedCategories = categories.map(c => {
        const { _id, ...rest } = c;
        return rest;
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          notes: cleanedNotes,
          categories: cleanedCategories.length > 0 ? cleanedCategories : DEFAULT_CATEGORIES
        }
      };
    }

    // ── 4. POST /api/notes - Create or Update Note ────────────────────────────
    if (method === 'POST' && !subPath1) {
      let body: any;
      try { body = await request.json(); } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const noteData = body.note || body;
      const content = typeof noteData.content === 'string' ? noteData.content : '';
      let title = typeof noteData.title === 'string' ? noteData.title.trim() : '';

      // Auto-extract title from first non-empty line of content if title is empty
      if (!title && content) {
        const firstLine = content.split('\n').map((l: string) => l.replace(/^[#*\-_\s>]+/, '').trim()).find(Boolean);
        title = firstLine ? firstLine.slice(0, 80) : 'Untitled Note';
      } else if (!title) {
        title = 'Untitled Note';
      }

      const id = noteData.id || `note_${crypto.randomBytes(6).toString('hex')}`;
      const existing = await notesCol.findOne({ id });
      const now = new Date().toISOString();

      let categoryId = noteData.categoryId || 'general';
      // Verify category exists
      const catExists = await categoriesCol.findOne({ id: categoryId });
      if (!catExists) {
        categoryId = 'general';
      }

      let tags: string[] = [];
      if (Array.isArray(noteData.tags)) {
        tags = noteData.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean);
      }

      const noteItem: NoteItem = {
        id,
        title,
        content,
        categoryId,
        tags: Array.from(new Set(tags)),
        isPinned: !!noteData.isPinned,
        isFavorite: !!noteData.isFavorite,
        color: noteData.color || 'default',
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      await notesCol.updateOne(
        { id },
        { $set: noteItem },
        { upsert: true }
      );

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, note: noteItem }
      };
    }

    // ── 5. DELETE /api/notes/{id} - Delete Note ───────────────────────────────
    if (method === 'DELETE' && subPath1 && subPath1 !== 'categories') {
      const noteId = subPath1;
      const res = await notesCol.deleteOne({ id: noteId });
      if (res.deletedCount === 0) {
        return { status: 404, jsonBody: { error: 'Note not found.' } };
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, id: noteId }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Notes handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('notes', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'notes/{*subpath}',
  handler: notesHandler
});
