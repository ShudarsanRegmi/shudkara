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
export async function executeDriveAction<T>(actionFn: (drive: any) => Promise<T>): Promise<T> {
  const primaryAuth = getAuthClient(false);
  const primaryDrive = google.drive({ version: 'v3', auth: primaryAuth });
  try {
    return await actionFn(primaryDrive);
  } catch (err: any) {
    if (err.message?.includes('invalid_grant') || err.message?.includes('Token has been expired') || err.response?.data?.error === 'invalid_grant') {
      console.warn('[GDrive] OAuth Refresh Token expired (invalid_grant). Retrying with Service Account fallback...');
      const fallbackAuth = getServiceAccountAuthClient();
      const fallbackDrive = google.drive({ version: 'v3', auth: fallbackAuth });
      return await actionFn(fallbackDrive);
    }
    throw err;
  }
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
  return executeDriveAction(async (drive) => {
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
  });
}

// ── 2. Upload file to a specific folder ──
export async function uploadToFolder(
  folderId: string,
  fileName: string,
  mimeType: string,
  base64Data: string
): Promise<{ fileId: string; viewUrl: string; thumbnailUrl: string }> {
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
  });
}

// ── 3. List all subfolders in the root or parent folder ──
export async function listSubFolders(): Promise<{ id: string; name: string }[]> {
  return executeDriveAction(async (drive) => {
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
