import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo, verifySession, extractToken } from './db';

interface LinkNode {
  id: string;
  parentId: string | null;
  name: string;
  type: 'folder' | 'link';
  url?: string;
  isPrivate?: boolean;
  createdAt: Date;
}

export async function linksHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const nodeId = request.params.id;

  try {
    const db = await connectToMongo();
    const col = db.collection('links');

    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // 1. GET - Fetch all nodes (filter private nodes for unauthenticated visitors)
    if (method === 'GET') {
      const nodes = await col.find({}).toArray();
      
      // If not logged in, filter out nodes where isPrivate === true
      const filtered = isAuthorized 
        ? nodes 
        : nodes.filter(n => !n.isPrivate);

      const cleaned = filtered.map(n => {
        const { _id, ...rest } = n;
        return rest;
      });
      
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: cleaned
      };
    }

    // Auth validation for all write/delete operations
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized. Login required to manage links.' } };
    }

    // 2. POST - Create new node
    if (method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { name, type, parentId, url, isPrivate } = body;
      if (!name || typeof name !== 'string') {
        return { status: 400, jsonBody: { error: 'Name is required.' } };
      }
      if (type !== 'folder' && type !== 'link') {
        return { status: 400, jsonBody: { error: 'Type must be folder or link.' } };
      }

      const newNode: LinkNode = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        parentId: parentId || null,
        name: name.trim(),
        type,
        url: type === 'link' ? (url || '').trim() : undefined,
        isPrivate: !!isPrivate,
        createdAt: new Date()
      };

      await col.insertOne(newNode);

      return {
        status: 201,
        jsonBody: { success: true, node: newNode }
      };
    }

    // 3. PUT - Update node
    if (method === 'PUT') {
      if (!nodeId) {
        return { status: 400, jsonBody: { error: 'Node ID is required.' } };
      }

      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { name, parentId, url, isPrivate } = body;
      const updates: any = {};
      
      if (name !== undefined) updates.name = name.trim();
      if (parentId !== undefined) updates.parentId = parentId || null;
      if (url !== undefined) updates.url = url.trim();
      if (isPrivate !== undefined) updates.isPrivate = !!isPrivate;

      const result = await col.updateOne(
        { id: nodeId },
        { $set: updates }
      );

      if (result.matchedCount === 0) {
        return { status: 404, jsonBody: { error: 'Node not found.' } };
      }

      return {
        status: 200,
        jsonBody: { success: true, message: 'Node updated successfully.' }
      };
    }

    // 4. DELETE - Delete node and descendants
    if (method === 'DELETE') {
      if (!nodeId) {
        return { status: 400, jsonBody: { error: 'Node ID is required.' } };
      }

      const allNodes = await col.find({}).toArray();
      const idsToDelete = new Set<string>([nodeId]);

      const queue = [nodeId];
      while (queue.length > 0) {
        const currentId = queue.shift();
        const children = allNodes.filter(n => n.parentId === currentId);
        children.forEach(c => {
          if (!idsToDelete.has(c.id)) {
            idsToDelete.add(c.id);
            queue.push(c.id);
          }
        });
      }

      await col.deleteMany({ id: { $in: Array.from(idsToDelete) } });

      return {
        status: 200,
        jsonBody: { success: true, message: `Deleted node and ${idsToDelete.size - 1} child nodes.` }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Links handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('links', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'links/{id?}',
  handler: linksHandler
});
