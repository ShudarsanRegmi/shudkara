import { google } from 'googleapis';
import { Readable } from 'stream';

export function getFolderId(): string {
  return process.env.GOOGLE_DRIVE_FOLDER_ID || '';
}

export function getServiceAccountAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
  const privateKey = rawKey.replace(/\\n/g, '\n').replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Google Service Account credentials are not fully configured in env.');
  }
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
}

export function getAuthClient(useServiceAccount = false) {
  if (useServiceAccount) {
    return getServiceAccountAuthClient();
  }

  // Option 1: OAuth2 User Delegation (Uses User's Personal Google Drive Storage Quota)
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';

  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    return oauth2Client;
  }

  // Option 2: Service Account JWT (Fallback)
  return getServiceAccountAuthClient();
}

/**
 * Executes a Drive API call using OAuth2 primary credentials, with automatic Service Account retry fallback if invalid_grant occurs.
 */
export async function executeDriveAction<T>(actionFn: (drive: any, auth: any) => Promise<T>): Promise<T> {
  const primaryAuth = getAuthClient(false);
  const primaryDrive = google.drive({ version: 'v3', auth: primaryAuth });
  try {
    return await actionFn(primaryDrive, primaryAuth);
  } catch (err: any) {
    if (err.message?.includes('invalid_grant') || err.message?.includes('Token has been expired') || err.response?.data?.error === 'invalid_grant') {
      console.warn('[GDrive] OAuth Refresh Token expired (invalid_grant). Retrying with Service Account fallback...');
      const fallbackAuth = getServiceAccountAuthClient();
      const fallbackDrive = google.drive({ version: 'v3', auth: fallbackAuth });
      return await actionFn(fallbackDrive, fallbackAuth);
    }
    throw err;
  }
}

// ── Bucket Architecture: StorageBuckets / ShudkaraBucket / <Subapp> ──
export type SubappBucketName = 'Timeline' | 'Streaks' | 'Inventory' | 'Pastebin';

export interface BucketRegistry {
  storageBucketsId: string;
  shudkaraBucketId: string;
  subapps: Record<SubappBucketName, string>;
}

let cachedBucketRegistry: BucketRegistry | null = null;

export async function ensureShudkaraBucketHierarchy(drive: any): Promise<BucketRegistry> {
  if (cachedBucketRegistry) {
    return cachedBucketRegistry;
  }

  // 1. Try reading from MongoDB active_buckets cache
  try {
    const { connectToMongo } = await import('./db');
    const db = await connectToMongo();
    const doc: any = await db.collection('gdrive_buckets').findOne({ _id: 'active_buckets' as any });
    if (doc && doc.storageBucketsId && doc.shudkaraBucketId && doc.subapps?.Timeline) {
      cachedBucketRegistry = {
        storageBucketsId: doc.storageBucketsId,
        shudkaraBucketId: doc.shudkaraBucketId,
        subapps: doc.subapps
      };
      return cachedBucketRegistry;
    }
  } catch (e) {
    // MongoDB unavailable or offline, proceed to Drive discovery
  }

  // 2. Discover or create in Google Drive
  // A. StorageBuckets in root
  let storageBucketsId = '';
  const sbRes = await drive.files.list({
    q: "'root' in parents and name = 'StorageBuckets' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  if (sbRes.data.files && sbRes.data.files.length > 0) {
    storageBucketsId = sbRes.data.files[0].id!;
  } else {
    const created = await drive.files.create({
      requestBody: { name: 'StorageBuckets', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] },
      supportsAllDrives: true,
      fields: 'id'
    });
    storageBucketsId = created.data.id!;
  }

  // B. ShudkaraBucket inside StorageBuckets
  let shudkaraBucketId = '';
  const shRes = await drive.files.list({
    q: `'${storageBucketsId}' in parents and name = 'ShudkaraBucket' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  if (shRes.data.files && shRes.data.files.length > 0) {
    shudkaraBucketId = shRes.data.files[0].id!;
  } else {
    const created = await drive.files.create({
      requestBody: { name: 'ShudkaraBucket', mimeType: 'application/vnd.google-apps.folder', parents: [storageBucketsId] },
      supportsAllDrives: true,
      fields: 'id'
    });
    shudkaraBucketId = created.data.id!;
  }

  // C. Subapps inside ShudkaraBucket
  const subapps: SubappBucketName[] = ['Timeline', 'Streaks', 'Inventory', 'Pastebin'];
  const subappMap: Record<string, string> = {};

  for (const sub of subapps) {
    const subRes = await drive.files.list({
      q: `'${shudkaraBucketId}' in parents and name = '${sub}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    if (subRes.data.files && subRes.data.files.length > 0) {
      subappMap[sub] = subRes.data.files[0].id!;
    } else {
      const created = await drive.files.create({
        requestBody: { name: sub, mimeType: 'application/vnd.google-apps.folder', parents: [shudkaraBucketId] },
        supportsAllDrives: true,
        fields: 'id'
      });
      subappMap[sub] = created.data.id!;
    }
  }

  cachedBucketRegistry = {
    storageBucketsId,
    shudkaraBucketId,
    subapps: subappMap as Record<SubappBucketName, string>
  };

  // Persist to MongoDB
  try {
    const { connectToMongo } = await import('./db');
    const db = await connectToMongo();
    await db.collection('gdrive_buckets').updateOne(
      { _id: 'active_buckets' as any },
      { $set: { ...cachedBucketRegistry, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
  } catch (e) {}

  return cachedBucketRegistry;
}

export async function getSubappBucketId(drive: any, subapp: SubappBucketName = 'Timeline'): Promise<string> {
  const registry = await ensureShudkaraBucketHierarchy(drive);
  return registry.subapps[subapp] || registry.shudkaraBucketId;
}

// ── 1. Create a subfolder inside ShudkaraBucket/<subapp>/ ──
export async function createFolderInDrive(folderName: string, subapp: SubappBucketName = 'Timeline'): Promise<string> {
  return executeDriveAction(async (drive) => {
    const parentId = await getSubappBucketId(drive, subapp);
    const fileMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      supportsAllDrives: true,
      fields: 'id'
    });

    if (!folder.data.id) {
      throw new Error(`Failed to create folder ${folderName} inside ${subapp} bucket in Google Drive`);
    }
    return folder.data.id;
  });
}

// ── 2. Upload file to a specific folder ──
export async function uploadToFolder(
  folderId: string,
  fileName: string,
  mimeType: string,
  base64Data: string
): Promise<{ fileId: string; viewUrl: string; thumbnailUrl: string; previewUrl?: string; streamUrl?: string }> {
  if (!base64Data || typeof base64Data !== 'string') {
    throw new Error(`Invalid or empty base64 data for file "${fileName}"`);
  }
  return executeDriveAction(async (drive) => {
    const base64Content = base64Data.split(';base64,').pop() || base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    const media = {
      mimeType: mimeType,
      body: stream
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      supportsAllDrives: true,
      fields: 'id, thumbnailLink, webViewLink, webContentLink'
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error(`Failed to upload ${fileName} to folder ${folderId}`);
    }

    // Set reader permissions for anyone with the link
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: { role: 'reader', type: 'anyone' }
      });
    } catch (err: any) {
      console.error('Failed to set public view permission:', err.message);
    }

    const isVideo = (mimeType || '').startsWith('video/');
    const viewUrl = isVideo 
      ? `https://drive.google.com/uc?export=download&id=${fileId}`
      : `https://lh3.googleusercontent.com/d/${fileId}`;
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    const thumbnailUrl = response.data.thumbnailLink || (isVideo ? previewUrl : viewUrl);

    return { 
      fileId, 
      viewUrl, 
      thumbnailUrl, 
      previewUrl,
      streamUrl: `https://drive.google.com/uc?export=download&id=${fileId}`
    };
  });
}

// ── 2b. Initiate Google Drive Resumable Upload Session ──
export async function initiateResumableSession(
  folderId: string,
  fileName: string,
  mimeType: string,
  totalBytes: number
): Promise<string> {
  return executeDriveAction(async (_drive, auth) => {
    const res = await auth.request({
      url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType || 'application/octet-stream',
        'X-Upload-Content-Length': totalBytes ? totalBytes.toString() : '0'
      },
      data: {
        name: fileName,
        parents: [folderId]
      }
    });

    const location = (
      typeof res.headers?.get === 'function'
        ? res.headers.get('location')
        : (res.headers && (res.headers.location || (res.headers as any).Location))
    ) as string | undefined;
    if (!location) {
      throw new Error(`Google Drive failed to create resumable upload session: missing location header`);
    }
    return location;
  });
}

// ── 2c. Upload a single chunk to Google Drive Resumable Session ──
export async function uploadChunkToSession(
  sessionUrl: string,
  chunkBuffer: Buffer,
  startByte: number,
  endByte: number,
  totalBytes: number,
  mimeType: string
): Promise<{ complete: boolean; fileId?: string; fileData?: any }> {
  const rangeHeader = `bytes ${startByte}-${endByte}/${totalBytes}`;
  const response = await fetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': chunkBuffer.length.toString(),
      'Content-Range': rangeHeader,
      'Content-Type': mimeType || 'application/octet-stream'
    },
    body: new Uint8Array(chunkBuffer)
  });

  if (response.status === 308) {
    // 308 Resume Incomplete: Chunk successfully received by Google Drive
    return { complete: false };
  }

  if (response.status === 200 || response.status === 201) {
    // Last chunk complete!
    const fileData: any = await response.json();
    return { complete: true, fileId: fileData.id, fileData };
  }

  const errText = await response.text().catch(() => '');
  throw new Error(`Google Drive chunk upload failed with HTTP ${response.status}: ${errText}`);
}

// ── 3. List all subfolders in the subapp folder (default: Timeline) ──
export async function listSubFolders(subapp: SubappBucketName = 'Timeline'): Promise<{ id: string; name: string }[]> {
  return executeDriveAction(async (drive) => {
    const parentId = await getSubappBucketId(drive, subapp);
    const query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    return (res.data.files || []).map((f: any) => ({ id: f.id!, name: f.name! }));
  });
}

// ── 4. Get all files in a specific folder ──
export async function getFilesInFolder(folderId: string): Promise<{ id: string; name: string; mimeType: string }[]> {
  return executeDriveAction(async (drive) => {
    try {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      return (res.data.files || []).map((f: any) => ({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!
      }));
    } catch (err: any) {
      console.error(`[GDrive] Error listing files in folder ${folderId}:`, err.message);
      return [];
    }
  });
}

// ── 5. Download file contents as string (specifically for post.json) ──
export async function getFileContent(fileId: string): Promise<string> {
  return executeDriveAction(async (drive) => {
    const res = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    }, { responseType: 'text' });

    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  });
}

// ── 6. Make a file in Drive public and return view details ──
export async function ensureFilePublic(fileId: string): Promise<{ viewUrl: string; thumbnailUrl: string }> {
  return executeDriveAction(async (drive) => {
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: { role: 'reader', type: 'anyone' }
      });
    } catch {}

    const details = await drive.files.get({
      fileId: fileId,
      fields: 'thumbnailLink'
    });

    const viewUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    return {
      viewUrl,
      thumbnailUrl: details.data.thumbnailLink || viewUrl
    };
  });
}

// ── 7. Trash file or folder in Drive (moves to Google Drive Trash) ──
export async function trashFileOrFolderInDrive(fileId: string): Promise<void> {
  if (!fileId) return;
  return executeDriveAction(async (drive) => {
    try {
      await drive.files.update({
        fileId: fileId,
        requestBody: { trashed: true }
      });
      console.log(`[GDrive] Successfully trashed file/folder: ${fileId}`);
    } catch (err: any) {
      console.warn(`[GDrive] Failed to update trashed state for ${fileId}, attempting hard delete fallback:`, err.message);
      try {
        await drive.files.delete({ fileId: fileId });
      } catch (e: any) {
        console.error(`[GDrive] Failed to delete GDrive file/folder ${fileId}:`, e.message);
      }
    }
  });
}

// ── 8. Delete folder recursively ──
export async function deleteFolderFromDrive(folderId: string): Promise<void> {
  return trashFileOrFolderInDrive(folderId);
}
