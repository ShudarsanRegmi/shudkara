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
      if (!post) {
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
        const newPost = {
          title: metadata.title.trim(),
          content: metadata.content.trim(),
          timestamp: metadata.timestamp,
          createdAt: new Date(),
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
      const categories = await col.distinct('category');
      const tags = await col.distinct('tags');
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          categories: categories.filter(Boolean),
          tags: tags.filter(Boolean)
        }
      };
    }

    // ── 3. POST /api/timeline/:id/media (Single file upload directly to post folder) ──
    if (method === 'POST' && pathParts.length === 2 && pathParts[1] === 'media') {
      const postId = pathParts[0];
      if (!ObjectId.isValid(postId)) {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Invalid post ID.' } };
      }

      const post = await col.findOne({ _id: new ObjectId(postId) });
      if (!post) {
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
      if (!folderId) {
        const postDate = new Date(post.timestamp || Date.now());
        const datePrefix = postDate.toISOString().substring(0, 10);
        const folderSlug = post.title ? slugify(post.title) : 'moment';
        folderId = await createFolderInDrive(`${datePrefix}-${folderSlug}`);
        await col.updateOne({ _id: new ObjectId(postId) }, { $set: { googleDriveFolderId: folderId } });
      }

      try {
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
      
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const skip = parseInt(url.searchParams.get('skip') || '0', 10);

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
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { posts, total }
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
        return { status: 502, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Failed to create directory in Google Drive. Check credentials.' } };
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

      // C. Process uploaded media files if passed directly
      const uploadedMedia: any[] = [];
      if (mediaFiles && Array.isArray(mediaFiles) && mediaFiles.length > 0) {
        for (const file of mediaFiles) {
          try {
            const driveRes = await uploadToFolder(folderId, file.name, file.type, file.base64);
            uploadedMedia.push({
              googleDriveId: driveRes.fileId,
              fileName: file.name,
              mimeType: file.type,
              viewUrl: driveRes.viewUrl,
              thumbnailUrl: driveRes.thumbnailUrl,
              previewUrl: driveRes.previewUrl,
              streamUrl: driveRes.streamUrl
            });
          } catch (driveErr: any) {
            context.error(`Failed to upload file "${file.name}" to folder:`, driveErr);
            return {
              status: 502,
              headers: { 'Content-Type': 'application/json' },
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
      if (timestamp !== undefined) updateData.timestamp = new Date(timestamp);
      if (category !== undefined) updateData.category = (category || 'General').trim();
      if (tags !== undefined && Array.isArray(tags)) {
        updateData.tags = tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean);
      }

      const post = await col.findOne({ _id: new ObjectId(idParam) });
      if (!post) {
        return { status: 404, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Post not found.' } };
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
          const postDate = updateData.timestamp || new Date(post.timestamp);
          const datePrefix = postDate.toISOString().substring(0, 10);
          const folderSlug = (updateData.title || post.title) ? slugify(updateData.title || post.title) : 'moment';
          folderId = await createFolderInDrive(`${datePrefix}-${folderSlug}`);
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
            timestamp: updateData.timestamp !== undefined ? updateData.timestamp.toISOString() : new Date(post.timestamp).toISOString()
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
      if (!post) {
        return { status: 404, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Post not found.' } };
      }

      // Delete the entire subdirectory in Google Drive (recursively deletes all containing files)
      if (post.googleDriveFolderId) {
        await deleteFolderFromDrive(post.googleDriveFolderId);
      }
      if (Array.isArray(post.media)) {
        for (const item of post.media) {
          if (item.googleDriveId) {
            await deleteFolderFromDrive(item.googleDriveId);
          }
        }
      }

      await col.deleteOne({ _id: new ObjectId(idParam) });
      return { status: 200, headers: { 'Content-Type': 'application/json' }, jsonBody: { success: true } };
    }

    return { status: 405, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Timeline handler error:', err);
    return { status: 500, headers: { 'Content-Type': 'application/json' }, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('timeline', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'timeline/{*subpath}',
  handler: timelineHandler
});
