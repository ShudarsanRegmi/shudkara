import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';

interface TemporaryImage {
  id: string;
  dataUrl: string; // Base64 representation of the image
  filename: string;
  createdAt: number;
}

// In-memory cache for temporary server storage (wipes on container recycle, which is fine for temp share)
const imgDropCache = new Map<string, TemporaryImage>();

// Keep memory clean by removing images older than 30 minutes
function cleanupCache() {
  const EXPIRY = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();
  for (const [id, img] of imgDropCache.entries()) {
    if (now - img.createdAt > EXPIRY) {
      imgDropCache.delete(id);
    }
  }
}

export async function imgDropHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const imageId = request.params.id;

  cleanupCache();

  try {
    // 1. GET - Fetch metadata list OR specific image data
    if (method === 'GET') {
      if (imageId) {
        const img = imgDropCache.get(imageId);
        if (!img) {
          return { status: 404, jsonBody: { error: 'Image not found or expired.' } };
        }
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: img
        };
      }

      // Return metadata list only (exclude heavy base64 dataUrl for fast load)
      const list = Array.from(imgDropCache.values()).map(img => ({
        id: img.id,
        filename: img.filename,
        createdAt: img.createdAt
      })).sort((a, b) => b.createdAt - a.createdAt);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: list
      };
    }

    // 2. POST - Upload image
    if (method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const { dataUrl, filename } = body;
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        return { status: 400, jsonBody: { error: 'Valid Base64 image dataUrl is required.' } };
      }

      const id = crypto.randomBytes(4).toString('hex'); // Short readable ID e.g. "a1c5b3d2"
      const newImg: TemporaryImage = {
        id,
        dataUrl,
        filename: filename || `capture_${id}.png`,
        createdAt: Date.now()
      };

      imgDropCache.set(id, newImg);

      return {
        status: 201,
        jsonBody: { success: true, id, filename: newImg.filename, message: 'Image uploaded to temp server memory.' }
      };
    }

    // 3. DELETE - Delete image
    if (method === 'DELETE') {
      if (!imageId) {
        return { status: 400, jsonBody: { error: 'Image ID is required.' } };
      }

      const exists = imgDropCache.delete(imageId);
      if (!exists) {
        return { status: 404, jsonBody: { error: 'Image not found or already expired.' } };
      }

      return {
        status: 200,
        jsonBody: { success: true, message: 'Image deleted from temp memory.' }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('ImgDrop handler error:', err);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error.', details: err.message }
    };
  }
}

app.http('imgdrop', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'imgdrop/{id?}',
  handler: imgDropHandler
});
