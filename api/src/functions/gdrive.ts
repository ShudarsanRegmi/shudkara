import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const PRIVATE_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function getAuthClient() {
  if (!CLIENT_EMAIL || !PRIVATE_KEY) {
    throw new Error('Google Service Account credentials are not fully configured in env.');
  }
  return new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
}

// ── 1. Create a subfolder for a post ──
export async function createFolderInDrive(folderName: string): Promise<string> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: FOLDER_ID ? [FOLDER_ID] : []
  };

  const folder = await drive.files.create({
    requestBody: fileMetadata,
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

// ── 3. List all subfolders in the root folder ──
export async function listSubFolders(): Promise<{ id: string; name: string }[]> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const query = FOLDER_ID 
    ? `'${FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    pageSize: 100
  });

  return (res.data.files || []).map(f => ({ id: f.id!, name: f.name! }));
}

// ── 4. Get all files in a specific folder ──
export async function getFilesInFolder(folderId: string): Promise<{ id: string; name: string; mimeType: string }[]> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
    pageSize: 100
  });

  return (res.data.files || []).map(f => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!
  }));
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
