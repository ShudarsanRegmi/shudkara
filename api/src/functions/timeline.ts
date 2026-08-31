import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ObjectId } from 'mongodb';
import { connectToMongo, verifySession, extractToken } from './db';
import { 
  createFolderInDrive, uploadToFolder, listSubFolders, 
  getFilesInFolder, getFileContent, ensureFilePublic, deleteFolderFromDrive 
} from './gdrive';

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
  const path = new URL(request.url).pathname;
  
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1];
  const idParam = lastPart && lastPart !== 'timeline' && lastPart !== 'tags' && lastPart !== 'sync-drive' ? lastPart : null;

  try {
    const db = await connectToMongo();
    const col = db.collection('timeline');

    // ── Authentication Check ──
    const token = extractToken(request);
    const isAuthorized = await verifySession(token);
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized.' } };
    }

    // ── 1. POST /api/timeline/sync-drive (Scan Google Drive for offline folders) ──
    if (method === 'POST' && path.endsWith('/timeline/sync-drive')) {
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
          timestamp: new Date()
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
              timestamp: parsed.timestamp ? new Date(parsed.timestamp) : new Date()
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
            mediaItems.push({
              googleDriveId: file.id,
              fileName: file.name,
              mimeType: file.mimeType,
              viewUrl: publicRes.viewUrl,
              thumbnailUrl: publicRes.thumbnailUrl
            });
          } catch (fileErr: any) {
            context.error(`Failed to set permission on file ${file.name}:`, fileErr.message);
          }
        }

        // Insert post document
        const newPost = {
          title: metadata.title.trim(),
          content: metadata.content.trim(),
          timestamp: metadata.timestamp,
          createdAt: new Date(),
          category: metadata.category.trim(),
          tags: metadata.tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean),
          googleDriveFolderId: folder.id,
          media: mediaItems
        };

        await col.insertOne(newPost);
        importedCount++;
      }

      return {
        status: 200,
        jsonBody: { success: true, message: `Sync complete. Imported ${importedCount} new memories.` }
      };
    }

    // ── 2. GET /api/timeline/tags (Aggregate all tags and categories) ──
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

    // ── 3. GET /api/timeline (Get feed posts, with filters) ──
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

    // ── 4. POST /api/timeline (Create entry + create folder + upload to GDrive) ──
    if (method === 'POST') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON body.' } }; }

      const { title, content, timestamp, category, tags, mediaFiles } = body;
      
      if (!content?.trim()) {
        return { status: 400, jsonBody: { error: 'Content is required.' } };
      }

      const postDate = timestamp ? new Date(timestamp) : new Date();
      const datePrefix = postDate.toISOString().substring(0, 10);
      const folderSlug = title ? slugify(title) : 'moment';
      const folderName = `${datePrefix}-${folderSlug}`;

      // A. Create the folder in Google Drive
      let folderId = '';
      try {
        folderId = await createFolderInDrive(folderName);
      } catch (folderErr: any) {
        context.error('Failed to create Google Drive folder:', folderErr);
        return { status: 502, jsonBody: { error: 'Failed to create directory in Google Drive. Check credentials.' } };
      }

      // B. Create the post.json metadata file inside the new folder
      const metadataPayload = {
        title: (title || '').trim(),
        content: content.trim(),
        category: (category || 'General').trim(),
        tags: Array.isArray(tags) ? tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [],
        timestamp: postDate.toISOString()
      };
      
      try {
        const metadataBase64 = Buffer.from(JSON.stringify(metadataPayload, null, 2)).toString('base64');
        await uploadToFolder(folderId, 'post.json', 'application/json', metadataBase64);
      } catch (metaErr: any) {
        context.error('Failed to upload post.json description to GDrive folder:', metaErr);
      }

      // C. Process uploaded media files if any inside that folder
      const uploadedMedia: any[] = [];
      if (mediaFiles && Array.isArray(mediaFiles)) {
        for (const file of mediaFiles) {
          try {
            const driveRes = await uploadToFolder(folderId, file.name, file.type, file.base64);
            uploadedMedia.push({
              googleDriveId: driveRes.fileId,
              fileName: file.name,
              mimeType: file.type,
              viewUrl: driveRes.viewUrl,
              thumbnailUrl: driveRes.thumbnailUrl
            });
          } catch (driveErr: any) {
            context.error(`Failed to upload file "${file.name}" to folder:`, driveErr);
            return {
              status: 502,
              jsonBody: { error: `Failed to upload "${file.name}" inside directory. Check Google Drive credentials.` }
            };
          }
        }
      }

      const newPost = {
        title: metadataPayload.title,
        content: metadataPayload.content,
        timestamp: postDate,
        createdAt: new Date(),
        category: metadataPayload.category,
        tags: metadataPayload.tags,
        googleDriveFolderId: folderId,
        media: uploadedMedia
      };

      const result = await col.insertOne(newPost);
      return {
        status: 201,
        jsonBody: { success: true, postId: result.insertedId, post: newPost }
      };
    }

    // ── 5. PUT /api/timeline/{id} (Update entry metadata) ──
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

      const post = await col.findOne({ _id: new ObjectId(idParam) });
      if (!post) {
        return { status: 404, jsonBody: { error: 'Post not found.' } };
      }

      // Update in MongoDB
      await col.updateOne({ _id: new ObjectId(idParam) }, { $set: updateData });

      // Update post.json in Google Drive to keep it in sync
      if (post.googleDriveFolderId) {
        try {
          const files = await getFilesInFolder(post.googleDriveFolderId);
          const jsonFile = files.find(f => f.name.toLowerCase() === 'post.json');
          
          const updatedPayload = {
            title: updateData.title !== undefined ? updateData.title : post.title,
            content: updateData.content !== undefined ? updateData.content : post.content,
            category: updateData.category !== undefined ? updateData.category : post.category,
            tags: updateData.tags !== undefined ? updateData.tags : post.tags,
            timestamp: updateData.timestamp !== undefined ? updateData.timestamp.toISOString() : new Date(post.timestamp).toISOString()
          };

          const metadataBase64 = Buffer.from(JSON.stringify(updatedPayload, null, 2)).toString('base64');
          
          // Delete old post.json if it exists, and write new one
          if (jsonFile) {
            await deleteFolderFromDrive(jsonFile.id); // deletes the file by id
          }
          await uploadToFolder(post.googleDriveFolderId, 'post.json', 'application/json', metadataBase64);
        } catch (syncErr: any) {
          context.error('Failed to sync post.json file update in Google Drive:', syncErr.message);
        }
      }

      return { status: 200, jsonBody: { success: true } };
    }

    // ── 6. DELETE /api/timeline/{id} (Delete post + delete folder recursively) ──
    if (method === 'DELETE' && idParam) {
      const post = await col.findOne({ _id: new ObjectId(idParam) });
      if (!post) {
        return { status: 404, jsonBody: { error: 'Post not found.' } };
      }

      // Delete the entire subdirectory in Google Drive (recursively deletes all containing files)
      if (post.googleDriveFolderId) {
        await deleteFolderFromDrive(post.googleDriveFolderId);
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
