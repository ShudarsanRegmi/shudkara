import { google } from 'googleapis';
import { Readable } from 'stream';

export function getFolderId(): string {
  return process.env.GOOGLE_DRIVE_FOLDER_ID || '';
}

export function getAuthClient() {
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
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
  const privateKey = rawKey.replace(/\\n/g, '\n').replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Google OAuth2 credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) or Service Account credentials are not fully configured in env.');
  }
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
}

// Cache valid parent folder ID status in-memory
let cachedValidFolderId: string | null | undefined = undefined;

export async function getValidParentFolderId(drive: any): Promise<string | null> {
  if (cachedValidFolderId !== undefined) {
    return cachedValidFolderId;
  }
  const folderId = getFolderId();
  if (!folderId) {
    cachedValidFolderId = null;
    return null;
  }
  try {
    await drive.files.get({ fileId: folderId, fields: 'id', supportsAllDrives: true });
    cachedValidFolderId = folderId;
    return folderId;
  } catch (err: any) {
    console.warn(`[GDrive] GOOGLE_DRIVE_FOLDER_ID (${folderId}) is not accessible or not shared (${err.message}). Falling back to root drive.`);
    cachedValidFolderId = null;
    return null;
  }
}

// ── 1. Create a subfolder for a post ──
export async function createFolderInDrive(folderName: string): Promise<string> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const parentId = await getValidParentFolderId(drive);
  const fileMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : []
  };

  const folder = await drive.files.create({
    requestBody: fileMetadata,
    supportsAllDrives: true,
    fields: 'id'
  });

  if (!folder.data.id) {
    throw new Error('Failed to create folder in Google Drive');
  }
  return folder.data.id;
}

// ── 2. Upload file to a specific folder ──
export async function uploadToFolder(
  folderId: string,
  fileName: string,
  mimeType: string,
  base64Data: string
): Promise<{ fileId: string; viewUrl: string; thumbnailUrl: string }> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

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
    fields: 'id, thumbnailLink'
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

  const viewUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
  const thumbnailUrl = response.data.thumbnailLink || viewUrl;

  return { fileId, viewUrl, thumbnailUrl };
}

// ── 3. List all subfolders in the root or parent folder ──
export async function listSubFolders(): Promise<{ id: string; name: string }[]> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const parentId = await getValidParentFolderId(drive);
  const query = parentId 
    ? `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  return (res.data.files || []).map(f => ({ id: f.id!, name: f.name! }));
}

// ── 4. Get all files in a specific folder ──
export async function getFilesInFolder(folderId: string): Promise<{ id: string; name: string; mimeType: string }[]> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    return (res.data.files || []).map(f => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!
    }));
  } catch (err: any) {
    console.error(`[GDrive] Error listing files in folder ${folderId}:`, err.message);
    return [];
  }
}

// ── 5. Download file contents as string (specifically for post.json) ──
export async function getFileContent(fileId: string): Promise<string> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.get({
    fileId: fileId,
    alt: 'media'
  }, { responseType: 'text' });

  return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
}

// ── 6. Make a file in Drive public and return view details ──
export async function ensureFilePublic(fileId: string): Promise<{ viewUrl: string; thumbnailUrl: string }> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

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
}

// ── 7. Delete folder recursively ──
export async function deleteFolderFromDrive(folderId: string): Promise<void> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  try {
    await drive.files.delete({ fileId: folderId });
  } catch (err: any) {
    console.error(`Failed to delete GDrive folder ${folderId}:`, err.message);
  }
}
