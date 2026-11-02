import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, Upload, Trash2, ArrowRight, ArrowLeft, Check, Sparkles, 
  Calendar, Eye, Image as ImageIcon, Film,
  Clock, AlertCircle, ChevronLeft, ChevronRight,
  Files, FileText, Plus, ChevronDown, GripVertical
} from 'lucide-react';
import { 
  adToBs, bsToAd, BS_MONTHS, getAvailableBsYears, getMonthDays, 
  toNepaliDigits 
} from '../utils/bikramSambat';
import { TimelineCameraModal, type SnappedPhoto } from './TimelineCameraModal';

export interface DraftMediaItem {
  name: string;
  type: string;
  base64: string;
}

export interface TimelineDraftMeta {
  id: string;
  title: string;
  content: string;
  category: string;
  rawTags: string;
  timestamp: string;
  dateMode: 'AD' | 'BS';
  formBsYear: number;
  formBsMonth: number;
  formBsDay: number;
  currentStep: 1 | 2 | 3;
  mediaCount: number;
  updatedAt: number;
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
    mediaFiles: DraftMediaItem[];
  }) => void;
  categoriesList?: string[];
  tagsList?: string[];
  initialDraftId?: string;
}

export const DRAFTS_LIST_KEY = 'shudkara_timeline_drafts_v2';
export const ACTIVE_DRAFT_ID_KEY = 'shudkara_timeline_active_draft_id_v2';
export const LEGACY_DRAFT_META_KEY = 'shudkara_timeline_draft_meta_v1';
export const IDB_NAME = 'shudkara_timeline_db';
export const IDB_STORE = 'draft_media';

// IndexedDB Helper for Large Media Drafts
export async function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMediaToDb(draftId: string, media: DraftMediaItem[]) {
  try {
    const db = await openDraftDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put({ id: `media_${draftId}`, items: media });
  } catch (e) {
    console.warn('Failed to save draft media to IndexedDB:', e);
  }
}

export async function loadMediaFromDb(draftId: string): Promise<DraftMediaItem[]> {
  try {
    const db = await openDraftDb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
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

export async function clearDraftFromDb(draftId: string) {
  try {
    const db = await openDraftDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(`media_${draftId}`);
    tx.objectStore(IDB_STORE).delete('current_draft_media');
  } catch {}
}

export async function finalizeSuccessfulDraftUpload(draftId: string) {
  try {
    await clearDraftFromDb(draftId);
    const raw = localStorage.getItem(DRAFTS_LIST_KEY);
    if (raw) {
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
    }
  } catch (e) {
    console.warn('Error clearing successful draft:', e);
  }
}

// Client-side image optimization helper for high-res photos
async function processSelectedFile(file: File): Promise<DraftMediaItem> {
  const mimeType = file.type || 'image/jpeg';
  // If video or GIF, preserve raw format
  if (mimeType.startsWith('video/') || mimeType === 'image/gif') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: mimeType, base64: reader.result as string });
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
        return { name: file.name.replace(/\.[^.]+$/, '.jpg'), type: 'image/jpeg', base64: compressedBase64 };
      }
    } catch (e) {
      console.warn('Canvas optimization fallback to original:', e);
    }
  }

  // Default raw reader
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: mimeType, base64: reader.result as string });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getStoredDrafts(): TimelineDraftMeta[] {
  try {
    const raw = localStorage.getItem(DRAFTS_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

export const TimelineWizardModal: React.FC<TimelineWizardModalProps> = ({
  onClose,
  onSubmit,
  categoriesList = [],
  tagsList = [],
  initialDraftId
}) => {
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
    const d = new Date();
    return d.toISOString().substring(0, 16);
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

  // Submission & feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load Draft by ID ───────────────────────────────────────────────────
  const loadDraftById = async (draftId: string) => {
    setHasDraftLoaded(false);
    try {
      const stored = getStoredDrafts();
      const existing = stored.find(d => d.id === draftId);
      if (existing) {
        setTitle(existing.title || '');
        setContent(existing.content || '');
        setCategory(existing.category || 'General');
        setRawTags(existing.rawTags || '');
        if (existing.timestamp) {
          setTimestamp(existing.timestamp);
          const bs = adToBs(new Date(existing.timestamp));
          setFormBsYear(existing.formBsYear || bs.year);
          setFormBsMonth(existing.formBsMonth || bs.month);
          setFormBsDay(existing.formBsDay || bs.day);
        }
        if (existing.dateMode) setDateMode(existing.dateMode);
        if (existing.currentStep) setCurrentStep(existing.currentStep);

        const mediaItems = await loadMediaFromDb(existing.id);
        setSelectedFiles(mediaItems);
      } else {
        // Check legacy v1 draft for migration
        const legacyMetaStr = localStorage.getItem(LEGACY_DRAFT_META_KEY);
        if (legacyMetaStr) {
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
        }
      }
    } catch (err) {
      console.warn('Failed to restore draft:', err);
    } finally {
      setHasDraftLoaded(true);
    }
  };

  useEffect(() => {
    loadDraftById(activeDraftId);
  }, [activeDraftId]);

  // ── Auto-Save Active Draft on Change ────────────────────────────────────
  useEffect(() => {
    if (!hasDraftLoaded || !activeDraftId) return;

    const timer = setTimeout(() => {
      const draftMeta: TimelineDraftMeta = {
        id: activeDraftId,
        title: title.trim(),
        content: content.trim(),
        category,
        rawTags,
        timestamp,
        dateMode,
        formBsYear,
        formBsMonth,
        formBsDay,
        currentStep,
        mediaCount: selectedFiles.length,
        updatedAt: Date.now()
      };

      const isMeaningful = title.trim() || content.trim() || selectedFiles.length > 0;
      if (isMeaningful) {
        setDraftsList(prev => {
          const filtered = prev.filter(d => d.id !== activeDraftId);
          const updated = [draftMeta, ...filtered];
          localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(updated));
          return updated;
        });
        localStorage.setItem(ACTIVE_DRAFT_ID_KEY, activeDraftId);
        saveMediaToDb(activeDraftId, selectedFiles);
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [title, content, category, rawTags, timestamp, dateMode, formBsYear, formBsMonth, formBsDay, selectedFiles, currentStep, hasDraftLoaded, activeDraftId]);

  // Create New Draft
  const handleCreateNewDraft = () => {
    const newId = generateDraftId();
    setTitle('');
    setContent('');
    setCategory('General');
    setRawTags('');
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
  const handleSwitchDraft = (targetId: string) => {
    if (targetId === activeDraftId) {
      setShowDraftsMenu(false);
      return;
    }
    setActiveDraftId(targetId);
    localStorage.setItem(ACTIVE_DRAFT_ID_KEY, targetId);
    setShowDraftsMenu(false);
  };

  // Delete Draft
  const handleDeleteDraft = async (targetId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this draft permanently?')) return;

    await clearDraftFromDb(targetId);
    const updated = draftsList.filter(d => d.id !== targetId);
    setDraftsList(updated);
    localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(updated));

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
    const currentTimeStr = timestamp ? timestamp.substring(11, 16) : '12:00';
    const yyyy = adDate.getFullYear();
    const mm = String(adDate.getMonth() + 1).padStart(2, '0');
    const dd = String(adDate.getDate()).padStart(2, '0');
    setTimestamp(`${yyyy}-${mm}-${dd}T${currentTimeStr}`);
  };

  const setQuickDate = (type: 'today' | 'yesterday') => {
    const d = new Date();
    if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    const isoStr = d.toISOString().substring(0, 16);
    handleAdTimestampChange(isoStr);
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

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
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
  const handlePublish = () => {
    if (!content.trim()) {
      setErrorMsg('Please write some content or note for this moment.');
      setCurrentStep(2);
      return;
    }

    const tagsArray = rawTags.split(',').map(t => t.trim()).filter(Boolean);
    onSubmit({
      draftId: activeDraftId,
      title: title.trim(),
      content: content.trim(),
      category: category.trim() || 'General',
      tags: tagsArray,
      timestamp: new Date(timestamp).toISOString(),
      mediaFiles: selectedFiles
    });
    onClose();
  };

  const currentFormBs = adToBs(timestamp);
  const commonCategories = Array.from(new Set([...categoriesList, 'General', 'Life', 'Travel', 'Work', 'Health', 'Milestone'])).slice(0, 8);
  const commonTags = tagsList.slice(0, 6);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 select-none overflow-y-auto">
      
      {/* ── Wizard Dialog Box ── */}
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative animate-in zoom-in-95 duration-200 my-auto">
        
        {/* ── Top Bar with Step Indicators & Multiple Drafts Dropdown ── */}
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between shrink-0 relative">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Document Moment
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
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95">
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

                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {draftsList.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => handleSwitchDraft(d.id)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer flex items-center justify-between transition ${
                          d.id === activeDraftId 
                            ? 'bg-blue-50/70 border-blue-300' 
                            : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {d.title || d.content?.slice(0, 30) || 'Untitled Draft'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {d.mediaCount > 0 ? `${d.mediaCount} snaps • ` : ''}{new Date(d.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteDraft(d.id, e)}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition"
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
                  className="p-5 rounded-3xl border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/80 hover:bg-blue-50/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition hover:scale-[1.02] active:scale-95 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition duration-200">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="font-extrabold text-sm text-slate-800">Browse Device Files</span>
                  <span className="text-[11px] text-slate-500 font-medium">Select photos, videos (.mp4, .webm), or GIFs</span>
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
                        key={idx}
                        draggable
                        onDragStart={e => handleDragStart(e, idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, idx)}
                        onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
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

                        {/* Drag Handle & Order Controls */}
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 z-10">
                          <span className="bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                            <GripVertical className="w-3 h-3 text-slate-300" />
                            #{idx + 1}
                          </span>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleMoveItem(idx, 'left'); }}
                              className="p-1 bg-black/70 hover:bg-black text-white rounded-md transition shadow-xs"
                              title="Move Left"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                          )}
                          {idx < selectedFiles.length - 1 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleMoveItem(idx, 'right'); }}
                              className="p-1 bg-black/70 hover:bg-black text-white rounded-md transition shadow-xs"
                              title="Move Right"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Media Type Badge */}
                        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
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

                        {/* Hover Overlay Controls */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/media:opacity-100 transition flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewMediaIndex(idx)}
                            className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-xl backdrop-blur-md transition"
                            title="Preview Full Size"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl backdrop-blur-md transition"
                            title="Remove snap"
                          >
                            <Trash2 className="w-4 h-4" />
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
                  <div className="space-y-2">
                    <input
                      type="datetime-local"
                      value={timestamp}
                      onChange={e => handleAdTimestampChange(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQuickDate('today')}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDate('yesterday')}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                      >
                        Yesterday
                      </button>
                      <span className="text-[10px] text-amber-700 ml-auto font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        = {currentFormBs.formattedBsNp}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={formBsYear}
                        onChange={e => handleBsDateChange(parseInt(e.target.value, 10), formBsMonth, formBsDay)}
                        className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-amber-900"
                      >
                        {getAvailableBsYears().map(y => (
                          <option key={y} value={y}>{y} BS</option>
                        ))}
                      </select>

                      <select
                        value={formBsMonth}
                        onChange={e => handleBsDateChange(formBsYear, parseInt(e.target.value, 10), formBsDay)}
                        className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-amber-900"
                      >
                        {BS_MONTHS.map(m => (
                          <option key={m.id} value={m.id}>{m.np} ({m.en})</option>
                        ))}
                      </select>

                      <select
                        value={formBsDay}
                        onChange={e => handleBsDateChange(formBsYear, formBsMonth, parseInt(e.target.value, 10))}
                        className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-amber-900"
                      >
                        {Array.from({ length: getMonthDays(formBsYear, formBsMonth) }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>{toNepaliDigits(d)} गते</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Mapped Gregorian AD: <strong className="text-slate-700">{timestamp.slice(0, 10)}</strong></span>
                      <span className="text-[10px] font-bold text-amber-700">{currentFormBs.formattedBsNp}</span>
                    </div>
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
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Tags (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={rawTags}
                    onChange={e => setRawTags(e.target.value)}
                    placeholder="family, nepal, mountain..."
                    className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white rounded-xl"
                  />
                  {commonTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {commonTags.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
                            if (!tags.includes(tag)) {
                              setRawTags(tags.length > 0 ? `${rawTags}, ${tag}` : tag);
                            }
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
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
                      <span className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        +{selectedFiles.length - 1} more snaps
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
                className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-md active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Publish Moment</span>
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
            setSelectedFiles(prev => [...prev, ...newSnaps]);
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

    </div>
  );
};
