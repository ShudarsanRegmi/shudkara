import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ObjectId } from 'mongodb';
import { connectToMongo, verifySession, extractToken } from './db';
import { 
  getAuthClient, FOLDER_ID, createFolderInDrive, uploadToFolder, ensureFilePublic 
} from './gdrive';
import { google } from 'googleapis';

// Cache for Inventory parent folder ID in Google Drive
let inventoryParentFolderId: string | null = null;

// Ensure "Inventory" folder exists under main GOOGLE_DRIVE_FOLDER_ID
async function getOrCreateInventoryFolderId(): Promise<string> {
  if (inventoryParentFolderId) return inventoryParentFolderId;

  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  // Search if "Inventory" folder already exists
  const query = FOLDER_ID 
    ? `'${FOLDER_ID}' in parents and name = 'Inventory' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `name = 'Inventory' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    pageSize: 1
  });

  if (res.data.files && res.data.files.length > 0) {
    inventoryParentFolderId = res.data.files[0].id!;
    return inventoryParentFolderId;
  }

  // Create "Inventory" subfolder under main GOOGLE_DRIVE_FOLDER_ID
  const folderId = await createFolderInDrive('Inventory');
  inventoryParentFolderId = folderId;
  return inventoryParentFolderId;
}

export async function inventoryHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const path = new URL(request.url).pathname;

  try {
    const db = await connectToMongo();
    const groupsCol = db.collection('inventory_groups');
    const itemsCol = db.collection('inventory_items');

    // ── Authentication Protection Model (Requires Logged-in Session) ──
    const token = extractToken(request);
    const isAuthorized = await verifySession(token);
    if (!isAuthorized) {
      return { 
        status: 401, 
        jsonBody: { error: 'Unauthorized. Inventory is private to logged-in manager.' } 
      };
    }

    const parts = path.split('/').filter(Boolean); // e.g. ['api', 'inventory', 'groups', '123']
    const entityType = parts[2]; // 'groups' or 'items' or 'upload'
    const entityId = parts[3] || null;

    // ── 1. GROUPS ENDPOINTS ──
    if (entityType === 'groups') {
      if (method === 'GET') {
        if (entityId) {
          const group = await groupsCol.findOne({ _id: new ObjectId(entityId) });
          if (!group) return { status: 404, jsonBody: { error: 'Group not found.' } };
          return { status: 200, jsonBody: group };
        }
        const groups = await groupsCol.find({}).sort({ createdAt: -1 }).toArray();
        return { status: 200, jsonBody: groups };
      }

      if (method === 'POST') {
        const body: any = await request.json();
        if (!body.name || !body.name.trim()) {
          return { status: 400, jsonBody: { error: 'Group name is required.' } };
        }

        const newGroup = {
          name: body.name.trim(),
          description: body.description ? body.description.trim() : '',
          color: body.color || 'blue',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const result = await groupsCol.insertOne(newGroup);
        return { status: 201, jsonBody: { ...newGroup, _id: result.insertedId } };
      }

      if (method === 'PUT' && entityId) {
        const body: any = await request.json();
        const updateFields: any = { updatedAt: new Date().toISOString() };
        if (body.name !== undefined) updateFields.name = body.name.trim();
        if (body.description !== undefined) updateFields.description = body.description.trim();
        if (body.color !== undefined) updateFields.color = body.color;

        await groupsCol.updateOne({ _id: new ObjectId(entityId) }, { $set: updateFields });
        const updated = await groupsCol.findOne({ _id: new ObjectId(entityId) });
        return { status: 200, jsonBody: updated };
      }

      if (method === 'DELETE' && entityId) {
        await groupsCol.deleteOne({ _id: new ObjectId(entityId) });
        // Delete items under this group
        await itemsCol.deleteMany({ groupId: entityId });
        return { status: 200, jsonBody: { success: true } };
      }
    }

    // ── 2. ITEMS ENDPOINTS ──
    if (entityType === 'items') {
      if (method === 'GET') {
        const groupIdQuery = request.query.get('groupId');
        const filter: any = {};
        if (groupIdQuery) filter.groupId = groupIdQuery;

        if (entityId) {
          const item = await itemsCol.findOne({ _id: new ObjectId(entityId) });
          if (!item) return { status: 404, jsonBody: { error: 'Item not found.' } };
          return { status: 200, jsonBody: item };
        }

        const items = await itemsCol.find(filter).sort({ createdAt: -1 }).toArray();
        return { status: 200, jsonBody: items };
      }

      if (method === 'POST') {
        const body: any = await request.json();
        if (!body.name || !body.name.trim() || !body.groupId) {
          return { status: 400, jsonBody: { error: 'Item name and groupId are required.' } };
        }

        const newItem = {
          groupId: body.groupId,
          name: body.name.trim(),
          description: body.description ? body.description.trim() : '',
          tags: Array.isArray(body.tags) ? body.tags : [],
          images: Array.isArray(body.images) ? body.images : [], // array of { fileId, viewUrl, thumbnailUrl }
          quantity: typeof body.quantity === 'number' ? body.quantity : 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const result = await itemsCol.insertOne(newItem);
        return { status: 201, jsonBody: { ...newItem, _id: result.insertedId } };
      }

      if (method === 'PUT' && entityId) {
        const body: any = await request.json();
        const updateFields: any = { updatedAt: new Date().toISOString() };
        if (body.name !== undefined) updateFields.name = body.name.trim();
        if (body.description !== undefined) updateFields.description = body.description.trim();
        if (body.groupId !== undefined) updateFields.groupId = body.groupId;
        if (body.tags !== undefined) updateFields.tags = Array.isArray(body.tags) ? body.tags : [];
        if (body.images !== undefined) updateFields.images = Array.isArray(body.images) ? body.images : [];
        if (body.quantity !== undefined) updateFields.quantity = body.quantity;

        await itemsCol.updateOne({ _id: new ObjectId(entityId) }, { $set: updateFields });
        const updated = await itemsCol.findOne({ _id: new ObjectId(entityId) });
        return { status: 200, jsonBody: updated };
      }

      if (method === 'DELETE' && entityId) {
        await itemsCol.deleteOne({ _id: new ObjectId(entityId) });
        return { status: 200, jsonBody: { success: true } };
      }
    }

    // ── 3. GOOGLE DRIVE IMAGE UPLOAD ENDPOINT ──
    // POST /api/inventory/upload -> Uploads image directly to Google Drive "Inventory" subfolder
    if (method === 'POST' && entityType === 'upload') {
      const body: any = await request.json();
      const { fileName, mimeType, base64Data } = body;

      if (!fileName || !base64Data) {
        return { status: 400, jsonBody: { error: 'fileName and base64Data are required.' } };
      }

      context.log(`Attempting inventory image upload for file: ${fileName}`);

      // Get or create "Inventory" subfolder under main GOOGLE_DRIVE_FOLDER_ID
      const inventoryFolderId = await getOrCreateInventoryFolderId();

      context.log(`Target Google Drive Inventory Folder ID: ${inventoryFolderId}`);

      // Upload file directly into Google Drive "Inventory" folder
      const result = await uploadToFolder(
        inventoryFolderId,
        `inv_${Date.now()}_${fileName}`,
        mimeType || 'image/jpeg',
        base64Data
      );

      return {
        status: 200,
        jsonBody: {
          success: true,
          fileId: result.fileId,
          viewUrl: result.viewUrl,
          thumbnailUrl: result.thumbnailUrl
        }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Error in inventoryHandler:', err?.stack || err?.message || err);
    return {
      status: 500,
      jsonBody: { 
        error: 'Internal server error.', 
        details: err?.message || 'Unknown error during operation.',
        stack: err?.stack
      }
    };
  }
}

app.http('inventory', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'inventory/{*rest}',
  handler: inventoryHandler
});
