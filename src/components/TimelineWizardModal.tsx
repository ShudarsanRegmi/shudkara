import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, Upload, Trash2, ArrowRight, ArrowLeft, Check, Sparkles, 
  Calendar, Eye, Image as ImageIcon, Video, Film,
  Clock, RotateCcw, AlertCircle, Loader2, ChevronLeft, ChevronRight,
  Files, FileText, Plus, ChevronDown
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
    title: string;
    content: string;
    category: string;
    tags: string[];
    timestamp: string;
    mediaFiles: DraftMediaItem[];
  }) => Promise<boolean>;
  categoriesList?: string[];
  tagsList?: string[];
}

const DRAFTS_LIST_KEY = 'shudkara_timeline_drafts_v2';
const ACTIVE_DRAFT_ID_KEY = 'shudkara_timeline_active_draft_id_v2';
const LEGACY_DRAFT_META_KEY = 'shudkara_timeline_draft_meta_v1';
const IDB_NAME = 'shudkara_timeline_db';
const IDB_STORE = 'draft_media';

// IndexedDB Helper for Large Media Drafts
async function openDraftDb(): Promise<IDBDatabase> {
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

async function saveMediaToDb(draftId: string, media: DraftMediaItem[]) {
  try {
    const db = await openDraftDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put({ id: `media_${draftId}`, items: media });
  } catch (e) {
    console.warn('Failed to save draft media to IndexedDB:', e);
  }
}

async function loadMediaFromDb(draftId: string): Promise<DraftMediaItem[]> {
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

async function clearDraftFromDb(draftId: string) {
  try {
    const db = await openDraftDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(`media_${draftId}`);
    tx.objectStore(IDB_STORE).delete('current_draft_media');
  } catch {}
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
  tagsList = []
}) => {
  // Wizard Steps: 1 = Media Studio, 2 = Story Details, 3 = Live Feed Preview
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Drafts state
  const [draftsList, setDraftsList] = useState<TimelineDraftMeta[]>(() => getStoredDrafts());
  const [activeDraftId, setActiveDraftId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_DRAFT_ID_KEY) || generateDraftId();
  });
  const [showDraftsMenu, setShowDraftsMenu] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [rawTags, setRawTags] = useState('');
  const [timestamp, setTimestamp] = useState(new Date().toISOString().substring(0, 16));
  const [dateMode, setDateMode] = useState<'AD' | 'BS'>('AD');

  // BS state
  const initialBs = adToBs(new Date());
  const [formBsYear, setFormBsYear] = useState<number>(initialBs.year);
  const [formBsMonth, setFormBsMonth] = useState<number>(initialBs.month);
  const [formBsDay, setFormBsDay] = useState<number>(initialBs.day);

  // Media
  const [selectedFiles, setSelectedFiles] = useState<DraftMediaItem[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [previewMediaIndex, setPreviewMediaIndex] = useState<number | null>(null);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasDraftLoaded, setHasDraftLoaded] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Preview step snap page index
  const [previewSnapIndex, setPreviewSnapIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load Draft on Mount or ID Change ─────────────────────────────────────
  const loadDraftById = async (targetDraftId: string) => {
    setHasDraftLoaded(false);
    try {
      const stored = getStoredDrafts();
      const existing = stored.find(d => d.id === targetDraftId);

      if (existing) {
        setTitle(existing.title || '');
        setContent(existing.content || '');
        setCategory(existing.category || 'General');
        setRawTags(existing.rawTags || '');
        if (existing.timestamp) {
          setTimestamp(existing.timestamp);
          const bs = adToBs(new Date(existing.timestamp));
          setFormBsYear(bs.year);
          setFormBsMonth(bs.month);
          setFormBsDay(bs.day);
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

      // Only save non-empty drafts
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

  // Handle Create New Draft
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

  // Handle Switch Draft
  const handleSwitchDraft = (targetId: string) => {
    if (targetId === activeDraftId) {
      setShowDraftsMenu(false);
      return;
    }
    setActiveDraftId(targetId);
    localStorage.setItem(ACTIVE_DRAFT_ID_KEY, targetId);
    setShowDraftsMenu(false);
  };

  // Handle Delete Draft
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

  // Handle Discard Current Draft
  const handleDiscardCurrentDraft = async () => {
    if (!window.confirm('Discard current draft? All unsaved text and attached snaps for this draft will be cleared.')) return;
    await handleDeleteDraft(activeDraftId);
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

  // File Upload Handlers
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFiles(prev => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            base64: reader.result as string
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (previewMediaIndex === index) setPreviewMediaIndex(null);
  };

  // Publish Moment
  const handlePublish = async () => {
    if (!content.trim()) {
      setErrorMsg('Please write some content or note for this moment.');
      setCurrentStep(2);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const tagsArray = rawTags.split(',').map(t => t.trim()).filter(Boolean);
      const success = await onSubmit({
        title: title.trim(),
        content: content.trim(),
        category: category.trim() || 'General',
        tags: tagsArray,
        timestamp: new Date(timestamp).toISOString(),
        mediaFiles: selectedFiles
      });

      if (success) {
        await clearDraftFromDb(activeDraftId);
        const updated = draftsList.filter(d => d.id !== activeDraftId);
        setDraftsList(updated);
        localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(updated));
        if (updated.length > 0) {
          localStorage.setItem(ACTIVE_DRAFT_ID_KEY, updated[0].id);
        } else {
          localStorage.removeItem(ACTIVE_DRAFT_ID_KEY);
        }
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish moment.');
    } finally {
      setSubmitting(false);
    }
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

                  {draftsList.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No drafts saved yet. As you write, drafts are automatically saved here.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                      {draftsList.map(d => {
                        const isActive = d.id === activeDraftId;
                        return (
                          <div
                            key={d.id}
                            onClick={() => handleSwitchDraft(d.id)}
                            className={`p-2.5 rounded-xl cursor-pointer transition flex items-start justify-between gap-2 ${
                              isActive ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                <span className={`text-xs font-bold truncate ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                                  {d.title || d.content.substring(0, 24) || 'Untitled Draft'}
                                </span>
                                {isActive && (
                                  <span className="text-[9px] px-1 rounded bg-blue-200 text-blue-800 font-extrabold">Active</span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5 pl-5">
                                {d.content || 'No text content yet'}
                              </p>
                              <div className="flex items-center gap-2 pl-5 text-[10px] text-slate-400 mt-1">
                                {d.mediaCount > 0 && <span>📸 {d.mediaCount} snap(s)</span>}
                                <span>•</span>
                                <span>{new Date(d.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteDraft(d.id, e)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                              title="Delete this draft"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Discard current draft button */}
            {(title || content || selectedFiles.length > 0) && (
              <button
                type="button"
                onClick={handleDiscardCurrentDraft}
                className="px-2.5 py-1 text-slate-400 hover:text-red-600 text-xs font-bold transition flex items-center gap-1"
                title="Discard current draft"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Discard</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Progress Step Ribbon ── */}
        <div className="grid grid-cols-3 border-b border-slate-100 bg-white text-xs font-bold text-center shrink-0">
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
            <span>Snaps & Media</span>
            {selectedFiles.length > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px]">
                {selectedFiles.length}
              </span>
            )}
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
                <h3 className="text-base font-extrabold text-slate-900">Attach Photos or Live Snaps</h3>
                <p className="text-xs text-slate-500">Capture moments with full-screen camera or upload from your device gallery.</p>
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
                  <span className="text-[11px] text-slate-500 font-medium">Select images or video clips</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Visual Uploaded Media Gallery */}
              {selectedFiles.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      Attached Snaps ({selectedFiles.length})
                    </span>
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
                        className="group/media relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm aspect-video flex items-center justify-center"
                      >
                        {file.type.startsWith('video/') ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-white p-2">
                            <Film className="w-7 h-7 text-blue-400 mb-1" />
                            <span className="text-[10px] truncate max-w-full font-mono">{file.name}</span>
                          </div>
                        ) : (
                          <img
                            src={file.base64}
                            alt={file.name}
                            className="w-full h-full object-cover group-hover/media:scale-105 transition duration-300"
                          />
                        )}

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

                        {/* Index badge */}
                        <span className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                          #{idx + 1}
                        </span>
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
              
              {/* Dual Calendar Mode Selector */}
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-extrabold text-slate-700">Calendar System:</span>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setDateMode('AD')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      dateMode === 'AD' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Gregorian (AD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateMode('BS')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      dateMode === 'BS' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bikram Sambat (BS)
                  </button>
                </div>
              </div>

              {/* Quick Date Presets & Date Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Date & Time
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQuickDate('today')}
                      className="px-2.5 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 transition"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDate('yesterday')}
                      className="px-2.5 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 transition"
                    >
                      Yesterday
                    </button>
                  </div>
                </div>

                {dateMode === 'AD' ? (
                  <div className="space-y-1.5">
                    <input
                      type="datetime-local"
                      value={timestamp}
                      onChange={e => handleAdTimestampChange(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium"
                      required
                    />
                    <div className="text-[11px] text-amber-800 font-semibold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/80 flex items-center justify-between">
                      <span>Nepali BS Equivalent:</span>
                      <span className="font-extrabold">{currentFormBs.formattedBsNp} ({currentFormBs.formattedBs})</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={formBsYear}
                        onChange={e => handleBsDateChange(parseInt(e.target.value, 10), formBsMonth, formBsDay)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-amber-50/50 text-slate-800 focus:outline-none"
                      >
                        {getAvailableBsYears().map(y => (
                          <option key={y} value={y}>{y} BS ({toNepaliDigits(y)})</option>
                        ))}
                      </select>
                      <select
                        value={formBsMonth}
                        onChange={e => handleBsDateChange(formBsYear, parseInt(e.target.value, 10), formBsDay)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-amber-50/50 text-slate-800 focus:outline-none"
                      >
                        {BS_MONTHS.map(m => (
                          <option key={m.id} value={m.id}>{m.np} ({m.en})</option>
                        ))}
                      </select>
                      <select
                        value={formBsDay}
                        onChange={e => handleBsDateChange(formBsYear, formBsMonth, parseInt(e.target.value, 10))}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-amber-50/50 text-slate-800 focus:outline-none"
                      >
                        {Array.from({ length: getMonthDays(formBsYear, formBsMonth) }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>{d} गते ({toNepaliDigits(d)})</option>
                        ))}
                      </select>
                    </div>
                    <div className="text-[11px] text-blue-800 font-semibold bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200/80 flex items-center justify-between">
                      <span>AD Equivalent:</span>
                      <span className="font-extrabold">{new Date(timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Title (Optional) */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                  Moment Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sunset hike with friends, First day at new job"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium"
                />
              </div>

              {/* Story Content / Caption */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Story / Caption *
                  </label>
                  <span className="text-[10px] text-slate-400">{content.length} characters</span>
                </div>
                <textarea
                  rows={4}
                  required
                  placeholder="Share what happened, key memories, or reflections..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 resize-y font-sans leading-relaxed"
                />
              </div>

              {/* Category & Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Category
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="e.g. Travel, Life"
                    className="w-full px-4 py-2 border border-slate-200 rounded-2xl text-xs bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {commonCategories.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition ${
                          category === c ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={rawTags}
                    onChange={e => setRawTags(e.target.value)}
                    placeholder="e.g. vacation, family, nature"
                    className="w-full px-4 py-2 border border-slate-200 rounded-2xl text-xs bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {commonTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {commonTags.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            const cur = rawTags.split(',').map(x => x.trim()).filter(Boolean);
                            if (!cur.includes(t)) {
                              setRawTags(cur.concat(t).join(', '));
                            }
                          }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════════ STEP 3: LIVE FEED PREVIEW ════════════ */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-blue-600" />
                  Feed Card Preview
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  How this moment will appear in your timeline
                </span>
              </div>

              {/* Realistic Post Preview Card */}
              <div className="bg-white border-2 border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4">
                
                {/* Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 font-extrabold uppercase tracking-wider rounded-lg text-[9px]">
                      {category || 'General'}
                    </span>
                    <span className="text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100/70 border border-amber-300 text-amber-900 font-bold text-[11px] flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-600" />
                      <span>{currentFormBs.formattedBsNp}</span>
                    </span>
                  </div>
                </div>

                {/* Media Page-Turner / Stack Preview */}
                {selectedFiles.length > 0 && (
                  <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center border border-slate-800 shadow-inner group">
                    {selectedFiles[previewSnapIndex]?.type.startsWith('video/') ? (
                      <div className="flex flex-col items-center justify-center text-white">
                        <Video className="w-10 h-10 text-blue-400 mb-2" />
                        <span className="text-xs font-mono">{selectedFiles[previewSnapIndex]?.name}</span>
                      </div>
                    ) : (
                      <img
                        src={selectedFiles[previewSnapIndex]?.base64}
                        alt="Preview snap"
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* Page indicator pill */}
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[11px] font-bold">
                      Snap {previewSnapIndex + 1} of {selectedFiles.length}
                    </div>

                    {/* Horizontal Page Turner Arrows */}
                    {selectedFiles.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewSnapIndex(prev => (prev - 1 + selectedFiles.length) % selectedFiles.length)}
                          className="absolute left-2 p-2 bg-black/50 hover:bg-black/75 text-white rounded-full transition"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewSnapIndex(prev => (prev + 1) % selectedFiles.length)}
                          className="absolute right-2 p-2 bg-black/50 hover:bg-black/75 text-white rounded-full transition"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}

                    {/* Dot indicators */}
                    {selectedFiles.length > 1 && (
                      <div className="absolute bottom-2.5 flex items-center gap-1.5">
                        {selectedFiles.map((_, dotIdx) => (
                          <div
                            key={dotIdx}
                            className={`w-2 h-2 rounded-full transition-all ${
                              dotIdx === previewSnapIndex ? 'w-4 bg-white' : 'bg-white/50'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Title & Content */}
                <div className="space-y-1.5">
                  {title && <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">{title}</h3>}
                  <p className="text-sm text-slate-600 leading-relaxed font-sans whitespace-pre-wrap">
                    {content || <span className="italic text-slate-400">No caption written yet.</span>}
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
                disabled={submitting || !content.trim()}
                className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-md active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading to Drive & Saving...</span>
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
            <img
              src={selectedFiles[previewMediaIndex].base64}
              alt="Snap preview"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}

    </div>
  );
};
