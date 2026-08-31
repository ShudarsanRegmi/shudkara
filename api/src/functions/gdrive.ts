import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
// Handle newlines in private key securely
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

export async function uploadToDrive(
  fileName: string,
  mimeType: string,
  base64Data: string
): Promise<{ fileId: string; viewUrl: string; thumbnailUrl: string }> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  // Convert base64 to readable stream
  const base64Content = base64Data.split(';base64,').pop() || base64Data;
  const buffer = Buffer.from(base64Content, 'base64');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const fileMetadata: any = {
    name: fileName,
  };

  if (FOLDER_ID) {
    fileMetadata.parents = [FOLDER_ID];
  }

  const media = {
    mimeType: mimeType,
    body: stream,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink, webContentLink, thumbnailLink',
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new Error('Failed to retrieve file ID after Google Drive upload.');
  }

  // Set permission to anyone with link can view (reader)
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
  } catch (err: any) {
    console.error('Failed to set public view permission on Google Drive file:', err);
  }

  // Construct direct hot-link url for direct embedding in <img> and <video> tags
  // docs.google.com/uc is standard, but lh3.googleusercontent.com/d/FILE_ID is cleaner and avoids rate limits
  const viewUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
  const thumbnailUrl = response.data.thumbnailLink || viewUrl;

  return {
    fileId,
    viewUrl,
    thumbnailUrl,
  };
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  try {
    await drive.files.delete({ fileId });
  } catch (err: any) {
    console.error(`Failed to delete Google Drive file ${fileId}:`, err.message);
  }
}
