import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ObjectId } from 'mongodb';
import { connectToMongo, verifySession, extractToken } from './db';
import { uploadToDrive, deleteFromDrive } from './gdrive';

export async function timelineHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const path = new URL(request.url).pathname;
  
  // Extract id from /api/timeline/{id}
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1];
  const idParam = lastPart && lastPart !== 'timeline' && lastPart !== 'tags' ? lastPart : null;

  try {
    const db = await connectToMongo();
    const col = db.collection('timeline');

    // ── Authentication Check ──
    const token = extractToken(request);
    const isAuthorized = await verifySession(token);
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized.' } };
    }

    // ── 1. GET /api/timeline/tags (Aggregate all tags and categories) ──
    if (method === 'GET' && path.endsWith('/timeline/tags')) {
      const categories = await col.distinct('category');
      const tags = await col.distinct('tags');
      return {
        status: 200,
        jsonBody: {
          categories: categories.filter(Boolean),
          tags: tags.filter(Boolean)
        }
      };
    }

    // ── 2. GET /api/timeline (Get feed posts, with filters) ──
    if (method === 'GET' && !idParam) {
      const category = request.query.get('category');
      const tag = request.query.get('tag');
      const search = request.query.get('search');
      
      const limit = parseInt(request.query.get('limit') || '20', 10);
      const skip = parseInt(request.query.get('skip') || '0', 10);

      const filter: any = {};
      if (category) filter.category = category;
      if (tag) filter.tags = tag;
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } }
        ];
      }

      const posts = await col.find(filter)
        .sort({ timestamp: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await col.countDocuments(filter);

      return {
        status: 200,
        jsonBody: { posts, total }
      };
    }

    // ── 3. POST /api/timeline (Create entry + upload media to GDrive) ──
    if (method === 'POST') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON body.' } }; }

      const { title, content, timestamp, category, tags, mediaFiles } = body;
      
      if (!content?.trim()) {
        return { status: 400, jsonBody: { error: 'Content is required.' } };
      }

      // Process uploaded media files if any (mediaFiles = array of { name, type, base64 })
      const uploadedMedia: any[] = [];
      if (mediaFiles && Array.isArray(mediaFiles)) {
        for (const file of mediaFiles) {
          try {
            const driveRes = await uploadToDrive(file.name, file.type, file.base64);
            uploadedMedia.push({
              googleDriveId: driveRes.fileId,
              fileName: file.name,
              mimeType: file.type,
              viewUrl: driveRes.viewUrl,
              thumbnailUrl: driveRes.thumbnailUrl
            });
          } catch (driveErr: any) {
            context.error('Failed to upload attachment to Google Drive:', driveErr);
            return {
              status: 502,
              jsonBody: { error: `Failed to upload "${file.name}" to Google Drive. Check server credentials.` }
            };
          }
        }
      }

      const newPost = {
        title: (title || '').trim(),
        content: content.trim(),
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        createdAt: new Date(),
        category: (category || 'General').trim(),
        tags: Array.isArray(tags) ? tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [],
        media: uploadedMedia
      };

      const result = await col.insertOne(newPost);
      return {
        status: 201,
        jsonBody: { success: true, postId: result.insertedId, post: newPost }
      };
    }

    // ── 4. PUT /api/timeline/{id} (Update entry) ──
    if (method === 'PUT' && idParam) {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON body.' } }; }

      const { title, content, timestamp, category, tags } = body;
      
      const updateData: any = {};
      if (title !== undefined) updateData.title = (title || '').trim();
      if (content !== undefined) updateData.content = content.trim();
      if (timestamp !== undefined) updateData.timestamp = new Date(timestamp);
      if (category !== undefined) updateData.category = (category || 'General').trim();
      if (tags !== undefined && Array.isArray(tags)) {
        updateData.tags = tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean);
      }

      const result = await col.updateOne(
        { _id: new ObjectId(idParam) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return { status: 404, jsonBody: { error: 'Post not found.' } };
      }

      return { status: 200, jsonBody: { success: true } };
    }

    // ── 5. DELETE /api/timeline/{id} (Delete post + delete from GDrive) ──
    if (method === 'DELETE' && idParam) {
      const post = await col.findOne({ _id: new ObjectId(idParam) });
      if (!post) {
        return { status: 404, jsonBody: { error: 'Post not found.' } };
      }

      // Delete associated attachments from Google Drive
      if (post.media && Array.isArray(post.media)) {
        for (const item of post.media) {
          if (item.googleDriveId) {
            await deleteFromDrive(item.googleDriveId);
          }
        }
      }

      await col.deleteOne({ _id: new ObjectId(idParam) });
      return { status: 200, jsonBody: { success: true } };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Timeline handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('timeline', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'timeline/{id?}',
  handler: timelineHandler
});
