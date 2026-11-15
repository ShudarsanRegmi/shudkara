import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ObjectId } from 'mongodb';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import { connectToMongo, verifySession, extractToken, logAppError } from './db';
import { 
  createFolderInDrive, uploadToFolder, listSubFolders, 
  getFilesInFolder, getFileContent, ensureFilePublic, deleteFolderFromDrive,
  initiateResumableSession, uploadChunkToSession
} from './gdrive';

// ── Steganographic Clearance Levels & Cryptic Sanskrit Nomenclature ──
export type ClearanceTier = 'prakata' | 'guhya' | 'nigudha';

export const CLEARANCE_TIERS: Record<ClearanceTier, number> = {
  prakata: 0,
  guhya: 1,
  nigudha: 2
};

export const CLEARANCE_LEVELS: Record<number, ClearanceTier> = {
  0: 'prakata',
  1: 'guhya',
  2: 'nigudha'
};

export function parseClearanceLevel(val: any): number {
  if (typeof val === 'number' && [0, 1, 2].includes(val)) {
    return val;
  }
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim() as ClearanceTier;
    if (CLEARANCE_TIERS[lower] !== undefined) {
      return CLEARANCE_TIERS[lower];
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && [0, 1, 2].includes(num)) {
      return num;
    }
  }
  return 0; // Default: prakata (Level 0)
}

export function extractClearanceToken(request: HttpRequest): string | null {
  const header = request.headers.get('x-clearance-token') || request.headers.get('x-clearance');
  if (header) return header.trim();
  const url = new URL(request.url);
  return url.searchParams.get('clearanceToken');
}

export async function getValidatedClearance(request: HttpRequest, db: any): Promise<{ level: number; tier: ClearanceTier; expiresAt: Date | null }> {
  const token = extractClearanceToken(request);
  if (!token) {
    return { level: 0, tier: 'prakata', expiresAt: null };
  }

  const clearanceDoc = await db.collection('timeline_clearances').findOne({
    token,
    expiresAt: { $gt: new Date() }
  });

  if (!clearanceDoc) {
    return { level: 0, tier: 'prakata', expiresAt: null };
  }

  const level = parseClearanceLevel(clearanceDoc.level);
  return {
    level,
    tier: CLEARANCE_LEVELS[level] || 'prakata',
    expiresAt: clearanceDoc.expiresAt
  };
}

// Helper to create clean directory slugs
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export async function timelineHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/^\/api\/timeline\/?/, '').split('/').filter(Boolean);

  try {
    const db = await connectToMongo();
    const col = db.collection('timeline');

    // ─────────────────────────────────────────────────────────────────────────
    // 0. PUBLIC ENDPOINTS (NO AUTHENTICATION REQUIRED)
    // ─────────────────────────────────────────────────────────────────────────
    if (pathParts[0] === 'public') {
      const publicId = pathParts[1];
      const action = pathParts[2]; // undefined | 'react' | 'comment'

      if (!publicId || !ObjectId.isValid(publicId)) {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid post ID.' } };
      }

      const post = await col.findOne({ _id: new ObjectId(publicId) });
      if (!post || (post.clearanceLevel && post.clearanceLevel > 0)) {
        return { status: 404, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Post not found or has been removed.' } };
      }

      // 0.1 GET /api/timeline/public/:id (Read Public Post)
      if (method === 'GET' && !action) {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            post: {
              _id: post._id,
              title: post.title || '',
              content: post.content || '',
              timestamp: post.timestamp,
              createdAt: post.createdAt,
              category: post.category || 'General',
              tags: post.tags || [],
              media: post.media || [],
              reactions: post.reactions || [],
              comments: post.comments || []
            }
          }
        };
      }

      // 0.2 POST /api/timeline/public/:id/react (Guest Emoji Reactions)
      if (method === 'POST' && action === 'react') {
        let body: any;
        try { body = await request.json(); }
        catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

        const emoji = (body.reaction || body.emoji || '').trim().toLowerCase();
        const name = (body.name || '').trim();

        if (!emoji) {
          return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Reaction key is required.' } };
        }
        if (!name) {
          return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Name is required to react.' } };
        }

        const reactions: any[] = Array.isArray(post.reactions) ? [...post.reactions] : [];
        const existingIdx = reactions.findIndex(r => (r.name || '').toLowerCase() === name.toLowerCase());

        if (existingIdx >= 0) {
          if (reactions[existingIdx].emoji === emoji) {
            // Clicking same emoji toggles it off
            reactions.splice(existingIdx, 1);
          } else {
            // Changing to a different emoji
            reactions[existingIdx] = {
              emoji,
              name,
              createdAt: new Date().toISOString()
            };
          }
        } else {
          // Add new reaction
          reactions.push({
            emoji,
            name,
            createdAt: new Date().toISOString()
          });
        }

        await col.updateOne({ _id: new ObjectId(publicId) }, { $set: { reactions } });
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: true, reactions }
        };
      }

      // 0.3 POST /api/timeline/public/:id/comment (Guest Comments)
      if (method === 'POST' && action === 'comment') {
        let body: any;
        try { body = await request.json(); }
        catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

        const name = (body.name || '').trim();
        const text = (body.text || '').trim();

        if (!name) {
          return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Name is required to post a comment.' } };
        }
        if (!text) {
          return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Comment text cannot be empty.' } };
        }

        const newComment = {
          id: crypto.randomUUID(),
          name,
          text,
          createdAt: new Date().toISOString()
        };

        const comments = Array.isArray(post.comments) ? [...post.comments, newComment] : [newComment];
        await col.updateOne({ _id: new ObjectId(publicId) }, { $set: { comments } });

        return {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: true, comment: newComment, comments }
        };
      }

      return { status: 405, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: `Method ${method} not allowed for public route.` } };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AUTHENTICATION CHECK FOR PRIVATE / ADMIN ROUTES
    // ─────────────────────────────────────────────────────────────────────────
    const token = extractToken(request);
    const isAuthorized = await verifySession(token);
    if (!isAuthorized) {
      return { status: 401, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Unauthorized.' } };
    }

    const { level: activeClearance, tier: activeTier, expiresAt: clearanceExpiresAt } = await getValidatedClearance(request, db);

    // ─────────────────────────────────────────────────────────────────────────
    // 0.5 CLEARANCE CONTROL & ELEVATION ENDPOINTS (/api/timeline/clearance/*)
    // ─────────────────────────────────────────────────────────────────────────
    if (pathParts[0] === 'clearance') {
      const clearanceAction = pathParts[1];

      // 0.5.1 GET /api/timeline/clearance/status (Get current lease status)
      if (method === 'GET' && (!clearanceAction || clearanceAction === 'status')) {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            active: activeClearance > 0,
            level: activeClearance,
            tier: activeTier,
            expiresAt: clearanceExpiresAt ? clearanceExpiresAt.toISOString() : null
          }
        };
      }

      // 0.5.2 POST /api/timeline/clearance/verify-totp (Unlock Guhya / Level 1)
      if (method === 'POST' && clearanceAction === 'verify-totp') {
        let body: any;
        try { body = await request.json(); }
        catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

        const { code } = body;
        if (!code || typeof code !== 'string') {
          return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'TOTP code is required.' } };
        }

        const authConfig = await db.collection('auth').findOne({ key: 'totp' });
        if (!authConfig?.secret) {
          return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'TOTP is not configured on this system yet.' } };
        }

        const verified = speakeasy.totp.verify({
          secret: authConfig.secret,
          encoding: 'base32',
          token: code.trim(),
          window: 1
        });

        if (!verified) {
          return { status: 401, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid verification code.' } };
        }

        // Generate 15-minute lease token for Guhya (Level 1)
        const clearanceToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 Minutes
        await db.collection('timeline_clearances').insertOne({
          token: clearanceToken,
          level: 1,
          tier: 'guhya',
          createdAt: new Date(),
          expiresAt
        });

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            success: true,
            clearanceToken,
            level: 1,
            tier: 'guhya',
            expiresAt: expiresAt.toISOString()
          }
        };
      }

      // 0.5.3 POST /api/timeline/clearance/biometric/register-challenge (WebAuthn setup challenge)
      if (method === 'POST' && clearanceAction === 'biometric' && pathParts[2] === 'register-challenge') {
        const challenge = crypto.randomBytes(32).toString('base64url');
        await db.collection('timeline_webauthn_challenges').insertOne({
          challenge,
          type: 'register',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        });

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            challenge,
            rp: { name: 'Shudkara Timeline' },
            user: {
              id: Buffer.from('shudkara-owner').toString('base64url'),
              name: 'shudkara-owner',
              displayName: 'Shudkara Owner'
            },
            pubKeyCredParams: [
              { alg: -7, type: 'public-key' },  // ES256
              { alg: -257, type: 'public-key' } // RS256
            ],
            authenticatorSelection: {
              userVerification: 'preferred'
            },
            timeout: 60000
          }
        };
      }

      // 0.5.4 POST /api/timeline/clearance/biometric/verify-registration (Store passkey public key)
      if (method === 'POST' && clearanceAction === 'biometric' && pathParts[2] === 'verify-registration') {
        let body: any;
        try { body = await request.json(); }
        catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

        const { id, rawId, type, response } = body;
        if (!id) {
          return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Credential ID is required.' } };
        }

        await db.collection('timeline_passkeys').updateOne(
          { credentialId: id },
          {
            $set: {
              credentialId: id,
              rawId: rawId || id,
              type: type || 'public-key',
              publicKey: response?.publicKey || '',
              transports: response?.transports || ['hybrid', 'internal'],
              createdAt: new Date()
            }
          },
          { upsert: true }
        );

        // Grant Nigudha (Level 2) clearance immediately on successful registration
        const clearanceToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await db.collection('timeline_clearances').insertOne({
          token: clearanceToken,
          level: 2,
          tier: 'nigudha',
          createdAt: new Date(),
          expiresAt
        });

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            success: true,
            clearanceToken,
            level: 2,
            tier: 'nigudha',
            expiresAt: expiresAt.toISOString()
          }
        };
      }

      // 0.5.5 POST /api/timeline/clearance/biometric/auth-challenge (WebAuthn auth challenge)
      if (method === 'POST' && clearanceAction === 'biometric' && pathParts[2] === 'auth-challenge') {
        const passkeys = await db.collection('timeline_passkeys').find({}).toArray();
        const challenge = crypto.randomBytes(32).toString('base64url');
        await db.collection('timeline_webauthn_challenges').insertOne({
          challenge,
          type: 'auth',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        });

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            challenge,
            allowCredentials: passkeys.map((p: any) => ({
              id: p.credentialId,
              type: 'public-key',
              transports: p.transports || ['hybrid', 'internal']
            })),
            hasRegisteredPasskeys: passkeys.length > 0,
            timeout: 60000
          }
        };
      }

      // 0.5.6 POST /api/timeline/clearance/biometric/verify-auth (Unlock Nigudha / Level 2)
      if (method === 'POST' && clearanceAction === 'biometric' && pathParts[2] === 'verify-auth') {
        let body: any;
        try { body = await request.json(); }
        catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

        const { id } = body;
        const passkeysCount = await db.collection('timeline_passkeys').countDocuments();
        if (passkeysCount > 0) {
          const passkey = await db.collection('timeline_passkeys').findOne({ credentialId: id });
          if (!passkey) {
            return { status: 401, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Unknown passkey credential.' } };
          }
        }

        // Issue Nigudha (Level 2) clearance lease token
        const clearanceToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await db.collection('timeline_clearances').insertOne({
          token: clearanceToken,
          level: 2,
          tier: 'nigudha',
          createdAt: new Date(),
          expiresAt
        });

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            success: true,
            clearanceToken,
            level: 2,
            tier: 'nigudha',
            expiresAt: expiresAt.toISOString()
          }
        };
      }

      // 0.5.7 POST /api/timeline/clearance/lock (Panic Conceal / Reset to Prakata)
      if (method === 'POST' && clearanceAction === 'lock') {
        const tokenToRevoke = extractClearanceToken(request);
        if (tokenToRevoke) {
          await db.collection('timeline_clearances').deleteMany({ token: tokenToRevoke });
        }
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: true, level: 0, tier: 'prakata', message: 'Clearance concealed.' }
        };
      }

      return { status: 404, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Clearance route not found.' } };
    }

    // ── 1. POST /api/timeline/sync-drive (Scan Google Drive for offline folders) ──
    if (method === 'POST' && pathParts[0] === 'sync-drive') {
      context.log('Starting Google Drive timeline sync operation...');
      const subFolders = await listSubFolders();
      let importedCount = 0;

      for (const folder of subFolders) {
        // Check if folder is already registered in MongoDB
        const existing = await col.findOne({ googleDriveFolderId: folder.id });
        if (existing) continue;

        context.log(`Found new directory on Drive: "${folder.name}" (${folder.id}). Scanning...`);

        // Fetch folder contents
        const files = await getFilesInFolder(folder.id);
        const jsonFile = files.find(f => f.name.toLowerCase() === 'post.json');
        
        let metadata: any = {
          title: folder.name,
          content: 'No content description in post.json',
          category: 'General',
          tags: [],
          timestamp: new Date(),
          clearanceLevel: 0
        };

        // If post.json exists, download and parse it
        if (jsonFile) {
          try {
            const rawContent = await getFileContent(jsonFile.id);
            const parsed = JSON.parse(rawContent);
            metadata = {
              title: parsed.title || metadata.title,
              content: parsed.content || metadata.content,
              category: parsed.category || metadata.category,
              tags: Array.isArray(parsed.tags) ? parsed.tags : [],
              timestamp: parsed.timestamp ? new Date(parsed.timestamp) : new Date(),
              clearanceLevel: parseClearanceLevel(parsed.clearanceLevel ?? parsed.clearanceTier)
            };
          } catch (jsonErr: any) {
            context.error(`Failed to parse post.json in folder ${folder.name}:`, jsonErr.message);
          }
        }

        // Process attachments (everything except post.json)
        const attachments = files.filter(f => f.name.toLowerCase() !== 'post.json');
        const mediaItems: any[] = [];

        for (const file of attachments) {
          try {
            const publicRes = await ensureFilePublic(file.id);
            const isVideo = (file.mimeType || '').startsWith('video/');
            mediaItems.push({
              googleDriveId: file.id,
              fileName: file.name,
              mimeType: file.mimeType,
              viewUrl: isVideo ? `https://drive.google.com/uc?export=download&id=${file.id}` : publicRes.viewUrl,
              thumbnailUrl: publicRes.thumbnailUrl,
              previewUrl: `https://drive.google.com/file/d/${file.id}/preview`,
              streamUrl: `https://drive.google.com/uc?export=download&id=${file.id}`
            });
          } catch (fileErr: any) {
            context.error(`Failed to set permission on file ${file.name}:`, fileErr.message);
          }
        }

        // Insert post document
        const postClearance = parseClearanceLevel(metadata.clearanceLevel);
        const newPost = {
          title: metadata.title.trim(),
          content: metadata.content.trim(),
          timestamp: metadata.timestamp,
          createdAt: new Date(),
          clearanceLevel: postClearance,
          clearanceTier: CLEARANCE_LEVELS[postClearance],
          category: metadata.category.trim(),
          tags: metadata.tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean),
          googleDriveFolderId: folder.id,
          media: mediaItems,
          reactions: [],
          comments: []
        };

        await col.insertOne(newPost);
        importedCount++;
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, message: `Sync complete. Imported ${importedCount} new memories.` }
      };
    }

    // ── 2. GET /api/timeline/tags (Aggregate all tags and categories) ──
    if (method === 'GET' && pathParts[0] === 'tags') {
      const clearanceCondition = activeClearance === 0 
        ? { $or: [{ clearanceLevel: 0 }, { clearanceLevel: { $exists: false } }] }
        : { $or: [{ clearanceLevel: { $lte: activeClearance } }, { clearanceLevel: { $exists: false } }] };

      const categories = await col.distinct('category', clearanceCondition);
      const tags = await col.distinct('tags', clearanceCondition);
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          categories: categories.filter(Boolean),
          tags: tags.filter(Boolean)
        }
      };
    }

    // ── 2b. GET /api/timeline/logs (Fetch recent timeline & application error logs) ──
    if (method === 'GET' && pathParts[0] === 'logs') {
      const logs = await db.collection('system_logs')
        .find({})
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, count: logs.length, logs }
      };
    }

    // ── 3a. POST /api/timeline/:id/media/init-chunked (Start Resumable Chunked Upload Session) ──
    if (method === 'POST' && pathParts.length === 3 && pathParts[1] === 'media' && pathParts[2] === 'init-chunked') {
      const postId = pathParts[0];
      if (!ObjectId.isValid(postId)) {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid post ID.' } };
      }

      const post = await col.findOne({ _id: new ObjectId(postId) });
      if (!post || parseClearanceLevel(post.clearanceLevel) > activeClearance) {
        return { status: 404, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Post not found.' } };
      }

      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

      const { name, type, size } = body;
      if (!name || typeof size !== 'number' || size <= 0) {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'File name and valid positive size are required.' } };
      }

      let folderId = post.googleDriveFolderId;
      try {
        if (!folderId) {
          const rawDate = post.timestamp ? new Date(post.timestamp) : new Date();
          const postDate = !isNaN(rawDate.getTime()) ? rawDate : new Date();
          const datePrefix = postDate.toISOString().substring(0, 10);
          const folderSlug = post.title ? slugify(post.title) : 'moment';
          folderId = await createFolderInDrive(`${datePrefix}-${folderSlug || 'moment'}`, 'Timeline');
          await col.updateOne({ _id: new ObjectId(postId) }, { $set: { googleDriveFolderId: folderId } });
        }

        const sessionUrl = await initiateResumableSession(folderId, name, type || 'application/octet-stream', size);
        const sessionCol = db.collection('upload_sessions');
        // Ensure 24-hr TTL cleanup index exists
        sessionCol.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }).catch(() => {});

        const sessionDoc = {
          postId: new ObjectId(postId),
          folderId,
          fileName: name,
          mimeType: type || 'application/octet-stream',
          totalBytes: size,
          sessionUrl,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await sessionCol.insertOne(sessionDoc);
        const chunkSize = 4 * 1024 * 1024; // 4 MB chunk size (multiple of 256KB)

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            success: true,
            uploadId: result.insertedId.toString(),
            chunkSize
          }
        };
      } catch (initErr: any) {
        context.error(`Failed to initiate resumable session for "${name}":`, initErr);
        return {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { error: `Failed to initiate resumable upload with Google Drive: ${initErr.message}` }
        };
      }
    }

    // ── 3b. POST /api/timeline/:id/media/upload-chunk (Stream single chunk to Resumable Session) ──
    if (method === 'POST' && pathParts.length === 3 && pathParts[1] === 'media' && pathParts[2] === 'upload-chunk') {
      const postId = pathParts[0];
      if (!ObjectId.isValid(postId)) {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid post ID.' } };
      }

      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

      const { uploadId, chunkBase64, startByte, endByte, totalBytes } = body;
      if (!uploadId || !ObjectId.isValid(uploadId) || !chunkBase64 || typeof startByte !== 'number' || typeof endByte !== 'number' || typeof totalBytes !== 'number') {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Missing or invalid chunk parameters.' } };
      }

      const session = await db.collection('upload_sessions').findOne({ _id: new ObjectId(uploadId) });
      if (!session) {
        return { status: 404, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Upload session not found or expired. Please restart upload.' } };
      }

      try {
        const chunkBuffer = Buffer.from(chunkBase64.split(';base64,').pop() || chunkBase64, 'base64');
        const chunkRes = await uploadChunkToSession(
          session.sessionUrl,
          chunkBuffer,
          startByte,
          endByte,
          totalBytes,
          session.mimeType
        );

        if (!chunkRes.complete) {
          await db.collection('upload_sessions').updateOne(
            { _id: new ObjectId(uploadId) },
            { $set: { updatedAt: new Date() } }
          );
          return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            jsonBody: { success: true, complete: false }
          };
        }

        // Upload Completed!
        const fileId = chunkRes.fileId!;
        let publicRes = {
          viewUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
          thumbnailUrl: `https://lh3.googleusercontent.com/d/${fileId}`
        };
        try {
          publicRes = await ensureFilePublic(fileId);
        } catch (permErr: any) {
          context.warn('Could not set public permissions on uploaded file:', permErr.message);
        }

        const isVideo = (session.mimeType || '').startsWith('video/');
        const viewUrl = isVideo 
          ? `https://drive.google.com/uc?export=download&id=${fileId}`
          : publicRes.viewUrl;
        const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        const thumbnailUrl = chunkRes.fileData?.thumbnailLink || (isVideo ? previewUrl : viewUrl);

        const mediaItem = {
          googleDriveId: fileId,
          fileName: session.fileName,
          mimeType: session.mimeType,
          viewUrl,
          thumbnailUrl,
          previewUrl,
          streamUrl: `https://drive.google.com/uc?export=download&id=${fileId}`
        };

        const post = await col.findOne({ _id: new ObjectId(postId) });
        const currentMedia = Array.isArray(post?.media) ? [...post.media, mediaItem] : [mediaItem];
        await col.updateOne({ _id: new ObjectId(postId) }, { $set: { media: currentMedia } });

        // Clean up completed session
        await db.collection('upload_sessions').deleteOne({ _id: new ObjectId(uploadId) });

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: {
            success: true,
            complete: true,
            mediaItem,
            media: currentMedia
          }
        };
      } catch (chunkErr: any) {
        context.error(`Failed to upload chunk for uploadId ${uploadId}:`, chunkErr);
        return {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { error: `Failed to upload chunk: ${chunkErr.message}` }
        };
      }
    }

    // ── 3. POST /api/timeline/:id/media (Single file upload directly to post folder) ──
    if (method === 'POST' && pathParts.length === 2 && pathParts[1] === 'media') {
      const postId = pathParts[0];
      if (!ObjectId.isValid(postId)) {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid post ID.' } };
      }

      const post = await col.findOne({ _id: new ObjectId(postId) });
      if (!post || parseClearanceLevel(post.clearanceLevel) > activeClearance) {
        return { status: 404, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Post not found.' } };
      }

      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

      const { name, type, base64 } = body;
      if (!name || !base64) {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'File name and base64 data are required.' } };
      }

      let folderId = post.googleDriveFolderId;
      try {
        if (!folderId) {
          const rawDate = post.timestamp ? new Date(post.timestamp) : new Date();
          const postDate = !isNaN(rawDate.getTime()) ? rawDate : new Date();
          const datePrefix = postDate.toISOString().substring(0, 10);
          const folderSlug = post.title ? slugify(post.title) : 'moment';
          folderId = await createFolderInDrive(`${datePrefix}-${folderSlug || 'moment'}`, 'Timeline');
          await col.updateOne({ _id: new ObjectId(postId) }, { $set: { googleDriveFolderId: folderId } });
        }

        const driveRes = await uploadToFolder(folderId, name, type || 'image/jpeg', base64);
        const mediaItem = {
          googleDriveId: driveRes.fileId,
          fileName: name,
          mimeType: type || 'image/jpeg',
          viewUrl: driveRes.viewUrl,
          thumbnailUrl: driveRes.thumbnailUrl,
          previewUrl: driveRes.previewUrl,
          streamUrl: driveRes.streamUrl
        };

        const currentMedia = Array.isArray(post.media) ? [...post.media, mediaItem] : [mediaItem];
        await col.updateOne({ _id: new ObjectId(postId) }, { $set: { media: currentMedia } });

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: true, mediaItem, media: currentMedia }
        };
      } catch (uploadErr: any) {
        context.error(`Failed to upload single file "${name}":`, uploadErr);
        return {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { error: `Failed to upload "${name}" to Google Drive: ${uploadErr.message}` }
        };
      }
    }

    // ── 4. GET /api/timeline (Get feed posts, with filters) ──
    if (method === 'GET' && pathParts.length === 0) {
      const category = url.searchParams.get('category');
      const tag = url.searchParams.get('tag');
      const search = url.searchParams.get('search');
      
      const limit = Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20);
      const skip = Math.max(0, parseInt(url.searchParams.get('skip') || '0', 10) || 0);

      const filter: any = {};
      if (category) filter.category = category;
      if (tag) filter.tags = tag;
      if (search && search.trim()) {
        const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
          { title: { $regex: safeSearch, $options: 'i' } },
          { content: { $regex: safeSearch, $options: 'i' } }
        ];
      }

      // Steganographic Clearance Filter: cumulative visibility (prakata <= guhya <= nigudha)
      // Posts without clearanceLevel default to 0 (prakata)
      const clearanceCondition = activeClearance === 0 
        ? { $or: [{ clearanceLevel: 0 }, { clearanceLevel: { $exists: false } }] }
        : { $or: [{ clearanceLevel: { $lte: activeClearance } }, { clearanceLevel: { $exists: false } }] };

      let combinedFilter: any;
      if (Object.keys(filter).length === 0) {
        combinedFilter = clearanceCondition;
      } else if (filter.$or) {
        combinedFilter = { $and: [clearanceCondition, filter] };
      } else {
        combinedFilter = { ...filter, ...clearanceCondition };
      }

      const posts = await col.find(combinedFilter)
        .sort({ timestamp: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await col.countDocuments(combinedFilter);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { posts, total, activeClearance: { level: activeClearance, tier: activeTier } }
      };
    }

    // ── 5. POST /api/timeline (Create entry + create folder + upload initial media) ──
    if (method === 'POST' && pathParts.length === 0) {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

      const { title, content, timestamp, category, tags, mediaFiles } = body;
      
      if (!content?.trim()) {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Content is required.' } };
      }

      const requestedClearance = parseClearanceLevel(body.clearanceLevel ?? body.clearanceTier);

      const rawDate = timestamp ? new Date(timestamp) : new Date();
      const postDate = !isNaN(rawDate.getTime()) ? rawDate : new Date();
      const datePrefix = postDate.toISOString().substring(0, 10);
      const folderSlug = title ? slugify(title) : 'moment';
      const folderName = `${datePrefix}-${folderSlug || 'moment'}`;

      // A. Create the folder in Google Drive (Non-fatal: NEVER block post creation if Drive is slow or failing)
      let folderId = '';
      try {
        folderId = await createFolderInDrive(folderName, 'Timeline');
      } catch (folderErr: any) {
        context.warn('Google Drive folder creation deferred (will create on media upload):', folderErr?.message || folderErr);
      }

      // B. Create the post.json metadata file inside the new folder
      const metadataPayload = {
        title: (title || '').trim(),
        content: content.trim(),
        category: (category || 'General').trim(),
        tags: Array.isArray(tags) ? tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [],
        timestamp: postDate.toISOString(),
        clearanceLevel: requestedClearance,
        clearanceTier: CLEARANCE_LEVELS[requestedClearance]
      };
      
      if (folderId) {
        try {
          const metadataBase64 = Buffer.from(JSON.stringify(metadataPayload, null, 2)).toString('base64');
          await uploadToFolder(folderId, 'post.json', 'application/json', metadataBase64);
        } catch (metaErr: any) {
          context.error('Failed to upload post.json description to GDrive folder:', metaErr);
        }
      }

      // C. Process uploaded media files if passed directly
      const uploadedMedia: any[] = [];
      if (folderId && mediaFiles && Array.isArray(mediaFiles) && mediaFiles.length > 0) {
        for (const file of mediaFiles) {
          if (!file || !file.name || !file.base64 || typeof file.base64 !== 'string') {
            context.warn('Skipping invalid media file in POST /api/timeline:', file?.name);
            continue;
          }
          try {
            const driveRes = await uploadToFolder(folderId, file.name, file.type || 'image/jpeg', file.base64);
            uploadedMedia.push({
              googleDriveId: driveRes.fileId,
              fileName: file.name,
              mimeType: file.type || 'image/jpeg',
              viewUrl: driveRes.viewUrl,
              thumbnailUrl: driveRes.thumbnailUrl,
              previewUrl: driveRes.previewUrl,
              streamUrl: driveRes.streamUrl
            });
          } catch (driveErr: any) {
            context.error(`Failed to upload file "${file.name}" to folder:`, driveErr);
            // Non-fatal: continue so post writeup is NEVER rejected because of one image glitch
          }
        }
      }

      const newPost = {
        title: metadataPayload.title,
        content: metadataPayload.content,
        timestamp: postDate,
        createdAt: new Date(),
        clearanceLevel: requestedClearance,
        clearanceTier: CLEARANCE_LEVELS[requestedClearance],
        category: metadataPayload.category,
        tags: metadataPayload.tags,
        googleDriveFolderId: folderId,
        gdriveBucket: 'StorageBuckets/ShudkaraBucket/Timeline',
        media: uploadedMedia,
        reactions: [],
        comments: []
      };

      const result = await col.insertOne(newPost);
      return {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: true, postId: result.insertedId.toString(), post: { ...newPost, _id: result.insertedId } }
      };
    }

    // ── 6. PUT /api/timeline/{id} (Update entry metadata & manage media/pictures) ──
    const idParam = pathParts[0];
    if (method === 'PUT' && idParam && ObjectId.isValid(idParam)) {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid JSON body.' } }; }

      const { title, content, timestamp, category, tags, newMediaFiles, removedMediaIds, reorderedMedia } = body;
      
      const updateData: any = {};
      if (title !== undefined) updateData.title = (title || '').trim();
      if (content !== undefined) updateData.content = content.trim();
      if (timestamp !== undefined) {
        const parsed = new Date(timestamp);
        updateData.timestamp = !isNaN(parsed.getTime()) ? parsed : new Date();
      }
      if (category !== undefined) updateData.category = (category || 'General').trim();
      if (tags !== undefined && Array.isArray(tags)) {
        updateData.tags = tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean);
      }

      const post = await col.findOne({ _id: new ObjectId(idParam) });
      if (!post || parseClearanceLevel(post.clearanceLevel) > activeClearance) {
        return { status: 404, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Post not found.' } };
      }

      if (body.clearanceLevel !== undefined || body.clearanceTier !== undefined) {
        const newClearance = parseClearanceLevel(body.clearanceLevel ?? body.clearanceTier);
        if (newClearance > activeClearance) {
          return {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
            jsonBody: { error: `Insufficient clearance to elevate post to ${CLEARANCE_LEVELS[newClearance]}.` }
          };
        }
        updateData.clearanceLevel = newClearance;
        updateData.clearanceTier = CLEARANCE_LEVELS[newClearance];
      }

      // Handle media removals from Google Drive & post
      let currentMedia: any[] = Array.isArray(reorderedMedia) 
        ? [...reorderedMedia] 
        : (Array.isArray(post.media) ? [...post.media] : []);

      if (Array.isArray(removedMediaIds) && removedMediaIds.length > 0) {
        const removedSet = new Set(removedMediaIds);
        for (const m of currentMedia) {
          if (removedSet.has(m.googleDriveId)) {
            try {
              await deleteFolderFromDrive(m.googleDriveId);
            } catch (delErr: any) {
              context.warn(`Failed to delete removed drive file ${m.googleDriveId}:`, delErr.message);
            }
          }
        }
        currentMedia = currentMedia.filter(m => !removedSet.has(m.googleDriveId));
      }

      // Handle adding new media pictures to Google Drive
      if (Array.isArray(newMediaFiles) && newMediaFiles.length > 0) {
        let folderId = post.googleDriveFolderId;
        if (!folderId) {
          const rawDate = updateData.timestamp || (post.timestamp ? new Date(post.timestamp) : new Date());
          const postDate = !isNaN(rawDate.getTime()) ? rawDate : new Date();
          const datePrefix = postDate.toISOString().substring(0, 10);
          const folderSlug = (updateData.title || post.title) ? slugify(updateData.title || post.title) : 'moment';
          folderId = await createFolderInDrive(`${datePrefix}-${folderSlug}`, 'Timeline');
          updateData.googleDriveFolderId = folderId;
        }

        for (const file of newMediaFiles) {
          try {
            const driveRes = await uploadToFolder(folderId, file.name, file.type, file.base64);
            currentMedia.push({
              googleDriveId: driveRes.fileId,
              fileName: file.name,
              mimeType: file.type,
              viewUrl: driveRes.viewUrl,
              thumbnailUrl: driveRes.thumbnailUrl,
              previewUrl: driveRes.previewUrl,
              streamUrl: driveRes.streamUrl
            });
          } catch (driveErr: any) {
            context.error(`Failed to upload new file "${file.name}" to GDrive:`, driveErr.message);
          }
        }
      }

      updateData.media = currentMedia;

      // Update in MongoDB
      await col.updateOne({ _id: new ObjectId(idParam) }, { $set: updateData });
      const updatedPost = await col.findOne({ _id: new ObjectId(idParam) });

      // Update post.json in Google Drive to keep it in sync
      const targetFolderId = updateData.googleDriveFolderId || post.googleDriveFolderId;
      if (targetFolderId) {
        try {
          const files = await getFilesInFolder(targetFolderId);
          const jsonFile = files.find(f => f.name.toLowerCase() === 'post.json');
          
          const updatedPayload = {
            title: updateData.title !== undefined ? updateData.title : post.title,
            content: updateData.content !== undefined ? updateData.content : post.content,
            category: updateData.category !== undefined ? updateData.category : post.category,
            tags: updateData.tags !== undefined ? updateData.tags : post.tags,
            timestamp: updateData.timestamp !== undefined ? updateData.timestamp.toISOString() : new Date(post.timestamp).toISOString(),
            clearanceLevel: updateData.clearanceLevel !== undefined ? updateData.clearanceLevel : (post.clearanceLevel || 0),
            clearanceTier: updateData.clearanceTier !== undefined ? updateData.clearanceTier : (post.clearanceTier || 'prakata')
          };

          const metadataBase64 = Buffer.from(JSON.stringify(updatedPayload, null, 2)).toString('base64');
          
          if (jsonFile) {
            await deleteFolderFromDrive(jsonFile.id);
          }
          await uploadToFolder(targetFolderId, 'post.json', 'application/json', metadataBase64);
        } catch (syncErr: any) {
          context.error('Failed to sync post.json file update in Google Drive:', syncErr.message);
        }
      }

      return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true, post: updatedPost } };
    }

    // ── 7. DELETE /api/timeline/{id} (Delete post + delete folder recursively) ──
    if (method === 'DELETE' && idParam && ObjectId.isValid(idParam)) {
      const post = await col.findOne({ _id: new ObjectId(idParam) });
      if (!post || parseClearanceLevel(post.clearanceLevel) > activeClearance) {
        return { status: 404, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Post not found.' } };
      }

      // Delete the entire subdirectory in Google Drive (recursively deletes all containing files)
      if (post.googleDriveFolderId) {
        try {
          await deleteFolderFromDrive(post.googleDriveFolderId);
        } catch (delErr: any) {
          context.warn(`Failed to delete Google Drive folder ${post.googleDriveFolderId}:`, delErr.message);
        }
      }
      if (Array.isArray(post.media)) {
        for (const item of post.media) {
          if (item.googleDriveId) {
            try {
              await deleteFolderFromDrive(item.googleDriveId);
            } catch (delMediaErr: any) {
              context.warn(`Failed to delete media file ${item.googleDriveId}:`, delMediaErr.message);
            }
          }
        }
      }

      await col.deleteOne({ _id: new ObjectId(idParam) });
      return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true } };
    }

    return { status: 405, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Timeline handler error:', err);
    await logAppError('timeline', err, {
      method,
      url: request.url,
      pathParts
    });
    return { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }, 
      jsonBody: { 
        error: 'Internal server error.', 
        details: err?.message || String(err),
        stack: err?.stack || undefined
      } 
    };
  }
}

app.http('timeline', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'timeline/{*subpath}',
  handler: timelineHandler
});
