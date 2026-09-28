import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { connectToMongo, verifySession, extractToken } from './db';

export interface SavedPostItem {
  id: string;
  url: string;
  title: string;
  description?: string;
  collection: string; // e.g. 'Inbox', 'Tech', 'Design', 'Inspiration', 'Read Later'
  tags: string[];
  platform: { key: string; name: string; icon: string };
  domain: string;
  thumbnail?: string;
  favicon?: string;
  isPinned?: boolean;
  isPrivate?: boolean;
  createdAt: string;
  updatedAt?: string;
}

function detectPlatform(urlStr: string): { key: string; name: string; icon: string } {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('twitter.com') || host.includes('x.com')) return { key: 'twitter', name: 'Twitter / X', icon: 'Twitter' };
    if (host.includes('reddit.com')) return { key: 'reddit', name: 'Reddit', icon: 'MessageSquare' };
    if (host.includes('youtube.com') || host.includes('youtu.be')) return { key: 'youtube', name: 'YouTube', icon: 'Youtube' };
    if (host.includes('github.com')) return { key: 'github', name: 'GitHub', icon: 'Github' };
    if (host.includes('linkedin.com')) return { key: 'linkedin', name: 'LinkedIn', icon: 'Linkedin' };
    if (host.includes('instagram.com')) return { key: 'instagram', name: 'Instagram', icon: 'Instagram' };
    if (host.includes('medium.com')) return { key: 'medium', name: 'Medium', icon: 'BookOpen' };
    if (host.includes('dev.to')) return { key: 'devto', name: 'Dev.to', icon: 'Code' };
    if (host.includes('tiktok.com')) return { key: 'tiktok', name: 'TikTok', icon: 'Video' };
    if (host.includes('ycombinator.com')) return { key: 'hackernews', name: 'Hacker News', icon: 'Terminal' };
    return { key: 'web', name: parsed.hostname.replace('www.', ''), icon: 'Globe' };
  } catch {
    return { key: 'web', name: 'Web Link', icon: 'Globe' };
  }
}

async function scrapeUrlMetadata(urlStr: string) {
  const platform = detectPlatform(urlStr);
  let domain = '';
  try {
    domain = new URL(urlStr).hostname.replace('www.', '');
  } catch {
    domain = 'web';
  }
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  let title = '';
  let description = '';
  let thumbnail = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();

      // Extract title: og:title -> <title>
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogTitleMatch && ogTitleMatch[1]) {
        title = ogTitleMatch[1].trim();
      } else {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
        }
      }

      // Extract description: og:description -> meta name="description"
      const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i) ||
                          html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (ogDescMatch && ogDescMatch[1]) {
        description = ogDescMatch[1].trim();
      }

      // Extract thumbnail: og:image -> twitter:image
      const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
                         html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
      if (ogImgMatch && ogImgMatch[1]) {
        thumbnail = ogImgMatch[1].trim();
        if (thumbnail.startsWith('//')) thumbnail = `https:${thumbnail}`;
        else if (thumbnail.startsWith('/')) {
          try {
            const origin = new URL(urlStr).origin;
            thumbnail = `${origin}${thumbnail}`;
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('[SavePost] Metadata scrape timed out or failed:', err);
  }

  // Fallbacks HTML entity cleanups
  title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  description = description.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

  return {
    url: urlStr,
    title: title || domain || 'Saved Link',
    description,
    thumbnail,
    favicon,
    domain,
    platform
  };
}

export async function savePostHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const path = new URL(request.url).pathname;
  const itemId = request.params.id;

  try {
    const db = await connectToMongo();
    const col = db.collection('savepost');
    const settingsCol = db.collection('userSettings');

    const token = extractToken(request);
    const isAuthorized = await verifySession(token);

    // ── 1. POST /api/savepost/fetch-metadata — Standalone Link Scraper ────────
    if (path.endsWith('/fetch-metadata') || itemId === 'fetch-metadata') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const url = body.url;
      if (!url || typeof url !== 'string') {
        return { status: 400, jsonBody: { error: 'URL is required.' } };
      }

      const scraped = await scrapeUrlMetadata(url.trim());
      return { status: 200, jsonBody: scraped };
    }

    // ── 2. GET - Fetch saved posts & section privacy ─────────────────────────
    if (method === 'GET') {
      const singleId = itemId || new URL(request.url).searchParams.get('id');
      if (singleId && singleId !== 'privacy') {
        const item = await col.findOne({ id: singleId });
        if (!item) return { status: 404, jsonBody: { error: 'Post not found.' } };
        if (item.isPrivate && !isAuthorized) {
          return { status: 401, jsonBody: { error: 'Unauthorized.' } };
        }
        const { _id, ...rest } = item;
        return { status: 200, jsonBody: rest };
      }

      const posts = await col.find({}).sort({ isPinned: -1, createdAt: -1 }).toArray();
      const privacyDoc = await settingsCol.findOne({ key: 'savePostBoardPrivate' });
      const isBoardPrivate = privacyDoc ? !!privacyDoc.value : false;

      const visible = isAuthorized
        ? posts
        : (isBoardPrivate ? [] : posts.filter(p => !p.isPrivate));

      const cleaned = visible.map(p => {
        const { _id, ...rest } = p;
        return rest;
      });

      return { status: 200, jsonBody: { posts: cleaned, isBoardPrivate } };
    }

    // ── 3. POST /api/savepost/privacy — Toggle Section Privacy ───────────────
    if (itemId === 'privacy' || path.endsWith('/privacy')) {
      if (!isAuthorized) return { status: 401, jsonBody: { error: 'Unauthorized.' } };
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const isBoardPrivate = !!body.isBoardPrivate;
      await settingsCol.updateOne(
        { key: 'savePostBoardPrivate' },
        { $set: { key: 'savePostBoardPrivate', value: isBoardPrivate } },
        { upsert: true }
      );
      return { status: 200, jsonBody: { success: true, isBoardPrivate } };
    }

    // ── 4. POST - Create new saved post ───────────────────────────────────────
    if (method === 'POST') {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const { url, title, description, collection, tags, isPinned, isPrivate, thumbnail } = body;
      if (!url || typeof url !== 'string' || !url.trim()) {
        return { status: 400, jsonBody: { error: 'URL is required.' } };
      }

      if (isPrivate && !isAuthorized) {
        return { status: 401, jsonBody: { error: 'Unauthorized. Login required for private posts.' } };
      }

      const cleanUrl = url.trim();
      let scrapedTitle = title ? title.trim() : '';
      let scrapedDesc = description ? description.trim() : '';
      let scrapedThumb = thumbnail || '';
      let scrapedFavicon = '';
      let domain = '';
      let platform = detectPlatform(cleanUrl);

      // Auto-scrape metadata if title or thumbnail is missing
      if (!scrapedTitle || !scrapedThumb) {
        const meta = await scrapeUrlMetadata(cleanUrl);
        if (!scrapedTitle) scrapedTitle = meta.title;
        if (!scrapedDesc) scrapedDesc = meta.description;
        if (!scrapedThumb) scrapedThumb = meta.thumbnail;
        scrapedFavicon = meta.favicon;
        domain = meta.domain;
        platform = meta.platform;
      } else {
        try { domain = new URL(cleanUrl).hostname.replace('www.', ''); } catch { domain = 'web'; }
        scrapedFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      }

      const cleanTags = Array.isArray(tags) 
        ? tags.map((t: string) => t.trim().replace(/^#/, '')).filter(Boolean) 
        : [];

      const id = body.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));

      const newItem = {
        id,
        url: cleanUrl,
        title: scrapedTitle || cleanUrl,
        description: scrapedDesc,
        collection: collection || 'Inbox',
        tags: cleanTags,
        platform,
        domain,
        thumbnail: scrapedThumb,
        favicon: scrapedFavicon,
        isPinned: !!isPinned,
        isPrivate: !!isPrivate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await col.insertOne(newItem);
      const { _id, ...rest } = newItem as any;
      return { status: 201, jsonBody: rest };
    }

    // Auth required for edit and delete
    if (!isAuthorized) {
      return { status: 401, jsonBody: { error: 'Unauthorized.' } };
    }

    // ── 5. PUT - Update saved post ───────────────────────────────────────────
    if (method === 'PUT' && itemId) {
      let body: any;
      try { body = await request.json(); }
      catch { return { status: 400, jsonBody: { error: 'Invalid JSON.' } }; }

      const existing = await col.findOne({ id: itemId });
      if (!existing) return { status: 404, jsonBody: { error: 'Item not found.' } };

      const updateFields: any = { updatedAt: new Date().toISOString() };
      if (body.title !== undefined) updateFields.title = body.title.trim();
      if (body.description !== undefined) updateFields.description = body.description.trim();
      if (body.collection !== undefined) updateFields.collection = body.collection;
      if (body.thumbnail !== undefined) updateFields.thumbnail = body.thumbnail;
      if (body.isPinned !== undefined) updateFields.isPinned = !!body.isPinned;
      if (body.isPrivate !== undefined) updateFields.isPrivate = !!body.isPrivate;
      if (Array.isArray(body.tags)) {
        updateFields.tags = body.tags.map((t: string) => t.trim().replace(/^#/, '')).filter(Boolean);
      }

      if (body.url && body.url.trim() !== existing.url) {
        updateFields.url = body.url.trim();
        const meta = await scrapeUrlMetadata(body.url.trim());
        updateFields.platform = meta.platform;
        updateFields.domain = meta.domain;
        updateFields.favicon = meta.favicon;
        if (!body.title) updateFields.title = meta.title;
        if (!body.thumbnail) updateFields.thumbnail = meta.thumbnail;
      }

      await col.updateOne({ id: itemId }, { $set: updateFields });
      const updated = await col.findOne({ id: itemId });
      const { _id, ...rest } = updated!;
      return { status: 200, jsonBody: rest };
    }

    // ── 6. DELETE - Remove saved post ────────────────────────────────────────
    if (method === 'DELETE' && itemId) {
      const res = await col.deleteOne({ id: itemId });
      if (res.deletedCount === 0) return { status: 404, jsonBody: { error: 'Item not found.' } };
      return { status: 200, jsonBody: { success: true, id: itemId } };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('SavePost handler error:', err);
    return { status: 500, jsonBody: { error: 'Internal server error.', details: err.message } };
  }
}

app.http('savepost', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'savepost/{*id}',
  handler: savePostHandler
});
