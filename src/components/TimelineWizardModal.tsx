import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, Upload, Trash2, ArrowRight, ArrowLeft, Check, Sparkles, 
  Calendar, Eye, Image as ImageIcon, Film,
  Clock, AlertCircle, ChevronLeft, ChevronRight,
  Files, FileText, Plus, ChevronDown, GripVertical, Save, RefreshCw, Loader2
} from 'lucide-react';
import { 
  adToBs, bsToAd, BS_MONTHS, getAvailableBsYears, getMonthDays, 
  toNepaliDigits 
} from '../utils/bikramSambat';
import { TimelineCameraModal, type SnappedPhoto } from './TimelineCameraModal';
import { ModernTimeWheelPicker, getCurrentLocalTime24 } from './ModernTimeWheelPicker';
import { RichTagSelector } from './RichTagSelector';
import { TagManagerModal, type TimelineTag } from './TagManagerModal';

export function getLocalIsoString(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function generateVideoThumbnail(videoSource: File | Blob | string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      let objectUrl = '';
      if (typeof videoSource === 'string') {
        video.src = videoSource;
      } else {
        objectUrl = URL.createObjectURL(videoSource);
        video.src = objectUrl;
      }

      let timeoutId: any = null;
      let isDone = false;

      const finish = (result: string) => {
        if (isDone) return;
        isDone = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (objectUrl) {
          try { URL.revokeObjectURL(objectUrl); } catch {}
        }
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        resolve(result);
      };

      timeoutId = setTimeout(() => {
        finish('');
      }, 5000);

      video.onloadeddata = () => {
        const target = Math.min(0.5, (video.duration && video.duration > 0) ? video.duration / 2 : 0.5);
        video.currentTime = target;
      };

      video.onseeked = () => {
        try {
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 360;
          const canvas = document.createElement('canvas');
          const maxDim = 480;
          let scale = 1;
          if (width > maxDim || height > maxDim) {
            scale = maxDim / Math.max(width, height);
          }
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            finish(dataUrl);
            return;
          }
        } catch (e) {
          console.warn('Canvas thumbnail capture error:', e);
        }
        finish('');
      };

      video.onerror = () => {
        finish('');
      };
    } catch {
      resolve('');
    }
  });
}

export interface DraftMediaItem {
  id?: string;
  name: string;
  type: string;
  base64: string;
  rawFile?: File;
  size?: number;
  previewUrl?: string;
  streamUrl?: string;
  viewUrl?: string;
  thumbnailUrl?: string;
  thumbnailBase64?: string;
  googleDriveId?: string;
  uploadStatus?: 'pending' | 'uploading' | 'uploaded' | 'error';
  uploadProgress?: number;
  uploadError?: string;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface TimelineDraftMeta {
  id: string;
  title: string;
  content: string;
  category: string;
  rawTags: string;
  tags?: string[];
  timestamp: string;
  dateMode: 'AD' | 'BS';
  formBsYear: number;
  formBsMonth: number;
  formBsDay: number;
  currentStep: 1 | 2 | 3;
  mediaCount: number;
  mediaFiles?: DraftMediaItem[];
  clearanceLevel?: number;
  clearanceTier?: 'prakata' | 'guhya' | 'nigudha';
  status?: 'draft' | 'queued' | 'syncing' | 'failed' | 'synced';
  syncError?: string;
  updatedAt: number;
  createdAt?: number;
}

interface TimelineWizardModalProps {
  onClose: () => void;
  onSubmit: (postData: {
    draftId: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    timestamp: string;
    clearanceLevel?: number;
    clearanceTier?: 'prakata' | 'guhya' | 'nigudha';
    mediaFiles: DraftMediaItem[];
  }) => void;
  categoriesList?: string[];
  tagsList?: string[];
  tagPool?: TimelineTag[];
  onRefreshTagPool?: () => Promise<void>;
  onOpenTagManager?: () => void;
  initialDraftId?: string;
  authToken?: string | null;
}

export const DRAFTS_LIST_KEY = 'shudkara_timeline_drafts_v2';
export const ACTIVE_DRAFT_ID_KEY = 'shudkara_timeline_active_draft_id_v2';
export const LEGACY_DRAFT_META_KEY = 'shudkara_timeline_draft_meta_v1';
export const IDB_NAME = 'shudkara_timeline_db';
export const IDB_STORE_MEDIA = 'draft_media';
export const IDB_STORE_DRAFTS = 'timeline_drafts';

let cachedDb: IDBDatabase | null = null;

// ── Bulletproof IndexedDB Singleton (v2 with complete Draft persistence) ──
export async function openDraftDb(): Promise<IDBDatabase> {
  if (cachedDb) return cachedDb;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_MEDIA)) {
        db.createObjectStore(IDB_STORE_MEDIA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IDB_STORE_DRAFTS)) {
        db.createObjectStore(IDB_STORE_DRAFTS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      cachedDb = request.result;
      cachedDb.onclose = () => { cachedDb = null; };
      cachedDb.onversionchange = () => { cachedDb?.close(); cachedDb = null; };
      resolve(cachedDb);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Eager background uploader for individual media items (real-time draft staging)
 */
export async function uploadMediaItemEagerly(
  item: DraftMediaItem,
  token?: string | null,
  onProgress?: (percent: number) => void
): Promise<Partial<DraftMediaItem>> {
  if (item.uploadStatus === 'uploaded' && item.googleDriveId) {
    return {
      googleDriveId: item.googleDriveId,
      viewUrl: item.viewUrl,
      thumbnailUrl: item.thumbnailUrl,
      previewUrl: item.previewUrl,
      streamUrl: item.streamUrl,
      size: item.size,
      uploadStatus: 'uploaded',
      uploadProgress: 100
    };
  }

  // 1. Obtain raw Blob/File
  let blob: Blob;
  if (item.rawFile instanceof Blob) {
    blob = item.rawFile;
  } else if (item.base64 && item.base64.startsWith('blob:')) {
    const res = await fetch(item.base64);
    blob = await res.blob();
  } else if (item.base64 && item.base64.startsWith('data:')) {
    const res = await fetch(item.base64);
    blob = await res.blob();
  } else if (item.base64) {
    const cleanBase64 = item.base64.split(';base64,').pop() || item.base64;
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: item.type || 'image/jpeg' });
  } else {
    throw new Error('No media data found to upload');
  }

  const size = blob.size;
  const CHUNK_THRESHOLD = 8 * 1024 * 1024; // 8 MB
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-Session-Token'] = token;

  // Small File Fast Upload (< 8MB)
  if (size < CHUNK_THRESHOLD) {
    onProgress?.(30);
    let base64String = item.base64;
    if (!base64String || !base64String.startsWith('data:')) {
      base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    const res = await fetch('/api/timeline/staging-media', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: item.name,
        type: item.type || 'image/jpeg',
        base64: base64String,
        thumbnailBase64: item.thumbnailBase64,
        size
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Upload failed with status ${res.status}`);
    }

    const data = await res.json();
    onProgress?.(100);
    return {
      googleDriveId: data.mediaItem.googleDriveId,
      viewUrl: data.mediaItem.viewUrl,
      thumbnailUrl: data.mediaItem.thumbnailUrl || item.thumbnailUrl,
      previewUrl: data.mediaItem.previewUrl,
      streamUrl: data.mediaItem.streamUrl,
      size: data.mediaItem.size || size,
      uploadStatus: 'uploaded',
      uploadProgress: 100
    };
  }

  // Large File Resumable Upload (>= 8MB)
  onProgress?.(5);
  const initRes = await fetch('/api/timeline/staging-media/init-chunked', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: item.name,
      type: item.type || 'application/octet-stream',
      thumbnailBase64: item.thumbnailBase64,
      size
    })
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(err.error || `Failed to initiate chunked session: HTTP ${initRes.status}`);
  }

  const { uploadId, chunkSize = 4 * 1024 * 1024 } = await initRes.json();
  const totalChunks = Math.ceil(size / chunkSize);
  let finalMediaItem: any = null;

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const startByte = chunkIdx * chunkSize;
    const endByte = Math.min(startByte + chunkSize - 1, size - 1);
    const chunkSlice = blob.slice(startByte, endByte + 1);

    const chunkBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(chunkSlice);
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const chunkRes = await fetch('/api/timeline/staging-media/upload-chunk', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            uploadId,
            chunkBase64,
            startByte,
            endByte,
            totalBytes: size
          })
        });

        if (!chunkRes.ok) {
          const err = await chunkRes.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${chunkRes.status}`);
        }

        const chunkData = await chunkRes.json();
        if (chunkIdx === totalChunks - 1) {
          if (!chunkData.complete) throw new Error('Upload incomplete on final chunk');
          finalMediaItem = chunkData.mediaItem;
        }
        break;
      } catch (attErr) {
        if (attempt === 3) throw attErr;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    const chunkProgress = Math.min(99, Math.round(((chunkIdx + 1) / totalChunks) * 100));
    onProgress?.(chunkProgress);
  }

  if (!finalMediaItem) {
    throw new Error('Upload completed without returning media item');
  }

  onProgress?.(100);
  return {
    googleDriveId: finalMediaItem.googleDriveId,
    viewUrl: finalMediaItem.viewUrl,
    thumbnailUrl: finalMediaItem.thumbnailUrl || item.thumbnailUrl,
    previewUrl: finalMediaItem.previewUrl,
    streamUrl: finalMediaItem.streamUrl,
    size: finalMediaItem.size || size,
    uploadStatus: 'uploaded',
    uploadProgress: 100
  };
}

/**
 * 1. Complete Draft Save: Atomically saves writeup text, metadata AND snap media references
 * into IndexedDB with an explicit oncomplete wait, plus light metadata mirror in localStorage.
 */
export async function saveFullDraftToDb(draft: TimelineDraftMeta & { mediaFiles?: DraftMediaItem[] }): Promise<void> {
  try {
    const db = await openDraftDb();
    const mediaToSave = draft.mediaFiles || [];

    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction([IDB_STORE_DRAFTS, IDB_STORE_MEDIA], 'readwrite');
        const draftStore = tx.objectStore(IDB_STORE_DRAFTS);
        const mediaStore = tx.objectStore(IDB_STORE_MEDIA);

        // Store lightweight metadata in draftStore (avoid heavy multi-MB media duplication)
        const { mediaFiles, ...draftMetaOnly } = draft;

        draftStore.put({
          ...draftMetaOnly,
          mediaCount: mediaToSave.length,
          status: draft.status || 'draft',
          updatedAt: draft.updatedAt || Date.now()
        });

        if (mediaToSave.length > 0) {
          // If media items are already uploaded, keep only lightweight metadata + previewUrl
          const sanitizedMedia = mediaToSave.map(m => {
            if (m.uploadStatus === 'uploaded' && m.googleDriveId) {
              return {
                id: m.id,
                name: m.name,
                type: m.type,
                base64: m.previewUrl || m.thumbnailUrl || '',
                googleDriveId: m.googleDriveId,
                viewUrl: m.viewUrl,
                thumbnailUrl: m.thumbnailUrl,
                previewUrl: m.previewUrl,
                streamUrl: m.streamUrl,
                size: m.size,
                uploadStatus: 'uploaded' as const,
                uploadProgress: 100
              };
            }
            return m;
          });
          mediaStore.put({ id: `media_${draft.id}`, items: sanitizedMedia });
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });

    // Mirror light metadata to localStorage for synchronous instant UI pre-fills
    try {
      const meta = {
        id: draft.id,
        title: draft.title,
        content: draft.content,
        category: draft.category,
        rawTags: draft.rawTags,
        tags: draft.tags,
        timestamp: draft.timestamp,
        dateMode: draft.dateMode,
        formBsYear: draft.formBsYear,
        formBsMonth: draft.formBsMonth,
        formBsDay: draft.formBsDay,
        currentStep: draft.currentStep,
        mediaCount: mediaToSave.length,
        status: draft.status || 'draft',
        syncError: draft.syncError || '',
        updatedAt: draft.updatedAt || Date.now(),
        createdAt: draft.createdAt || Date.now()
      };

      const raw = localStorage.getItem(DRAFTS_LIST_KEY);
      let list: any[] = [];
      if (raw) {
        try { list = JSON.parse(raw); } catch {}
      }
      if (!Array.isArray(list)) list = [];
      const updated = [meta, ...list.filter((d: any) => d.id !== draft.id)];
      localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(updated));
      localStorage.setItem(ACTIVE_DRAFT_ID_KEY, draft.id);
    } catch {
      // LocalStorage quota may be full, but IndexedDB has 100% of the data!
    }
  } catch (e) {
    console.error('Critical: Failed to save draft to IndexedDB:', e);
  }
}

/**
 * 2. Complete Draft Load: Fetches full writeup AND media from IndexedDB
 */
export async function loadFullDraftFromDb(draftId: string): Promise<(TimelineDraftMeta & { mediaFiles: DraftMediaItem[] }) | null> {
  try {
    const db = await openDraftDb();
    const fromIdb: (TimelineDraftMeta & { mediaFiles?: DraftMediaItem[] }) | null = await new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE_DRAFTS, 'readonly');
        const req = tx.objectStore(IDB_STORE_DRAFTS).get(draftId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    if (fromIdb) {
      if (!fromIdb.mediaFiles || fromIdb.mediaFiles.length === 0) {
        fromIdb.mediaFiles = await loadMediaFromDb(draftId);
      }
      return {
        ...fromIdb,
        mediaFiles: fromIdb.mediaFiles || []
      };
    }

    // Fallback: check localStorage + IDB media
    const raw = localStorage.getItem(DRAFTS_LIST_KEY);
    if (raw) {
      try {
        const list = JSON.parse(raw);
        const found = list.find((d: any) => d.id === draftId);
        if (found) {
          const media = await loadMediaFromDb(draftId);
          return {
            ...found,
            mediaFiles: media
          };
        }
      } catch {}
    }

    // Fallback 2: check outbox queue
    const outboxRaw = localStorage.getItem('shudkara_offline_outbox');
    if (outboxRaw) {
      try {
        const outbox = JSON.parse(outboxRaw);
        const item = outbox.find((o: any) => o.body?.draftId === draftId || o.id === draftId);
        if (item && item.body) {
          const media = await loadMediaFromDb(draftId);
          return {
            id: draftId,
            title: item.body.title || '',
            content: item.body.content || '',
            category: item.body.category || 'General',
            rawTags: Array.isArray(item.body.tags) ? item.body.tags.join(', ') : '',
            tags: item.body.tags || [],
            timestamp: item.body.timestamp || new Date().toISOString(),
            dateMode: 'AD',
            formBsYear: adToBs(new Date()).year,
            formBsMonth: adToBs(new Date()).month,
            formBsDay: adToBs(new Date()).day,
            currentStep: 2,
            mediaFiles: media,
            mediaCount: media.length,
            status: 'queued',
            updatedAt: item.timestamp || Date.now(),
            createdAt: item.timestamp || Date.now()
          };
        }
      } catch {}
    }

    return null;
  } catch (err) {
    console.error('Failed to load full draft from IndexedDB:', err);
    return null;
  }
}

/**
 * 3. List all drafts across IndexedDB, localStorage, and outbox with unified deduplication
 */
export async function listAllDraftsFromDb(): Promise<TimelineDraftMeta[]> {
  const draftsMap = new Map<string, TimelineDraftMeta>();

  // A. Load from IndexedDB
  try {
    const db = await openDraftDb();
    const idbDrafts: TimelineDraftMeta[] = await new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE_DRAFTS, 'readonly');
        const req = tx.objectStore(IDB_STORE_DRAFTS).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
    for (const d of idbDrafts) {
      if (d && d.id) draftsMap.set(d.id, d);
    }
  } catch {}

  // B. Merge with localStorage
  try {
    const raw = localStorage.getItem(DRAFTS_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const meta of parsed) {
          if (meta && meta.id && !draftsMap.has(meta.id)) {
            draftsMap.set(meta.id, meta);
          }
        }
      }
    }
  } catch {}

  // C. Merge with outbox
  try {
    const outboxRaw = localStorage.getItem('shudkara_offline_outbox');
    if (outboxRaw) {
      const outbox = JSON.parse(outboxRaw);
      if (Array.isArray(outbox)) {
        for (const item of outbox) {
          if (item.subapp === 'timeline' && item.body && (item.body.content || item.body.title)) {
            const draftKey = item.body.draftId || `recovered_${item.id}`;
            if (!draftsMap.has(draftKey)) {
              draftsMap.set(draftKey, {
                id: draftKey,
                title: item.body.title || '',
                content: item.body.content || '',
                category: item.body.category || 'General',
                rawTags: Array.isArray(item.body.tags) ? item.body.tags.join(', ') : '',
                tags: item.body.tags || [],
                timestamp: item.body.timestamp || new Date().toISOString(),
                dateMode: 'AD',
                formBsYear: adToBs(new Date()).year,
                formBsMonth: adToBs(new Date()).month,
                formBsDay: adToBs(new Date()).day,
                currentStep: 2,
                mediaCount: 0,
                status: 'queued',
                updatedAt: item.timestamp || Date.now(),
                createdAt: item.timestamp || Date.now()
              });
            }
          }
        }
      }
    }
  } catch {}

  const result = Array.from(draftsMap.values());
  result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return result;
}

/**
 * 4. Backward-compatible Media Load
 */
export async function loadMediaFromDb(draftId: string): Promise<DraftMediaItem[]> {
  try {
    const db = await openDraftDb();
    return new Promise((resolve) => {
      const tx = db.transaction([IDB_STORE_MEDIA], 'readonly');
      const store = tx.objectStore(IDB_STORE_MEDIA);
      const req = store.get(`media_${draftId}`);
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.items)) {
          resolve(req.result.items);
        } else {
          // Fallback to legacy single draft key if migrating
          const legacyReq = store.get('current_draft_media');
          legacyReq.onsuccess = () => {
            if (legacyReq.result && Array.isArray(legacyReq.result.items)) {
              resolve(legacyReq.result.items);
            } else {
              resolve([]);
            }
          };
          legacyReq.onerror = () => resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveMediaToDb(draftId: string, media: DraftMediaItem[]) {
  try {
    const db = await openDraftDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_MEDIA, 'readwrite');
      const store = tx.objectStore(IDB_STORE_MEDIA);
      store.put({ id: `media_${draftId}`, items: media });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to save draft media to IndexedDB:', e);
  }
}

/**
 * 5. Permanent deletion: removes from IndexedDB and LocalStorage
 */
export async function deleteFullDraftFromDb(draftId: string): Promise<void> {
  try {
    const db = await openDraftDb();
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([IDB_STORE_DRAFTS, IDB_STORE_MEDIA], 'readwrite');
        tx.objectStore(IDB_STORE_DRAFTS).delete(draftId);
        tx.objectStore(IDB_STORE_MEDIA).delete(`media_${draftId}`);
        tx.objectStore(IDB_STORE_MEDIA).delete('current_draft_media');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });

    const raw = localStorage.getItem(DRAFTS_LIST_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const updated = parsed.filter((d: any) => d.id !== draftId);
          localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(updated));
          if (updated.length > 0) {
            localStorage.setItem(ACTIVE_DRAFT_ID_KEY, updated[0].id);
          } else {
            localStorage.removeItem(ACTIVE_DRAFT_ID_KEY);
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Error deleting draft from DB:', err);
  }
}

export async function clearDraftFromDb(draftId: string) {
  return deleteFullDraftFromDb(draftId);
}

/**
 * 6. Mark a draft as failed with explicit reason so user can see it in drafts
 */
export async function markDraftFailed(draftId: string, errorMsg: string): Promise<void> {
  try {
    const draft = await loadFullDraftFromDb(draftId);
    if (draft) {
      draft.status = 'failed';
      draft.syncError = errorMsg;
      draft.updatedAt = Date.now();
      await saveFullDraftToDb(draft);
      window.dispatchEvent(new CustomEvent('shudkara:drafts-updated'));
    }
  } catch (err) {
    console.warn('Error marking draft as failed:', err);
  }
}

/**
 * 7. Finalize draft ONLY when 100% of post and photos have been confirmed on server!
 */
export async function finalizeSuccessfulDraftUpload(draftId: string): Promise<void> {
  await deleteFullDraftFromDb(draftId);
  window.dispatchEvent(new CustomEvent('shudkara:draft-finalized', { detail: { draftId } }));
  window.dispatchEvent(new CustomEvent('shudkara:drafts-updated'));
}

// Client-side image optimization helper for high-res photos
async function processSelectedFile(file: File): Promise<DraftMediaItem> {
  const mimeType = file.type || 'image/jpeg';
  const fileId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // If video: use lightweight object URL for zero-RAM video playback in preview
  if (mimeType.startsWith('video/')) {
    const objectUrl = URL.createObjectURL(file);
    let thumbnailBase64 = '';
    try {
      thumbnailBase64 = await generateVideoThumbnail(file);
    } catch (e) {
      console.warn('Could not generate video thumbnail:', e);
    }
    return {
      id: fileId,
      name: file.name,
      type: mimeType,
      base64: objectUrl,
      rawFile: file,
      size: file.size,
      thumbnailUrl: thumbnailBase64 || undefined,
      thumbnailBase64: thumbnailBase64 || undefined,
      uploadStatus: 'pending',
      uploadProgress: 0
    };
  }

  // If GIF, preserve raw animation
  if (mimeType === 'image/gif') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: fileId,
        name: file.name,
        type: mimeType,
        base64: reader.result as string,
        rawFile: file,
        size: file.size,
        uploadStatus: 'pending',
        uploadProgress: 0
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // If image is larger than 1.5MB, scale down on canvas to max 2560px
  if (mimeType.startsWith('image/') && file.size > 1.5 * 1024 * 1024) {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const maxDim = 2560;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.88);
        return { 
          id: fileId,
          name: file.name.replace(/\.[^.]+$/, '.jpg'), 
          type: 'image/jpeg', 
          base64: compressedBase64,
          rawFile: file,
          size: Math.round((compressedBase64.length * 3) / 4),
          uploadStatus: 'pending',
          uploadProgress: 0
        };
      }
    } catch (e) {
      console.warn('Canvas optimization fallback to original:', e);
    }
  }

  // Default raw reader for images
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: fileId,
      name: file.name,
      type: mimeType,
      base64: reader.result as string,
      rawFile: file,
      size: file.size || Math.round(((reader.result as string)?.length * 3) / 4),
      uploadStatus: 'pending',
      uploadProgress: 0
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Convert image URL from external drag (other websites/tabs) into local base64
async function processImageUrl(url: string, defaultName = 'dropped-image.jpg'): Promise<DraftMediaItem> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D canvas context');
        ctx.drawImage(img, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        resolve({ name: defaultName, type: 'image/jpeg', base64, size: Math.round((base64.length * 3) / 4) });
      } catch {
        fetch(url)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], defaultName, { type: blob.type || 'image/jpeg' });
            return processSelectedFile(file);
          })
          .then(resolve)
          .catch(reject);
      }
    };
    img.onerror = () => {
      fetch(url)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], defaultName, { type: blob.type || 'image/jpeg' });
          return processSelectedFile(file);
        })
        .then(resolve)
        .catch(reject);
    };
    img.src = url;
  });
}

function getStoredDrafts(): TimelineDraftMeta[] {
  let list: TimelineDraftMeta[] = [];
  try {
    const raw = localStorage.getItem(DRAFTS_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    }
  } catch {}

  // AUTO-RECOVERY SAFETY NET:
  // Check the offline outbox for any timeline writeups that failed or were interrupted during sync
  try {
    const outboxRaw = localStorage.getItem('shudkara_offline_outbox');
    if (outboxRaw) {
      const outbox = JSON.parse(outboxRaw);
      if (Array.isArray(outbox)) {
        for (const item of outbox) {
          if (item.subapp === 'timeline' && item.body && (item.body.content || item.body.title)) {
            const draftKey = item.body.draftId || `recovered_${item.id}`;
            const exists = list.some(d => d.id === draftKey || (d.content && d.content === item.body.content));
            if (!exists) {
              const recovered: TimelineDraftMeta = {
                id: draftKey,
                title: item.body.title || 'Recovered Writeup',
                content: item.body.content || '',
                category: item.body.category || 'General',
                rawTags: Array.isArray(item.body.tags) ? item.body.tags.join(', ') : '',
                timestamp: item.body.timestamp || new Date().toISOString(),
                dateMode: 'AD',
                formBsYear: adToBs(new Date()).year,
                formBsMonth: adToBs(new Date()).month,
                formBsDay: adToBs(new Date()).day,
                currentStep: 2,
                mediaCount: Array.isArray(item.body.mediaFiles) ? item.body.mediaFiles.length : 0,
                updatedAt: item.timestamp || Date.now()
              };
              list.unshift(recovered);
            }
          }
        }
      }
    }
  } catch {}

  return list;
}

function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

export const TimelineWizardModal: React.FC<TimelineWizardModalProps> = ({
  onClose,
  onSubmit,
  categoriesList = [],
  tagsList: _tagsList = [],
  tagPool = [],
  onRefreshTagPool,
  onOpenTagManager,
  initialDraftId,
  authToken
}) => {
  // Tag Pool Knowledge Management State
  const [wizardTagPool, setWizardTagPool] = useState<TimelineTag[]>(tagPool || []);
  const [showWizardTagManager, setShowWizardTagManager] = useState(false);

  const refreshWizardTagPool = async () => {
    if (onRefreshTagPool) {
      await onRefreshTagPool();
    }
    try {
      const res = await fetch('/api/timeline/tags', {
        headers: authToken ? { 'X-Session-Token': authToken } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tagPool)) {
          setWizardTagPool(data.tagPool);
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (tagPool && tagPool.length > 0) {
      setWizardTagPool(tagPool);
    } else {
      refreshWizardTagPool();
    }
  }, [tagPool]);

  // Multiple Drafts State
  const [draftsList, setDraftsList] = useState<TimelineDraftMeta[]>(getStoredDrafts);
  const [activeDraftId, setActiveDraftId] = useState<string>(() => {
    if (initialDraftId) return initialDraftId;
    const storedActive = localStorage.getItem(ACTIVE_DRAFT_ID_KEY);
    if (storedActive) return storedActive;
    const existing = getStoredDrafts();
    if (existing.length > 0) return existing[0].id;
    return generateDraftId();
  });
  const [showDraftsMenu, setShowDraftsMenu] = useState(false);
  const [hasDraftLoaded, setHasDraftLoaded] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Wizard Steps: 1: Media -> 2: Details -> 3: Preview
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Story Details Form States
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [rawTags, setRawTags] = useState('');
  
  // Date & Time states
  const [timestamp, setTimestamp] = useState<string>(() => {
    return getLocalIsoString();
  });
  const [dateMode, setDateMode] = useState<'AD' | 'BS'>('AD');
  
  // Bikram Sambat specific selectors
  const [formBsYear, setFormBsYear] = useState<number>(() => adToBs(new Date()).year);
  const [formBsMonth, setFormBsMonth] = useState<number>(() => adToBs(new Date()).month);
  const [formBsDay, setFormBsDay] = useState<number>(() => adToBs(new Date()).day);

  // Media attachments state
  const [selectedFiles, setSelectedFiles] = useState<DraftMediaItem[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [previewMediaIndex, setPreviewMediaIndex] = useState<number | null>(null);

  // Drag and drop reordering states
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isDraggingExternalFiles, setIsDraggingExternalFiles] = useState(false);
  const dragCounterRef = useRef(0);

  // Touch swipe gesture ref for mobile
  const touchStartRef = useRef<{ x: number; y: number; idx: number } | null>(null);

  // Ref to always access current media files without causing text autosave re-renders
  const selectedFilesRef = useRef<DraftMediaItem[]>(selectedFiles);
  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  // Steganographic Clearance State & Secret Cadence Handlers
  const [clearanceLevel, setClearanceLevel] = useState<0 | 1 | 2>(0);
  const clicksRef = useRef<number[]>([]);
  const holdTimerRef = useRef<any>(null);
  const isHoldingRef = useRef(false);

  const handleCadenceClick = () => {
    if (isHoldingRef.current) return;
    const now = Date.now();
    const recent = clicksRef.current.filter(t => now - t < 2500);
    recent.push(now);
    clicksRef.current = recent;

    const count = recent.length;
    if (count >= 10 && clearanceLevel < 2) {
      // 10 Clicks: Elevate to Nigudha (Level 2)
      setClearanceLevel(2);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([50, 40, 50, 40, 80]);
    } else if (count >= 5 && count < 10 && clearanceLevel < 1) {
      // 5 Clicks: Elevate to Guhya (Level 1)
      setClearanceLevel(1);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([40, 30, 40]);
    }
  };

  const handleHoldStart = () => {
    isHoldingRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      // Press & Hold (1.5s): Reset back to Prakata (Level 0)
      setClearanceLevel(0);
      clicksRef.current = [];
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(100);
    }, 1500);
  };

  const handleHoldEnd = () => {
    clearTimeout(holdTimerRef.current);
  };

  // Submission & feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Real-Time Eager Upload Trigger ────────────────────────────────────
  const triggerBackgroundUpload = (mediaItem: DraftMediaItem, fileId: string) => {
    if (!mediaItem || !fileId) return;

    setSelectedFiles(prev => prev.map(f => f.id === fileId ? { ...f, uploadStatus: 'uploading', uploadProgress: 5, uploadError: undefined } : f));

    uploadMediaItemEagerly(mediaItem, authToken, (progress) => {
      setSelectedFiles(prev => prev.map(f => f.id === fileId ? { ...f, uploadProgress: progress } : f));
    }).then(updated => {
      setSelectedFiles(prev => prev.map(f => {
        if (f.id === fileId) {
          return {
            ...f,
            ...updated,
            uploadStatus: 'uploaded',
            uploadProgress: 100,
            uploadError: undefined
          };
        }
        return f;
      }));
    }).catch(err => {
      console.warn(`Eager upload failed for ${mediaItem.name}:`, err);
      setSelectedFiles(prev => prev.map(f => f.id === fileId ? { ...f, uploadStatus: 'error', uploadError: err.message || 'Upload failed' } : f));
    });
  };

  // ── Load Draft by ID with Full Content & Snaps ─────────────────────────
  const loadDraftById = async (draftId: string) => {
    setHasDraftLoaded(false);
    try {
      const fullDraft = await loadFullDraftFromDb(draftId);
      if (fullDraft) {
        setTitle(fullDraft.title || '');
        setContent(fullDraft.content || '');
        setCategory(fullDraft.category || 'General');
        setRawTags(fullDraft.rawTags || '');
        if (fullDraft.timestamp) {
          setTimestamp(fullDraft.timestamp);
          const bs = adToBs(new Date(fullDraft.timestamp));
          setFormBsYear(fullDraft.formBsYear || bs.year);
          setFormBsMonth(fullDraft.formBsMonth || bs.month);
          setFormBsDay(fullDraft.formBsDay || bs.day);
        }
        if (fullDraft.dateMode) setDateMode(fullDraft.dateMode);
        if (fullDraft.currentStep) setCurrentStep(fullDraft.currentStep);

        const media = fullDraft.mediaFiles || [];
        setSelectedFiles(media);
        if (fullDraft.clearanceLevel !== undefined) {
          setClearanceLevel((fullDraft.clearanceLevel as 0 | 1 | 2) || 0);
        } else {
          setClearanceLevel(0);
        }
        setLastSavedTime(new Date(fullDraft.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        // Eagerly upload any un-staged media
        media.forEach(item => {
          if (item && item.id && item.uploadStatus !== 'uploaded') {
            triggerBackgroundUpload(item, item.id);
          }
        });
      } else {
        // Check legacy v1 draft for migration
        const legacyMetaStr = localStorage.getItem(LEGACY_DRAFT_META_KEY);
        if (legacyMetaStr) {
          try {
            const meta = JSON.parse(legacyMetaStr);
            if (meta.title !== undefined) setTitle(meta.title);
            if (meta.content !== undefined) setContent(meta.content);
            if (meta.category !== undefined) setCategory(meta.category);
            if (meta.rawTags !== undefined) setRawTags(meta.rawTags);
            if (meta.timestamp) {
              setTimestamp(meta.timestamp);
              const bs = adToBs(new Date(meta.timestamp));
              setFormBsYear(bs.year);
              setFormBsMonth(bs.month);
              setFormBsDay(bs.day);
            }
            if (meta.dateMode) setDateMode(meta.dateMode);
            if (meta.currentStep) setCurrentStep(meta.currentStep);

            const mediaItems = await loadMediaFromDb('current_draft_media');
            setSelectedFiles(mediaItems);
            localStorage.removeItem(LEGACY_DRAFT_META_KEY);
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Failed to restore draft from DB:', err);
    } finally {
      setHasDraftLoaded(true);
    }
  };

  useEffect(() => {
    loadDraftById(activeDraftId);
  }, [activeDraftId]);

  // Initial and reactive refresh of all saved drafts
  const refreshAllDrafts = async () => {
    const list = await listAllDraftsFromDb();
    setDraftsList(list);
  };

  useEffect(() => {
    refreshAllDrafts();
    window.addEventListener('shudkara:drafts-updated', refreshAllDrafts);
    return () => window.removeEventListener('shudkara:drafts-updated', refreshAllDrafts);
  }, []);

  // ── Bulletproof Save Helper: Guarantees text + photos are safely committed ──
  const persistDraftImmediately = async (customStatus?: TimelineDraftMeta['status'], customError?: string) => {
    if (!activeDraftId) return;
    const currentFiles = selectedFilesRef.current;
    const isMeaningful = title.trim() || content.trim() || currentFiles.length > 0;
    if (!isMeaningful) return;

    const draftObj: TimelineDraftMeta & { mediaFiles: DraftMediaItem[] } = {
      id: activeDraftId,
      title: title.trim(),
      content: content.trim(),
      category: category.trim() || 'General',
      rawTags,
      tags: rawTags.split(',').map(t => t.trim()).filter(Boolean),
      timestamp,
      dateMode,
      formBsYear,
      formBsMonth,
      formBsDay,
      currentStep,
      mediaCount: currentFiles.length,
      mediaFiles: currentFiles,
      clearanceLevel,
      clearanceTier: clearanceLevel === 2 ? 'nigudha' : clearanceLevel === 1 ? 'guhya' : 'prakata',
      status: customStatus || 'draft',
      syncError: customError,
      updatedAt: Date.now(),
      createdAt: Date.now()
    };

    await saveFullDraftToDb(draftObj);
    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  // ── Auto-Save Active Draft on Text Change (Debounced 400ms, decoupled from media) ──────
  useEffect(() => {
    if (!hasDraftLoaded || !activeDraftId) return;

    const timer = setTimeout(() => {
      persistDraftImmediately();
    }, 400);

    return () => clearTimeout(timer);
  }, [title, content, category, rawTags, timestamp, dateMode, formBsYear, formBsMonth, formBsDay, currentStep, clearanceLevel, hasDraftLoaded, activeDraftId]);

  // ── Auto-Save Media to IDB when media items change ─────────────────────────────
  useEffect(() => {
    if (!hasDraftLoaded || !activeDraftId) return;
    saveMediaToDb(activeDraftId, selectedFiles);
  }, [selectedFiles, hasDraftLoaded, activeDraftId]);

  // ── Global Drag & Drop Safety and Clipboard Paste (Ctrl+V) ───────────────
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleWindowPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            try {
              const mediaItem = await processSelectedFile(file);
              setSelectedFiles(prev => [...prev, mediaItem]);
              if (mediaItem.id) triggerBackgroundUpload(mediaItem, mediaItem.id);
              if (currentStep !== 1) setCurrentStep(1);
            } catch (err) {
              console.error('Error processing pasted image:', err);
            }
          }
        }
      }
    };

    window.addEventListener('dragover', preventDefaults);
    window.addEventListener('drop', preventDefaults);
    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('dragover', preventDefaults);
      window.removeEventListener('drop', preventDefaults);
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [currentStep]);

  // Flush on unmount / modal close so not even 1 character is ever lost
  useEffect(() => {
    return () => {
      if (hasDraftLoaded) {
        persistDraftImmediately();
      }
    };
  }, [title, content, category, rawTags, timestamp, dateMode, formBsYear, formBsMonth, formBsDay, selectedFiles, currentStep, hasDraftLoaded, activeDraftId, clearanceLevel]);

  // Create New Draft
  const handleCreateNewDraft = async () => {
    await persistDraftImmediately();
    const newId = generateDraftId();
    setTitle('');
    setContent('');
    setCategory('General');
    setRawTags('');
    setClearanceLevel(0);
    const now = new Date();
    setTimestamp(now.toISOString().substring(0, 16));
    const bs = adToBs(now);
    setFormBsYear(bs.year);
    setFormBsMonth(bs.month);
    setFormBsDay(bs.day);
    setSelectedFiles([]);
    setCurrentStep(1);
    setLastSavedTime(null);
    setActiveDraftId(newId);
    localStorage.setItem(ACTIVE_DRAFT_ID_KEY, newId);
    setShowDraftsMenu(false);
  };

  // Switch Draft
  const handleSwitchDraft = async (targetId: string) => {
    if (targetId === activeDraftId) {
      setShowDraftsMenu(false);
      return;
    }
    // Flush current work first
    await persistDraftImmediately();
    setActiveDraftId(targetId);
    localStorage.setItem(ACTIVE_DRAFT_ID_KEY, targetId);
    setShowDraftsMenu(false);
  };

  // Delete Draft
  const handleDeleteDraft = async (targetId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this draft permanently?')) return;

    await deleteFullDraftFromDb(targetId);
    const updated = await listAllDraftsFromDb();
    setDraftsList(updated);

    if (activeDraftId === targetId) {
      if (updated.length > 0) {
        handleSwitchDraft(updated[0].id);
      } else {
        handleCreateNewDraft();
      }
    }
  };

  // Sync AD & BS dates
  const handleAdTimestampChange = (newAdString: string) => {
    setTimestamp(newAdString);
    if (newAdString) {
      const bs = adToBs(new Date(newAdString));
      setFormBsYear(bs.year);
      setFormBsMonth(bs.month);
      setFormBsDay(bs.day);
    }
  };

  const handleBsDateChange = (year: number, month: number, day: number) => {
    setFormBsYear(year);
    setFormBsMonth(month);
    setFormBsDay(day);

    const maxDays = getMonthDays(year, month);
    const validDay = Math.min(day, maxDays);
    if (validDay !== day) {
      setFormBsDay(validDay);
    }

    const adDate = bsToAd(year, month, validDay);
    const currentTimeStr = timestamp && timestamp.length >= 16 ? timestamp.substring(11, 16) : getCurrentLocalTime24();
    const yyyy = adDate.getFullYear();
    const mm = String(adDate.getMonth() + 1).padStart(2, '0');
    const dd = String(adDate.getDate()).padStart(2, '0');
    setTimestamp(`${yyyy}-${mm}-${dd}T${currentTimeStr}`);
  };

  const handleAdDateOnlyChange = (newDateStr: string) => {
    if (!newDateStr) return;
    const timePart = timestamp && timestamp.length >= 16 ? timestamp.substring(11, 16) : getCurrentLocalTime24();
    handleAdTimestampChange(`${newDateStr}T${timePart}`);
  };

  const handleTimeChange = (newTime24: string) => {
    const datePart = timestamp && timestamp.length >= 10 ? timestamp.substring(0, 10) : getLocalIsoString().substring(0, 10);
    setTimestamp(`${datePart}T${newTime24}`);
  };

  const setQuickDate = (type: 'today' | 'yesterday') => {
    const d = new Date();
    if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const timePart = timestamp && timestamp.length >= 16 ? timestamp.substring(11, 16) : getCurrentLocalTime24();
    handleAdTimestampChange(`${yyyy}-${mm}-${dd}T${timePart}`);
  };

  // File Upload Handlers (Handles Images, Videos, GIFs)
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    e.target.value = '';

    for (const file of fileList) {
      try {
        const item = await processSelectedFile(file);
        setSelectedFiles(prev => [...prev, item]);
        if (item.id) triggerBackgroundUpload(item, item.id);
      } catch (err) {
        console.error('Error processing file:', file.name, err);
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (previewMediaIndex === index) setPreviewMediaIndex(null);
  };

  // Drag and drop reordering handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  // External Drag and Drop handlers (files from desktop, file explorer, or images from web pages)
  const handleWindowDragEnter = (e: React.DragEvent) => {
    if (draggedIdx !== null) return;
    const types = e.dataTransfer.types;
    if (types && (types.includes('Files') || types.includes('text/uri-list') || types.includes('text/html'))) {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      setIsDraggingExternalFiles(true);
    }
  };

  const handleWindowDragOver = (e: React.DragEvent) => {
    if (draggedIdx !== null) return;
    const types = e.dataTransfer.types;
    if (types && (types.includes('Files') || types.includes('text/uri-list') || types.includes('text/html'))) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      if (!isDraggingExternalFiles) {
        setIsDraggingExternalFiles(true);
      }
    }
  };

  const handleWindowDragLeave = (e: React.DragEvent) => {
    if (draggedIdx !== null) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingExternalFiles(false);
    }
  };

  const handleExternalFileDrop = async (e: React.DragEvent) => {
    if (draggedIdx !== null) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDraggingExternalFiles(false);
    dragCounterRef.current = 0;

    const dt = e.dataTransfer;
    if (!dt) return;

    let addedCount = 0;

    // 1. Direct File Objects (from local folders, desktop, downloads)
    const files = dt.files ? Array.from(dt.files) : [];
    if (files.length > 0) {
      for (const file of files) {
        if (
          file.type.startsWith('image/') ||
          file.type.startsWith('video/') ||
          file.name.match(/\.(jpe?g|png|gif|webp|bmp|svg|mp4|webm|mov|heic|m4v)$/i)
        ) {
          try {
            const item = await processSelectedFile(file);
            setSelectedFiles(prev => [...prev, item]);
            if (item.id) triggerBackgroundUpload(item, item.id);
            addedCount++;
          } catch (err) {
            console.error('Error processing dropped file:', file.name, err);
          }
        }
      }
      if (addedCount > 0 && currentStep !== 1) {
        setCurrentStep(1);
      }
      return;
    }

    // 2. DataTransferItemList
    if (dt.items && dt.items.length > 0) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            try {
              const mediaItem = await processSelectedFile(file);
              setSelectedFiles(prev => [...prev, mediaItem]);
              if (mediaItem.id) triggerBackgroundUpload(mediaItem, mediaItem.id);
              addedCount++;
            } catch (err) {
              console.error('Error processing dropped item file:', err);
            }
          }
        }
      }
      if (addedCount > 0) {
        if (currentStep !== 1) setCurrentStep(1);
        return;
      }
    }

    // 3. Image URLs / HTML dragged from another browser tab or website
    const uriList = dt.getData('text/uri-list');
    const html = dt.getData('text/html');
    let imageUrl = uriList ? uriList.split('\n')[0].trim() : '';
    if (!imageUrl && html) {
      const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && match[1]) imageUrl = match[1];
    }

    if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:image/'))) {
      try {
        let mediaItem: DraftMediaItem;
        if (imageUrl.startsWith('data:image/')) {
          mediaItem = {
            id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: 'dropped-image.png',
            type: 'image/png',
            base64: imageUrl,
            uploadStatus: 'pending',
            uploadProgress: 0
          };
        } else {
          mediaItem = await processImageUrl(imageUrl);
        }
        setSelectedFiles(prev => [...prev, mediaItem]);
        if (mediaItem.id) triggerBackgroundUpload(mediaItem, mediaItem.id);
        if (currentStep !== 1) setCurrentStep(1);
      } catch (err) {
        console.error('Error processing dropped web image:', err);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null) {
      handleExternalFileDrop(e);
      return;
    }
    const sourceIndexStr = e.dataTransfer.getData('text/plain');
    const sourceIndex = sourceIndexStr ? parseInt(sourceIndexStr, 10) : draggedIdx;
    
    if (sourceIndex !== null && sourceIndex !== undefined && !isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      setSelectedFiles(prev => {
        const copy = [...prev];
        const [item] = copy.splice(sourceIndex, 1);
        copy.splice(targetIndex, 0, item);
        return copy;
      });
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleMoveItem = (fromIdx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? fromIdx - 1 : fromIdx + 1;
    if (targetIdx < 0 || targetIdx >= selectedFiles.length) return;
    setSelectedFiles(prev => {
      const copy = [...prev];
      const [item] = copy.splice(fromIdx, 1);
      copy.splice(targetIdx, 0, item);
      return copy;
    });
  };

  // Publish Moment: Immediately minimizes to background floating upload widget
  const handlePublish = async () => {
    if (!content.trim()) {
      setErrorMsg('Please write some content or note for this moment.');
      setCurrentStep(2);
      return;
    }

    const tagsArray = rawTags.split(',').map(t => t.trim()).filter(Boolean);
    
    // 1. Force save all text and snaps to IndexedDB as queued BEFORE modal unmounts!
    await persistDraftImmediately('queued');

    onSubmit({
      draftId: activeDraftId,
      title: title.trim(),
      content: content.trim(),
      category: category.trim() || 'General',
      tags: tagsArray,
      timestamp: new Date(timestamp).toISOString(),
      clearanceLevel,
      clearanceTier: clearanceLevel === 2 ? 'nigudha' : clearanceLevel === 1 ? 'guhya' : 'prakata',
      mediaFiles: selectedFiles
    });
    onClose();
  };

  const currentFormBs = adToBs(timestamp);
  const commonCategories = Array.from(new Set([...categoriesList, 'General', 'Life', 'Travel', 'Work', 'Health', 'Milestone'])).slice(0, 8);

  return (
    <div
      onDragEnter={handleWindowDragEnter}
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleExternalFileDrop}
      className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 select-none overflow-y-auto"
    >
      
      {/* ── Wizard Dialog Box ── */}
      <div className={`bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl transition-all duration-300 overflow-hidden relative animate-in zoom-in-95 duration-200 my-auto ${
        clearanceLevel === 2
          ? 'border-2 border-rose-500/80 ring-2 ring-rose-500/20 shadow-rose-500/10'
          : clearanceLevel === 1
          ? 'border-2 border-amber-400/80 ring-2 ring-amber-400/20 shadow-amber-500/10'
          : 'border border-slate-200'
      }`}>
        {/* Subtle Steganographic Hairline Accent */}
        {clearanceLevel > 0 && (
          <div className={`h-1 w-full shrink-0 transition-all duration-300 ${
            clearanceLevel === 2
              ? 'bg-gradient-to-r from-rose-500 via-purple-500 to-rose-600'
              : 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500'
          }`} />
        )}

        {/* Visual Drop Overlay when dragging images/videos from other places */}
        {isDraggingExternalFiles && (
          <div className="absolute inset-0 z-50 bg-blue-600/20 backdrop-blur-xs border-4 border-dashed border-blue-500 rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150 pointer-events-none">
            <div className="w-16 h-16 rounded-3xl bg-blue-600 text-white flex items-center justify-center shadow-xl animate-bounce mb-3">
              <Upload className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-black text-blue-900 bg-white/95 px-4 py-1.5 rounded-full shadow-md">
              Drop Images or Videos Here
            </h4>
            <p className="text-xs text-blue-800 font-bold mt-2 bg-white/90 px-3 py-1 rounded-full shadow-xs">
              Directly attach from your computer, folders, or other tabs
            </p>
          </div>
        )}
        
        {/* ── Top Bar with Step Indicators & Multiple Drafts Dropdown ── */}
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between shrink-0 relative">
          <div 
            onClick={handleCadenceClick}
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            className="flex items-center gap-3 cursor-pointer select-none"
            title=""
          >
            <div className={`w-8 h-8 rounded-xl text-white flex items-center justify-center font-extrabold text-sm shadow-md transition-colors duration-300 ${
              clearanceLevel === 2
                ? 'bg-rose-600 shadow-rose-500/20'
                : clearanceLevel === 1
                ? 'bg-amber-500 shadow-amber-500/20'
                : 'bg-blue-600 shadow-blue-500/20'
            }`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Document Moment
                {clearanceLevel === 1 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                )}
                {clearanceLevel === 2 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block animate-ping" />
                )}
                {lastSavedTime && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" /> Draft Saved {lastSavedTime}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">Social Content Creation Wizard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Manual Immediate Save to IndexedDB */}
            <button
              type="button"
              onClick={() => persistDraftImmediately()}
              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
              title="Force save draft immediately to device IndexedDB storage"
            >
              <Save className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Save Draft</span>
            </button>

            {/* Multiple Drafts Switcher Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDraftsMenu(prev => !prev)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                title="View and manage saved drafts"
              >
                <Files className="w-3.5 h-3.5 text-blue-600" />
                <span>Drafts ({draftsList.length})</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Drafts Dropdown Menu */}
              {showDraftsMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-84 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Files className="w-3.5 h-3.5 text-blue-600" /> Saved Drafts ({draftsList.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleCreateNewDraft}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition"
                    >
                      <Plus className="w-3 h-3" /> New Draft
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                    {draftsList.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => handleSwitchDraft(d.id)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer flex items-center justify-between transition ${
                          d.id === activeDraftId 
                            ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-400/40' 
                            : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {d.title || d.content?.slice(0, 28) || 'Untitled Draft'}
                            </p>
                            {d.status === 'failed' ? (
                              <span className="text-[9px] px-1.5 py-0.2 bg-red-100 text-red-700 font-bold rounded-full shrink-0">
                                ⚠️ Sync Failed
                              </span>
                            ) : d.status === 'queued' ? (
                              <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-700 font-bold rounded-full shrink-0">
                                🕒 Queued
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {d.mediaCount > 0 ? `${d.mediaCount} snaps • ` : ''}{new Date(d.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {d.syncError && (
                            <p className="text-[9px] text-red-600 truncate mt-0.5" title={d.syncError}>
                              {d.syncError}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteDraft(d.id, e)}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition shrink-0"
                          title="Delete draft"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Steps Progress Tabs ── */}
        <div className="grid grid-cols-3 border-b border-slate-200 text-xs font-extrabold text-center bg-slate-50/40">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition ${
              currentStep === 1
                ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center ${currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>1</span>
            <span>Media Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition ${
              currentStep === 2
                ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center ${currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>2</span>
            <span>Story & Date</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(3)}
            className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition ${
              currentStep === 3
                ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center ${currentStep === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>3</span>
            <span>Live Preview</span>
          </button>
        </div>

        {/* ── Error Banner ── */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs font-semibold text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── Main Step Content ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* ════════════ STEP 1: MEDIA STUDIO ════════════ */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="text-center space-y-1">
                <h3 className="text-base font-extrabold text-slate-900">Attach Photos, Videos or Live Snaps</h3>
                <p className="text-xs text-slate-500">Capture moments with full-screen camera or upload images, videos, and GIFs.</p>
              </div>

              {/* Action Buttons: Live Camera vs File Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="p-5 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white shadow-md flex flex-col items-center justify-center gap-2 transition hover:scale-[1.02] active:scale-95 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition duration-200">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-extrabold text-sm">Full-Screen Live Camera</span>
                  <span className="text-[11px] text-blue-100 font-medium">Real viewfinder, rotation fix, multi-snap</span>
                </button>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={handleExternalFileDrop}
                  className={`p-5 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition hover:scale-[1.02] active:scale-95 group ${
                    isDraggingExternalFiles
                      ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-400'
                      : 'border-slate-200 hover:border-blue-400 bg-slate-50/80 hover:bg-blue-50/30'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition duration-200">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="font-extrabold text-sm text-slate-800">Browse or Drag & Drop</span>
                  <span className="text-[11px] text-slate-500 font-medium text-center">
                    Drag photos/videos here, or click to browse device files
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,.gif"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Visual Uploaded Media Gallery with Drag & Drop Reordering */}
              {selectedFiles.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                        Attached Snaps ({selectedFiles.length})
                      </span>
                      <p className="text-[10px] text-slate-400">Drag & drop cards or use arrows to rearrange order</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      + Add More
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={file.id || idx}
                        draggable
                        onDragStart={e => handleDragStart(e, idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, idx)}
                        onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                        onTouchStart={e => {
                          touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, idx };
                        }}
                        onTouchEnd={e => {
                          if (touchStartRef.current && touchStartRef.current.idx === idx) {
                            const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
                            const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
                            if (Math.abs(deltaX) > 40 && Math.abs(deltaY) < 35) {
                              if (deltaX < 0 && idx < selectedFiles.length - 1) {
                                handleMoveItem(idx, 'right');
                                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(25);
                              } else if (deltaX > 0 && idx > 0) {
                                handleMoveItem(idx, 'left');
                                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(25);
                              }
                            }
                          }
                          touchStartRef.current = null;
                        }}
                        className={`group/media relative rounded-2xl overflow-hidden border bg-slate-900 shadow-sm aspect-video flex items-center justify-center cursor-grab active:cursor-grabbing transition-all ${
                          draggedIdx === idx ? 'opacity-30 scale-95 border-dashed border-blue-500' : ''
                        } ${
                          dragOverIdx === idx ? 'ring-4 ring-blue-500 ring-offset-2 border-blue-600 scale-105' : 'border-slate-200'
                        }`}
                      >
                        {file.type.startsWith('video/') ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-white p-2 relative bg-slate-950">
                            <video src={file.base64} className="w-full h-full object-cover opacity-60 pointer-events-none" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                              <Film className="w-7 h-7 text-blue-400 mb-1" />
                              <span className="text-[9px] truncate max-w-[90%] font-mono bg-black/60 px-1.5 py-0.5 rounded">{file.name}</span>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={file.base64}
                            alt={file.name}
                            className="w-full h-full object-cover group-hover/media:scale-105 transition duration-300 pointer-events-none"
                          />
                        )}

                        {/* Top-Left: Drag Handle & Touch-Friendly Move Controls */}
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 z-20">
                          <span className="bg-black/75 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-xs">
                            <GripVertical className="w-3 h-3 text-slate-300" />
                            #{idx + 1}
                          </span>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleMoveItem(idx, 'left'); }}
                              className="w-7 h-7 bg-black/75 hover:bg-blue-600 active:bg-blue-700 text-white rounded-md flex items-center justify-center transition shadow-xs cursor-pointer"
                              title="Move Left"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                          )}
                          {idx < selectedFiles.length - 1 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleMoveItem(idx, 'right'); }}
                              className="w-7 h-7 bg-black/75 hover:bg-blue-600 active:bg-blue-700 text-white rounded-md flex items-center justify-center transition shadow-xs cursor-pointer"
                              title="Move Right"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Top-Right: Always-Visible, Touch-Friendly Remove Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(idx);
                          }}
                          className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/75 hover:bg-red-600 active:bg-red-700 text-white rounded-full flex items-center justify-center shadow-md transition z-20 cursor-pointer"
                          title="Remove snap"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>

                        {/* Real-Time Eager Uploading Progress Overlay */}
                        {file.uploadStatus === 'uploading' && (
                          <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center text-white p-2 z-15 pointer-events-none">
                            <Loader2 className="w-6 h-6 text-blue-400 animate-spin mb-1" />
                            <span className="text-[11px] font-bold font-mono">{file.uploadProgress || 0}%</span>
                            <div className="w-20 bg-white/20 h-1.5 rounded-full mt-1 overflow-hidden">
                              <div className="bg-blue-500 h-full transition-all duration-200" style={{ width: `${file.uploadProgress || 0}%` }} />
                            </div>
                          </div>
                        )}

                        {/* Bottom-Left: Upload Status & Media Type Badges */}
                        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 z-10">
                          {file.uploadStatus === 'uploaded' && (
                            <span className="px-1.5 py-0.5 bg-emerald-600/90 backdrop-blur-xs text-white text-[9px] font-bold rounded flex items-center gap-0.5 shadow">
                              <Check className="w-2.5 h-2.5" /> Ready
                            </span>
                          )}
                          {file.uploadStatus === 'error' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); if (file.id) triggerBackgroundUpload(file, file.id); }}
                              className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-[9px] font-bold rounded flex items-center gap-1 shadow cursor-pointer"
                              title={file.uploadError || 'Upload failed, tap to retry'}
                            >
                              <RefreshCw className="w-2.5 h-2.5" /> Retry
                            </button>
                          )}
                          {file.type.startsWith('video/') && (
                            <span className="px-1.5 py-0.5 bg-red-600/90 text-white text-[9px] font-bold rounded uppercase">
                              Video
                            </span>
                          )}
                          {file.type === 'image/gif' && (
                            <span className="px-1.5 py-0.5 bg-purple-600/90 text-white text-[9px] font-bold rounded uppercase">
                              GIF
                            </span>
                          )}
                        </div>

                        {/* Bottom-Right: File Size Layover Badge (White text on transparent black background) */}
                        {formatFileSize(file.size || (file.base64 ? Math.round((file.base64.length * 3) / 4) : 0)) && (
                          <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono font-medium shadow pointer-events-none z-10">
                            {formatFileSize(file.size || (file.base64 ? Math.round((file.base64.length * 3) / 4) : 0))}
                          </div>
                        )}

                        {/* Hover Overlay Desktop Eye Preview Control */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition flex items-center justify-center gap-2 pointer-events-none group-hover/media:pointer-events-auto">
                          <button
                            type="button"
                            onClick={() => setPreviewMediaIndex(idx)}
                            className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-xl backdrop-blur-md transition pointer-events-auto"
                            title="Preview Full Size"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-slate-50 border border-slate-200/80 rounded-2xl text-center space-y-1">
                  <p className="text-xs font-bold text-slate-600">No media snaps attached yet</p>
                  <p className="text-[11px] text-slate-400">You can also proceed without media to create a text-only moment.</p>
                </div>
              )}
            </div>
          )}

          {/* ════════════ STEP 2: STORY DETAILS ════════════ */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Moment Title (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Sunrise Trek at Poon Hill, Finished React App..."
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl outline-hidden font-bold text-slate-800 transition"
                />
              </div>

              {/* Story Content Note */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Story / Caption Note <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">{content.length} characters</span>
                </div>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="What happened? What were you thinking, feeling or learning?"
                  rows={4}
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl outline-hidden resize-none transition font-medium text-slate-700"
                />
              </div>

              {/* Date & Bikram Sambat Selection */}
              <div className="space-y-2 p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    When Did It Happen?
                  </span>
                  
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setDateMode('AD')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                        dateMode === 'AD' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      AD (Gregorian)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMode('BS')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                        dateMode === 'BS' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      BS (Nepali)
                    </button>
                  </div>
                </div>

                {dateMode === 'AD' ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date (Gregorian)</label>
                        <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          = {currentFormBs.formattedBsNp}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={timestamp.substring(0, 10)}
                          onChange={e => handleAdDateOnlyChange(e.target.value)}
                          className="flex-1 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setQuickDate('today')}
                          className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition active:scale-95"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickDate('yesterday')}
                          className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition active:scale-95"
                        >
                          Yesterday
                        </button>
                      </div>
                    </div>

                    {/* Modern Wheel Time Picker */}
                    <ModernTimeWheelPicker
                      value={timestamp && timestamp.length >= 16 ? timestamp.substring(11, 16) : getCurrentLocalTime24()}
                      onChange={handleTimeChange}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nepali Date (BS)</label>
                        <span className="text-[10px] font-bold text-amber-800">{currentFormBs.formattedBsNp}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={formBsYear}
                          onChange={e => handleBsDateChange(parseInt(e.target.value, 10), formBsMonth, formBsDay)}
                          className="px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-amber-900 focus:border-amber-500 outline-none"
                        >
                          {getAvailableBsYears().map(y => (
                            <option key={y} value={y}>{y} BS</option>
                          ))}
                        </select>

                        <select
                          value={formBsMonth}
                          onChange={e => handleBsDateChange(formBsYear, parseInt(e.target.value, 10), formBsDay)}
                          className="px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-amber-900 focus:border-amber-500 outline-none"
                        >
                          {BS_MONTHS.map(m => (
                            <option key={m.id} value={m.id}>{m.np} ({m.en})</option>
                          ))}
                        </select>

                        <select
                          value={formBsDay}
                          onChange={e => handleBsDateChange(formBsYear, formBsMonth, parseInt(e.target.value, 10))}
                          className="px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-amber-900 focus:border-amber-500 outline-none"
                        >
                          {Array.from({ length: getMonthDays(formBsYear, formBsMonth) }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>{toNepaliDigits(d)} गते</option>
                          ))}
                        </select>
                      </div>
                      <div className="text-[10px] text-slate-500 pt-0.5">
                        Mapped Gregorian AD: <strong className="text-slate-700">{timestamp.slice(0, 10)}</strong>
                      </div>
                    </div>

                    {/* Modern Wheel Time Picker */}
                    <ModernTimeWheelPicker
                      value={timestamp && timestamp.length >= 16 ? timestamp.substring(11, 16) : getCurrentLocalTime24()}
                      onChange={handleTimeChange}
                    />
                  </div>
                )}
              </div>

              {/* Category & Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Category
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="General, Travel, Life, Work..."
                    className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white rounded-xl"
                  />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {commonCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition ${
                          category === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      <span>Tags & Topic Knowledge Pool</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenTagManager) onOpenTagManager();
                        else setShowWizardTagManager(true);
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                    >
                      Manage Tag Pool
                    </button>
                  </div>
                  <RichTagSelector
                    selectedTags={rawTags.split(',').map(t => t.trim()).filter(Boolean)}
                    onChange={(newTags) => setRawTags(newTags.join(', '))}
                    tagPool={wizardTagPool}
                    onRefreshTags={refreshWizardTagPool}
                    onOpenTagManager={onOpenTagManager || (() => setShowWizardTagManager(true))}
                    authToken={authToken}
                  />
                </div>
              </div>

            </div>
          )}

          {/* ════════════ STEP 3: LIVE PREVIEW ════════════ */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="text-center space-y-1">
                <h3 className="text-base font-extrabold text-slate-900">Review & Publish</h3>
                <p className="text-xs text-slate-500">This is how your memory will appear in your timeline feed.</p>
              </div>

              {/* Moment Preview Card */}
              <div className="p-5 rounded-3xl border border-slate-200 bg-white shadow-lg space-y-4 max-w-lg mx-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 font-extrabold text-[10px] rounded-lg uppercase">
                      {category || 'General'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[10px] rounded-md flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-700" />
                    {currentFormBs.formattedBsNp}
                  </span>
                </div>

                {/* Media Preview in Card */}
                {selectedFiles.length > 0 && (
                  <div className="rounded-2xl overflow-hidden bg-slate-950 aspect-video relative flex items-center justify-center border border-slate-100">
                    {selectedFiles[0].type.startsWith('video/') ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-white">
                        <Film className="w-10 h-10 text-blue-400 mb-1" />
                        <span className="text-xs font-mono">{selectedFiles[0].name}</span>
                      </div>
                    ) : (
                      <img
                        src={selectedFiles[0].base64}
                        alt="Preview snap"
                        className="w-full h-full object-cover"
                      />
                    )}
                    {selectedFiles.length > 1 && (
                      <span className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
                        +{selectedFiles.length - 1} more snaps
                      </span>
                    )}
                    {/* File Size Layover Badge */}
                    {formatFileSize(selectedFiles[0].size || (selectedFiles[0].base64 ? Math.round((selectedFiles[0].base64.length * 3) / 4) : 0)) && (
                      <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono font-medium px-2 py-0.5 rounded-md shadow z-10">
                        {formatFileSize(selectedFiles[0].size || (selectedFiles[0].base64 ? Math.round((selectedFiles[0].base64.length * 3) / 4) : 0))}
                      </span>
                    )}
                  </div>
                )}

                {/* Title & Content */}
                <div className="space-y-1.5">
                  {title && (
                    <h4 className="text-base font-black text-slate-900 leading-snug">
                      {title}
                    </h4>
                  )}
                  <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-normal">
                    {content || 'No story note written.'}
                  </p>
                </div>

                {/* Tags */}
                {rawTags && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {rawTags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                      <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ── Bottom Navigation & Submit Actions Bar ── */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between shrink-0">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => (prev - 1) as 1 | 2)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => (prev + 1) as 2 | 3)}
                className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95"
              >
                <span>{currentStep === 1 ? 'Next: Story Details' : 'Next: Preview Moment'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePublish}
                disabled={!content.trim()}
                className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-md active:scale-95 cursor-pointer"
              >
                {selectedFiles.some(f => f.uploadStatus === 'uploading') ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Uploading Media... Publish</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Publish Moment</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Full Screen Live Camera Modal ── */}
      {showCamera && (
        <TimelineCameraModal
          onClose={() => setShowCamera(false)}
          onCaptureSnaps={(newSnaps: SnappedPhoto[]) => {
            const mapped = newSnaps.map(snap => ({
              ...snap,
              id: (snap as any).id || `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              uploadStatus: 'pending' as const,
              uploadProgress: 0
            }));
            setSelectedFiles(prev => [...prev, ...mapped]);
            mapped.forEach(item => {
              if (item.id) triggerBackgroundUpload(item, item.id);
            });
          }}
        />
      )}

      {/* ── Quick Single-Media Lightbox Preview ── */}
      {previewMediaIndex !== null && selectedFiles[previewMediaIndex] && (
        <div 
          onClick={() => setPreviewMediaIndex(null)}
          className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="relative max-w-3xl max-h-[85vh] p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewMediaIndex(null)}
              className="absolute -top-3 -right-3 p-2 bg-slate-800 text-white rounded-full hover:bg-rose-600 transition shadow-xl"
            >
              <X className="w-5 h-5" />
            </button>
            {selectedFiles[previewMediaIndex].type.startsWith('video/') ? (
              <video
                src={selectedFiles[previewMediaIndex].base64}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/10"
              />
            ) : (
              <img
                src={selectedFiles[previewMediaIndex].base64}
                alt="Snap preview"
                className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/10"
              />
            )}
          </div>
        </div>
      )}

      {/* ── Standalone Knowledge Pool Tag Manager Modal ── */}
      {showWizardTagManager && (
        <TagManagerModal
          isOpen={showWizardTagManager}
          onClose={() => {
            setShowWizardTagManager(false);
            refreshWizardTagPool();
          }}
          tagPool={wizardTagPool}
          onRefresh={refreshWizardTagPool}
          authToken={authToken}
        />
      )}

    </div>
  );
};
