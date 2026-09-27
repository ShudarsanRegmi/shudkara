import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { google } from 'googleapis';
import { connectToMongo, verifySession, extractToken } from './db';
import { 
  getAuthClient, getFolderId, createFolderInDrive, uploadToFolder, trashFileOrFolderInDrive 
} from './gdrive';

const EXPIRY_MAP: Record<string, number> = {
  '10m': 10 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

// Cache for Pastebin parent folder ID in Google Drive
let pastebinParentFolderId: string | null = null;

async function getOrCreatePastebinFolderId(): Promise<string> {
  if (pastebinParentFolderId) return pastebinParentFolderId;

  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const parentFolderId = getFolderId();
  const query = parentFolderId 
    ? `'${parentFolderId}' in parents and name = 'Pastebin' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `name = 'Pastebin' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const res = await drive.files.list({
    q: query,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields: 'files(id, name)',
    pageSize: 1
  });

  if (res.data.files && res.data.files.length > 0) {
    pastebinParentFolderId = res.data.files[0].id!;
    return pastebinParentFolderId;
  }

  const folderId = await createFolderInDrive('Pastebin');
  pastebinParentFolderId = folderId;
  return pastebinParentFolderId;
}

async function uploadBase64ImageToDrive(title: string, content: string): Promise<{ viewUrl: string; fileId: string } | null> {
  if (!content || typeof content !== 'string') return null;

  let mimeType = 'image/jpeg';
  let base64Data = content;

  if (content.startsWith('data:image/')) {
    const match = content.match(/^data:(image\/[a-zA-Z0-9+\-+.]+);base64,(.+)$/s);
    if (!match) return null;
    mimeType = match[1];
    base64Data = match[2];
  } else {
    return null;
  }

  try {
    const folderId = await getOrCreatePastebinFolderId();
    const ext = mimeType.split('/')[1] || 'jpg';
    const cleanTitle = (title || 'Photo').substring(0, 30).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `paste_${Date.now()}_${cleanTitle}.${ext}`;

    const uploaded = await uploadToFolder(folderId, fileName, mimeType, base64Data);
    return { viewUrl: uploaded.viewUrl, fileId: uploaded.fileId };
  } catch (err: any) {
    console.error('[Pastebin] GDrive image upload error:', err.message || err);
    return null;
  }
}

export async function pastebinHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const path = new URL(request.url).pathname;
  const pasteId = request.params.id;

  try {
    const db = await connectToMongo();
    const col = db.collection('pastebin');
    const settingsCol = db.collection('userSettings');

    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // Auto-cleanup expired ephemeral pastes & trash their Google Drive images
    const nowIso = new Date().toISOString();
    const expiredPastes = await col.find({
      type: 'ephemeral',
      expiresAt: { $exists: true, $ne: null, $lt: nowIso }
    }).toArray();

    for (const ep of expiredPastes) {
      if (ep.imageFileId) {
        await trashFileOrFolderInDrive(ep.imageFileId);
      }
    }

    if (expiredPastes.length > 0) {
      await col.deleteMany({
        type: 'ephemeral',
        expiresAt: { $exists: true, $ne: null, $lt: nowIso }
      });
    }

    // ── 1. GET - Fetch pastes & section privacy ──────────────────────────────
    if (method === 'GET') {
      const singleId = pasteId || new URL(request.url).searchParams.get('id');
      if (singleId && singleId !== 'privacy') {
        const paste = await col.findOne({ id: singleId });
        if (!paste) {
          return { status: 404, jsonBody: { error: 'Paste not found or expired.' } };
        }
        if (paste.isPrivate && !isAuthorized) {
          return { status: 401, jsonBody: { error: 'Unauthorized. This paste is private.' } };
        }

        const { _id, ...rest } = paste;

        // If burn-after-reading, trash Google Drive image & delete immediately after single read
        if (paste.type === 'ephemeral' && paste.isBurnAfterReading) {
          if (paste.imageFileId) {
            await trashFileOrFolderInDrive(paste.imageFileId);
          }
          await col.deleteOne({ id: singleId });
        }

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: rest
        };
      }

      const pastes = await col.find({}).sort({ isPinned: -1, createdAt: -1 }).toArray();

      // Fetch board privacy setting
      const privacyDoc = await settingsCol.findOne({ key: 'pasteBoardPrivate' });
      const isBoardPrivate = privacyDoc ? !!privacyDoc.value : false;

      // Filter private items if unauthenticated visitor
      const visiblePastes = isAuthorized
        ? pastes
        : (isBoardPrivate ? [] : pastes.filter(p => !p.isPrivate));

      const cleaned = visiblePastes.map(p => {
        const { _id, ...rest } = p;
        return rest;
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { pastes: cleaned, isBoardPrivate }
      };
    }

    // ── 2. POST /api/pastebin/privacy — Toggle Section Privacy ─────────────────
    if (pasteId === 'privacy' || path.endsWith('/privacy')) {
      if (!isAuthorized) return { status: 401, jsonBody: { error: 'Unauthorized.' } };
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const isBoardPrivate = !!body.isBoardPrivate;
      await settingsCol.updateOne(
        { key: 'pasteBoardPrivate' },
        { $set: { key: 'pasteBoardPrivate', value: isBoardPrivate } },
        { upsert: true }
      );
      return { status: 200, jsonBody: { success: true, isBoardPrivate } };
    }

    // ── 3. POST - Create new paste (Public pastes allowed, Private requires auth) ──
    if (method === 'POST') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const { title, content, language, category, type, expiryOption, isPrivate, isPinned } = body;
      if (!content || typeof content !== 'string' || !content.trim()) {
        return { status: 400, jsonBody: { error: 'Content is required.' } };
      }

      if (isPrivate && !isAuthorized) {
        return { status: 401, jsonBody: { error: 'Unauthorized. Login required to create private pastes.' } };
      }

      let finalContent = content.trim();
      let imageFileId: string | null = null;
      let pasteLang = language || 'plaintext';

      // Check if image base64 data is present -> upload to Google Drive!
      if (finalContent.startsWith('data:image/') || pasteLang === 'image') {
        const driveResult = await uploadBase64ImageToDrive(title || 'Pasted Image', finalContent);
        if (driveResult) {
          finalContent = driveResult.viewUrl;
          imageFileId = driveResult.fileId;
          pasteLang = 'image';
        }
      }

      const id = body.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));
      const pasteType = type === 'ephemeral' ? 'ephemeral' : 'persistent';
      let expiresAt: string | null = null;
      let isBurnAfterReading = false;

      if (pasteType === 'ephemeral') {
        const selectedExpiry = expiryOption || '24h';
        if (selectedExpiry === 'burn') {
          isBurnAfterReading = true;
          // Burn after reading also has safety max TTL of 24h
          expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        } else {
          const duration = EXPIRY_MAP[selectedExpiry] || EXPIRY_MAP['24h'];
          expiresAt = new Date(Date.now() + duration).toISOString();
        }
      }

      const newPaste = {
        id,
        title: title ? title.trim() : 'Untitled Paste',
        content: finalContent,
        imageFileId: imageFileId || null,
        language: pasteLang,
        category: category || (imageFileId ? 'Images' : 'General'),
        type: pasteType,
        expiryOption: expiryOption || (pasteType === 'ephemeral' ? '24h' : 'never'),
        expiresAt,
        isBurnAfterReading,
        isPrivate: !!isPrivate,
        isPinned: !!isPinned,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await col.insertOne(newPaste);
      return { status: 201, jsonBody: newPaste };
    }

    // ── Writes & Deletes for existing items require Auth ──────────────────────
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized. Login required to edit or delete pastes.' } };
    }

    // ── 4. PUT - Update paste ─────────────────────────────────────────────────
    if (method === 'PUT' && pasteId) {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const existing = await col.findOne({ id: pasteId });
      if (!existing) {
        return { status: 404, jsonBody: { error: 'Paste not found.' } };
      }

      const updateFields: any = { updatedAt: new Date().toISOString() };
      if (body.title !== undefined) updateFields.title = body.title.trim();
      
      if (body.content !== undefined) {
        let contentVal = body.content.trim();
        if (contentVal.startsWith('data:image/') || body.language === 'image') {
          const driveResult = await uploadBase64ImageToDrive(body.title || existing.title, contentVal);
          if (driveResult) {
            updateFields.content = driveResult.viewUrl;
            updateFields.imageFileId = driveResult.fileId;
            updateFields.language = 'image';
            if (existing.imageFileId && existing.imageFileId !== driveResult.fileId) {
              await trashFileOrFolderInDrive(existing.imageFileId);
            }
          } else {
            updateFields.content = contentVal;
          }
        } else {
          updateFields.content = contentVal;
        }
      }

      if (body.language !== undefined) updateFields.language = body.language;
      if (body.category !== undefined) updateFields.category = body.category;
      if (body.isPrivate !== undefined) updateFields.isPrivate = !!body.isPrivate;
      if (body.isPinned !== undefined) updateFields.isPinned = !!body.isPinned;

      await col.updateOne({ id: pasteId }, { $set: updateFields });
      const updated = await col.findOne({ id: pasteId });
      const { _id, ...rest } = updated!;
      return { status: 200, jsonBody: rest };
    }

    // ── 5. DELETE - Remove paste ──────────────────────────────────────────────
    if (method === 'DELETE' && pasteId) {
      const pasteToDelete = await col.findOne({ id: pasteId });
      if (pasteToDelete && pasteToDelete.imageFileId) {
        await trashFileOrFolderInDrive(pasteToDelete.imageFileId);
      }

      const result = await col.deleteOne({ id: pasteId });
      if (result.deletedCount === 0) {
        return { status: 404, jsonBody: { error: 'Paste not found.' } };
      }
      return { status: 200, jsonBody: { success: true, id: pasteId } };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Pastebin handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('pastebin', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'pastebin/{*id}',
  handler: pastebinHandler
});
