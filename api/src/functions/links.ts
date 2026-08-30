import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo, verifySession } from './db';

interface LinkNode {
  id: string;
  parentId: string | null;
  name: string;
  type: 'folder' | 'link';
  url?: string;
  createdAt: Date;
}

export async function linksHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const nodeId = request.params.id;

  try {
    const db = await connectToMongo();
    const col = db.collection('links');

    // 1. GET - Fetch all nodes (publicly readable)
    if (method === 'GET') {
      const nodes = await col.find({}).toArray();
      // Remove mongo _id for clean payload
      const cleaned = nodes.map(n => {
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
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const isAuthorized = await verifySession(token);
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

      const { name, type, parentId, url } = body;
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

      const { name, parentId, url } = body;
      const updates: any = {};
      
      if (name !== undefined) updates.name = name.trim();
      if (parentId !== undefined) updates.parentId = parentId || null;
      if (url !== undefined) updates.url = url.trim();

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

      // Fetch all nodes to trace hierarchy
      const allNodes = await col.find({}).toArray();
      const idsToDelete = new Set<string>([nodeId]);

      // Simple queue-based subtree discovery
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

      const deleteResult = await col.deleteMany({ id: { $in: Array.from(idsToDelete) } });

      return {
        status: 200,
        jsonBody: {
          success: true,
          deletedCount: deleteResult.deletedCount,
          message: `${deleteResult.deletedCount} nodes deleted recursively.`
        }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Links handler error:', err);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error.', details: err.message }
    };
  }
}

app.http('links', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'links/{id?}',
  handler: linksHandler
});
