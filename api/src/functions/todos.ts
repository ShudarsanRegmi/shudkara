import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo, verifySession, extractToken } from './db';

export async function todosHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const todoId = request.params.id;

  try {
    const db = await connectToMongo();
    const col = db.collection('todos');
    const settingsCol = db.collection('userSettings');

    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // ── 1. GET - Fetch todos & board privacy ──────────────────────────────────
    if (method === 'GET') {
      let todos = await col.find({}).toArray();

      // Legacy auto-migration check
      if (todos.length === 0) {
        const userDataCol = db.collection('userData');
        const legacyDoc = await userDataCol.findOne({ syncKey: 'global_user' });
        if (legacyDoc && Array.isArray(legacyDoc.todos) && legacyDoc.todos.length > 0) {
          await col.insertMany(legacyDoc.todos);
          if (legacyDoc.todoBoardPrivate !== undefined) {
            await settingsCol.updateOne(
              { key: 'todoBoardPrivate' },
              { $set: { key: 'todoBoardPrivate', value: !!legacyDoc.todoBoardPrivate } },
              { upsert: true }
            );
          }
          todos = legacyDoc.todos;
        }
      }

      // Fetch board privacy setting
      const privacyDoc = await settingsCol.findOne({ key: 'todoBoardPrivate' });
      const isBoardPrivate = privacyDoc ? !!privacyDoc.value : false;

      // Filter private items if unauthenticated visitor
      const visibleTodos = isAuthorized
        ? todos
        : (isBoardPrivate ? [] : todos.filter(t => !t.isPrivate));

      const cleaned = visibleTodos.map(t => {
        const { _id, ...rest } = t;
        return rest;
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { todos: cleaned, isBoardPrivate }
      };
    }

    // ── 2. POST /api/todos/privacy — Toggle Board Privacy ────────────────────
    if (todoId === 'privacy') {
      if (!isAuthorized) return { status: 401, jsonBody: { error: 'Unauthorized.' } };
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const isBoardPrivate = !!body.isBoardPrivate;
      await settingsCol.updateOne(
        { key: 'todoBoardPrivate' },
        { $set: { key: 'todoBoardPrivate', value: isBoardPrivate } },
        { upsert: true }
      );
      return { status: 200, jsonBody: { success: true, isBoardPrivate } };
    }

    // ── Writes & Deletes require Auth ─────────────────────────────────────────
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized. Login required to edit todos.' } };
    }

    // ── 3. POST - Create new todo item ───────────────────────────────────────
    if (method === 'POST') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

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

      await col.updateOne({ id }, { $set: newTodo }, { upsert: true });

      return { status: 201, jsonBody: { success: true, todo: newTodo } };
    }

    // ── 4. PUT - Update existing todo item ───────────────────────────────────
    if (method === 'PUT') {
      if (!todoId) return { status: 400, jsonBody: { error: 'Todo ID is required.' } };
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const updates: Record<string, any> = {};
      if (body.text !== undefined) updates.text = body.text.trim();
      if (body.completed !== undefined) updates.completed = !!body.completed;
      if (body.isPrivate !== undefined) updates.isPrivate = !!body.isPrivate;
      if (body.color !== undefined) updates.color = body.color;
      if (body.x !== undefined) updates.x = body.x;
      if (body.y !== undefined) updates.y = body.y;

      const result = await col.updateOne({ id: todoId }, { $set: updates });
      if (result.matchedCount === 0) {
        return { status: 404, jsonBody: { error: 'Todo item not found.' } };
      }

      return { status: 200, jsonBody: { success: true } };
    }

    // ── 5. DELETE - Remove todo by ID or clear completed ──────────────────────
    if (method === 'DELETE') {
      if (todoId === 'completed') {
        await col.deleteMany({ completed: true });
        return { status: 200, jsonBody: { success: true, message: 'Cleared completed todos.' } };
      }

      if (!todoId) return { status: 400, jsonBody: { error: 'Todo ID required.' } };
      const result = await col.deleteOne({ id: todoId });
      if (result.deletedCount === 0) return { status: 404, jsonBody: { error: 'Todo item not found.' } };

      return { status: 200, jsonBody: { success: true } };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Todos handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('todos', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'todos/{id?}',
  handler: todosHandler
});
