import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Trash2, Edit2, 
  Film, AlertCircle, 
  Loader2, Sparkles, BookOpen, Clock, Calendar,
  ChevronLeft, ChevronRight, Layers, List, SlidersHorizontal,
  Camera, X, RefreshCw, Share2, Check, MessageCircle, ExternalLink
} from 'lucide-react';
import { 
  adToBs, bsToAd, BS_MONTHS, getAvailableBsYears, getMonthDays, 
  type BikramSambatDate 
} from '../utils/bikramSambat';
import { MediaLightboxModal, type LightboxMediaItem } from './MediaLightboxModal';
import { 
  TimelineWizardModal, type DraftMediaItem, type TimelineDraftMeta,
  finalizeSuccessfulDraftUpload, loadMediaFromDb, saveFullDraftToDb, 
  markDraftFailed, listAllDraftsFromDb 
} from './TimelineWizardModal';
import { TimelineSidebar } from './TimelineSidebar';
import { enqueueOfflineAction, isDeviceOnline } from '../utils/offlineSync';
import { MediaCollageGrid } from './MediaCollageGrid';
import { FBReactionSummary } from './FacebookReactions';

export interface MediaItem {
  googleDriveId: string;
  fileName: string;
  mimeType: string;
  viewUrl: string;
  thumbnailUrl: string;
}

export interface PostReaction {
  emoji: string;
  name: string;
  createdAt: string;
}

export interface PostComment {
  id: string;
  name: string;
  text: string;
  createdAt: string;
}

export interface Post {
  _id: string;
  title?: string;
  content: string;
  timestamp: string;
  createdAt: string;
  clearanceLevel?: number;
  clearanceTier?: 'prakata' | 'guhya' | 'nigudha';
  category: string;
  tags: string[];
  media?: MediaItem[];
  reactions?: PostReaction[];
  comments?: PostComment[];
}

interface LifetimeLineProps {
  authToken?: string | null;
}

// Robust Local Day Date Key Calculation (Fixes Timezone Shift Bug)
export function getLocalDateKey(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'unknown';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface DayGroup {
  dateKey: string;
  adDate: Date;
  bsDate: BikramSambatDate;
  posts: Post[];
  totalSnaps: number;
}

export interface ActiveUploadState {
  draftId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  timestamp: string;
  clearanceLevel?: number;
  clearanceTier?: 'prakata' | 'guhya' | 'nigudha';
  mediaFiles: DraftMediaItem[];
  status: 'uploading' | 'completed' | 'error';
  stepText: string;
  progressPercent: number;
  currentIndex: number;
  totalMedia: number;
  errorMsg?: string;
  createdPostId?: string;
  isMinimized?: boolean;
}

export const LifetimeLine: React.FC<LifetimeLineProps> = ({ authToken }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Background Upload Queue & Floating Progress Bar State
  const [activeUpload, setActiveUpload] = useState<ActiveUploadState | null>(null);
  const [shareToastPostId, setShareToastPostId] = useState<string | null>(null);
  
  // ── Steganographic Clearance State & Secret Cadence Handlers ──
  const [clearanceToken, setClearanceToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('shudkara_clearance_token');
    } catch {
      return null;
    }
  });
  const [clearanceLevel, setClearanceLevel] = useState<0 | 1 | 2>(0);
  const [clearanceExpiresAt, setClearanceExpiresAt] = useState<Date | null>(null);

  // Immediate 100ms background flash feedback state
  const [flashBg, setFlashBg] = useState<'amber' | 'rose' | 'reset' | null>(null);

  // Steganographic Modal & Trigger States
  const [showGuhyaModal, setShowGuhyaModal] = useState(false);
  const [guhyaInput, setGuhyaInput] = useState('');
  const [guhyaLoading, setGuhyaLoading] = useState(false);
  const [guhyaError, setGuhyaError] = useState('');
  const [showNigudhaModal, setShowNigudhaModal] = useState(false);
  const [nigudhaLoading, setNigudhaLoading] = useState(false);
  const [nigudhaError, setNigudhaError] = useState('');

  // Cadence click tracking: sliding timestamp windows for smooth, reliable tapping
  const headerClicksRef = useRef<number[]>([]);
  const resetClicksRef = useRef<number[]>([]);
  const modalOpenedAtRef = useRef<number>(0);
  const lastEscPressRef = useRef<number>(0);

  const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
    const headers: Record<string, string> = {
      'X-Session-Token': authToken || '',
      ...extraHeaders
    };
    if (clearanceToken) {
      headers['X-Clearance-Token'] = clearanceToken;
    }
    return headers;
  };
  
  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedBsYear, setSelectedBsYear] = useState('');
  const [selectedBsMonth, setSelectedBsMonth] = useState('');

  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [limit] = useState(15);
  const [skip, setSkip] = useState(0);

  // Sidebar Drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Social Wizard Modal State & Preserved Drafts
  const [showWizard, setShowWizard] = useState(false);
  const [pendingDrafts, setPendingDrafts] = useState<TimelineDraftMeta[]>([]);
  const [selectedDraftIdToOpen, setSelectedDraftIdToOpen] = useState<string | undefined>(undefined);

  const refreshPendingDrafts = async () => {
    try {
      const drafts = await listAllDraftsFromDb();
      setPendingDrafts(drafts);
    } catch {}
  };

  useEffect(() => {
    refreshPendingDrafts();
    window.addEventListener('shudkara:drafts-updated', refreshPendingDrafts);
    window.addEventListener('shudkara:draft-finalized', refreshPendingDrafts);
    return () => {
      window.removeEventListener('shudkara:drafts-updated', refreshPendingDrafts);
      window.removeEventListener('shudkara:draft-finalized', refreshPendingDrafts);
    };
  }, []);

  // ── Steganographic Clearance Lifecycle & Lease Verification ──
  useEffect(() => {
    if (!clearanceToken || !authToken) {
      setClearanceLevel(0);
      return;
    }
    fetch('/api/timeline/clearance/status', {
      headers: { 'X-Session-Token': authToken, 'X-Clearance-Token': clearanceToken }
    })
      .then(res => res.json())
      .then(data => {
        if (data.active) {
          setClearanceLevel(data.level || 0);
          if (data.expiresAt) setClearanceExpiresAt(new Date(data.expiresAt));
        } else {
          sessionStorage.removeItem('shudkara_clearance_token');
          setClearanceToken(null);
          setClearanceLevel(0);
        }
      })
      .catch(() => {});
  }, [clearanceToken, authToken]);

  // Panic Conceal: Instantly revokes elevated clearance and purges memory
  const handlePanicConceal = async () => {
    if (clearanceToken && authToken) {
      fetch('/api/timeline/clearance/lock', {
        method: 'POST',
        headers: { 'X-Session-Token': authToken, 'X-Clearance-Token': clearanceToken }
      }).catch(() => {});
    }
    try {
      sessionStorage.removeItem('shudkara_clearance_token');
    } catch {}
    setClearanceToken(null);
    setClearanceLevel(0);
    setClearanceExpiresAt(null);
    setShowGuhyaModal(false);
    setGuhyaInput('');
    setGuhyaError('');
    // Instant DOM & in-memory purge
    setPosts(prev => prev.filter(p => !p.clearanceLevel || p.clearanceLevel === 0));
    fetchPosts(true);
    fetchFilterMetadata();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([60, 40, 60]);
  };

  // Check 15-minute lease expiry every 10 seconds
  useEffect(() => {
    if (clearanceLevel === 0 || !clearanceExpiresAt) return;
    const interval = setInterval(() => {
      if (Date.now() >= clearanceExpiresAt.getTime()) {
        handlePanicConceal();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [clearanceLevel, clearanceExpiresAt]);

  // Double-Escape key listener for Instant Panic Conceal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const now = Date.now();
        if (now - lastEscPressRef.current < 500) {
          handlePanicConceal();
        }
        lastEscPressRef.current = now;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearanceToken, authToken]);

  // Header Cadence Click: 5 taps within sliding 2.0s window triggers sequential upgrade
  // Level 0 -> Level 1 (Guhya TOTP), Level 1 -> Level 2 (Nigudha Biometrics)
  const handleHeaderCadenceClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Prevent accidental clicks if modal is already open
    if (showGuhyaModal || showNigudhaModal) return;

    const now = Date.now();
    // Keep clicks occurring within the last 2000ms
    const recent = headerClicksRef.current.filter(t => now - t < 2000);
    recent.push(now);
    headerClicksRef.current = recent;

    if (recent.length >= 5) {
      headerClicksRef.current = [];
      modalOpenedAtRef.current = now;

      if (clearanceLevel === 0) {
        // Upgrade from Level 0 to Level 1 (Guhya TOTP)
        setFlashBg('amber');
        setTimeout(() => setFlashBg(null), 100);
        setShowGuhyaModal(true);
        setGuhyaError('');
        setGuhyaInput('');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([40, 30, 40]);
      } else if (clearanceLevel === 1) {
        // Upgrade from Level 1 to Level 2 (Nigudha Biometrics)
        setFlashBg('rose');
        setTimeout(() => setFlashBg(null), 100);
        setShowNigudhaModal(true);
        setNigudhaError('');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([50, 40, 50, 40, 80]);
      }
    }
  };

  // Center Empty Space Click: 3 consecutive taps within 1500ms resets back to Level 0 (Prakata)
  const handleResetCadenceClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const now = Date.now();
    const recent = resetClicksRef.current.filter(t => now - t < 1500);
    recent.push(now);
    resetClicksRef.current = recent;

    if (recent.length >= 3) {
      resetClicksRef.current = [];
      // Immediate 100ms background flash feedback
      setFlashBg('reset');
      setTimeout(() => setFlashBg(null), 100);
      handlePanicConceal();
    }
  };

  // Submit 6-digit TOTP code for Guhya clearance
  const submitGuhyaCode = async (codeToVerify?: string) => {
    const code = (codeToVerify || guhyaInput).trim();
    if (!code || code.length < 6 || !authToken) return;

    setGuhyaLoading(true);
    setGuhyaError('');
    try {
      const res = await fetch('/api/timeline/clearance/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': authToken },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (res.ok && data.success && data.clearanceToken) {
        try {
          sessionStorage.setItem('shudkara_clearance_token', data.clearanceToken);
        } catch {}
        setClearanceToken(data.clearanceToken);
        setClearanceLevel(1);
        if (data.expiresAt) setClearanceExpiresAt(new Date(data.expiresAt));
        setShowGuhyaModal(false);
        setGuhyaInput('');
        fetchPosts(true);
        fetchFilterMetadata();
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([50, 100]);
      } else {
        setGuhyaError(data.error || 'Authentication rejected.');
        setGuhyaInput('');
      }
    } catch {
      setGuhyaError('Verification connection failed.');
    } finally {
      setGuhyaLoading(false);
    }
  };

  // WebAuthn Passkey Helper Functions
  function bufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlToBuffer(base64url: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return buffer;
  }

  // Execute WebAuthn hardware biometric / phone passkey authentication
  const executeBiometricAuth = async () => {
    if (!authToken) return;
    if (typeof window === 'undefined' || !window.navigator?.credentials) {
      setNigudhaError('WebAuthn is not supported in this browser.');
      return;
    }

    setNigudhaLoading(true);
    setNigudhaError('');

    try {
      const challengeRes = await fetch('/api/timeline/clearance/biometric/auth-challenge', {
        method: 'POST',
        headers: { 'X-Session-Token': authToken }
      });
      if (!challengeRes.ok) {
        throw new Error('Failed to obtain challenge from server.');
      }
      const challengeData = await challengeRes.json();
      const challengeBuffer = base64UrlToBuffer(challengeData.challenge);

      if (!challengeData.hasRegisteredPasskeys) {
        // First-time setup: Register passkey via Phone QR or local hardware sensor
        const regChallengeRes = await fetch('/api/timeline/clearance/biometric/register-challenge', {
          method: 'POST',
          headers: { 'X-Session-Token': authToken }
        });
        const regData = await regChallengeRes.json();
        const regChallengeBuffer = base64UrlToBuffer(regData.challenge);
        const userIdBuffer = new TextEncoder().encode('shudkara-owner').buffer as ArrayBuffer;

        const credential = await navigator.credentials.create({
          publicKey: {
            challenge: regChallengeBuffer,
            rp: {
              name: 'Shudkara Timeline'
            },
            user: {
              id: userIdBuffer,
              name: 'shudkara-owner',
              displayName: 'Shudkara Owner'
            },
            pubKeyCredParams: [
              { alg: -7, type: 'public-key' },  // ES256
              { alg: -257, type: 'public-key' } // RS256
            ],
            authenticatorSelection: {
              userVerification: 'preferred'
            },
            timeout: 60000
          }
        }) as PublicKeyCredential;

        if (credential) {
          const response = credential.response as AuthenticatorAttestationResponse;
          const verifyRes = await fetch('/api/timeline/clearance/biometric/verify-registration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Session-Token': authToken },
            body: JSON.stringify({
              id: credential.id,
              rawId: bufferToBase64Url(credential.rawId),
              type: credential.type,
              response: {
                clientDataJSON: bufferToBase64Url(response.clientDataJSON),
                attestationObject: bufferToBase64Url(response.attestationObject),
                transports: response.getTransports ? response.getTransports() : undefined
              }
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.success && verifyData.clearanceToken) {
            try { sessionStorage.setItem('shudkara_clearance_token', verifyData.clearanceToken); } catch {}
            setClearanceToken(verifyData.clearanceToken);
            setClearanceLevel(2);
            if (verifyData.expiresAt) setClearanceExpiresAt(new Date(verifyData.expiresAt));
            setShowNigudhaModal(false);
            fetchPosts(true);
            fetchFilterMetadata();
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([40, 40, 100]);
            return;
          } else {
            throw new Error(verifyData.error || 'Passkey registration rejected.');
          }
        }
      }

      // Existing passkeys registered: authenticate
      const allowCreds = (challengeData.allowCredentials || []).map((c: any) => ({
        id: base64UrlToBuffer(c.id),
        type: c.type || 'public-key',
        transports: c.transports
      }));

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: challengeBuffer,
          allowCredentials: allowCreds.length > 0 ? allowCreds : undefined,
          userVerification: 'preferred',
          timeout: 60000
        }
      }) as PublicKeyCredential;

      if (credential) {
        const response = credential.response as AuthenticatorAssertionResponse;
        const verifyRes = await fetch('/api/timeline/clearance/biometric/verify-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': authToken },
          body: JSON.stringify({
            id: credential.id,
            rawId: bufferToBase64Url(credential.rawId),
            type: credential.type,
            response: {
              clientDataJSON: bufferToBase64Url(response.clientDataJSON),
              authenticatorData: bufferToBase64Url(response.authenticatorData),
              signature: bufferToBase64Url(response.signature),
              userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null
            }
          })
        });
        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.success && verifyData.clearanceToken) {
          try { sessionStorage.setItem('shudkara_clearance_token', verifyData.clearanceToken); } catch {}
          setClearanceToken(verifyData.clearanceToken);
          setClearanceLevel(2);
          if (verifyData.expiresAt) setClearanceExpiresAt(new Date(verifyData.expiresAt));
          setShowNigudhaModal(false);
          fetchPosts(true);
          fetchFilterMetadata();
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([40, 40, 100]);
        } else {
          throw new Error(verifyData.error || 'Biometric authentication rejected.');
        }
      }
    } catch (err: any) {
      console.warn('Biometric auth notice:', err);
      if (err.name === 'NotAllowedError') {
        setNigudhaError('Authentication cancelled or timed out.');
      } else if (err.name === 'SecurityError') {
        setNigudhaError('Security origin mismatch. Ensure HTTPS or localhost is used.');
      } else {
        setNigudhaError(err.message || 'Biometric hardware unavailable.');
      }
    } finally {
      setNigudhaLoading(false);
    }
  };

  // Editing state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editRawTags, setEditRawTags] = useState('');
  const [editTimestamp, setEditTimestamp] = useState('');
  const [editDateMode, setEditDateMode] = useState<'AD' | 'BS'>('AD');
  const [editBsYear, setEditBsYear] = useState<number>(2083);
  const [editBsMonth, setEditBsMonth] = useState<number>(1);
  const [editBsDay, setEditBsDay] = useState<number>(1);
  const [editExistingMedia, setEditExistingMedia] = useState<MediaItem[]>([]);
  const [editRemovedMediaIds, setEditRemovedMediaIds] = useState<string[]>([]);
  const [editNewMedia, setEditNewMedia] = useState<DraftMediaItem[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [syncing, setSyncing] = useState(false);

  // Media Lightbox
  const [lightboxItems, setLightboxItems] = useState<LightboxMediaItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  // Day Stacking Deck: active page index for each day group
  const [dayPageIndices, setDayPageIndices] = useState<Record<string, number>>({});
  // Inner moment photo indices for moments with multiple photos
  const [momentPhotoIndices, setMomentPhotoIndices] = useState<Record<string, number>>({});
  // View mode toggle per day: 'deck' (stacked page-turner) vs 'expanded' (list)
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  // Global deck mode toggle (Stored in state and easily configured via Sidebar)
  const [globalDeckMode, setGlobalDeckMode] = useState<boolean>(true);

  // Streaks Integration State (Persisted in localStorage)
  const [showStreaksMoments, setShowStreaksMoments] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shudkara_timeline_show_streaks') === 'true';
    } catch {
      return false;
    }
  });
  const [streaksPosts, setStreaksPosts] = useState<Post[]>([]);

  const handleToggleShowStreaksMoments = () => {
    setShowStreaksMoments(prev => {
      const next = !prev;
      try {
        localStorage.setItem('shudkara_timeline_show_streaks', String(next));
      } catch {}
      return next;
    });
  };

  // Fetch Streaks Moments when enabled
  useEffect(() => {
    if (showStreaksMoments) {
      fetch('/api/streaks')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && Array.isArray(data.streaks)) {
            const converted: Post[] = [];
            data.streaks.forEach((streak: any) => {
              if (Array.isArray(streak.checkIns)) {
                streak.checkIns.forEach((checkIn: any) => {
                  const photos = Array.isArray(checkIn.photos) && checkIn.photos.length > 0
                    ? checkIn.photos
                    : checkIn.photoUrl
                    ? [checkIn.photoUrl]
                    : [];

                  if (photos.length > 0) {
                    converted.push({
                      _id: `streak_${streak.id}_${checkIn.date}`,
                      title: `🔥 ${streak.title}${checkIn.title ? `: ${checkIn.title}` : ''}`,
                      content: checkIn.notes || `Daily photo proof check-in for ${streak.title}`,
                      timestamp: checkIn.timestamp || `${checkIn.date}T12:00:00Z`,
                      createdAt: checkIn.timestamp || `${checkIn.date}T12:00:00Z`,
                      category: 'Streaks',
                      tags: ['Streak', streak.category || 'Habit'],
                      media: photos.map((url: string, idx: number) => ({
                        googleDriveId: `streak_${checkIn.id}_${idx}`,
                        fileName: `streak_${checkIn.date}_${idx}.jpg`,
                        mimeType: 'image/jpeg',
                        viewUrl: url,
                        thumbnailUrl: url
                      }))
                    });
                  }
                });
              }
            });
            setStreaksPosts(converted);
          }
        })
        .catch(err => console.error('Failed to load streaks moments for timeline:', err));
    } else {
      setStreaksPosts([]);
    }
  }, [showStreaksMoments]);

  // Auto-sync listener for offline timeline moments
  useEffect(() => {
    const handleActionSynced = async (e: any) => {
      const action = e.detail?.action;
      const responseData = e.detail?.response;
      if (action && action.subapp === 'timeline' && action.body?.draftId) {
        const draftId = action.body.draftId;
        const postId = responseData?.postId;

        if (postId) {
          let mediaError: string | null = null;
          try {
            const mediaItems = await loadMediaFromDb(draftId);
            if (mediaItems && mediaItems.length > 0) {
              for (const file of mediaItems) {
                await uploadMediaFileWithProgress(postId, file, authToken || '');
              }
            }
          } catch (err: any) {
            mediaError = err?.message || 'Network glitch uploading snaps';
          }

          if (mediaError) {
            // NEVER lose draft! Mark as failed and retain all snaps safely in IndexedDB
            await markDraftFailed(draftId, mediaError);
          } else {
            // Only after the server has accepted the post and processed media do we retire the draft
            await finalizeSuccessfulDraftUpload(draftId);
          }
          fetchPosts(true);
          fetchFilterMetadata();
          refreshPendingDrafts();
        }
      }
    };

    const handleActionFailed = async (e: any) => {
      const action = e.detail?.action;
      const errorMsg = e.detail?.error || 'Sync failed';
      if (action && action.subapp === 'timeline' && action.body?.draftId) {
        await markDraftFailed(action.body.draftId, errorMsg);
        refreshPendingDrafts();
      }
    };

    window.addEventListener('shudkara:action-synced', handleActionSynced);
    window.addEventListener('shudkara:action-sync-failed', handleActionFailed);
    return () => {
      window.removeEventListener('shudkara:action-synced', handleActionSynced);
      window.removeEventListener('shudkara:action-sync-failed', handleActionFailed);
    };
  }, [authToken]);

  // Infinite Scroll / Lazy Load Sentinel Ref
  const observerTargetRef = useRef<HTMLDivElement>(null);

  // Sync Google Drive
  const handleSyncDrive = async () => {
    if (!authToken || syncing) return;
    setSyncing(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/timeline/sync-drive', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Sync successful');
        fetchPosts(true);
        fetchFilterMetadata();
      } else {
        setErrorMsg(data.details ? `${data.error} (${data.details})` : (data.error || 'Failed to sync Google Drive.'));
      }
    } catch {
      setErrorMsg('Network error occurred during Google Drive sync.');
    } finally {
      setSyncing(false);
    }
  };

  // Fetch filter metadata
  const fetchFilterMetadata = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/timeline/tags', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setTags(data.tags || []);
      }
    } catch {}
  };

  // Fetch posts with pagination
  const fetchPosts = async (reset = false) => {
    if (!authToken) return;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setErrorMsg('');
    try {
      const currentSkip = reset ? 0 : skip;
      const url = new URL('/api/timeline', window.location.origin);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('skip', String(currentSkip));
      if (search) url.searchParams.set('search', search);
      if (selectedCategory) url.searchParams.set('category', selectedCategory);
      if (selectedTag) url.searchParams.set('tag', selectedTag);

      const res = await fetch(url.toString(), {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (res.ok) {
        if (reset) {
          setPosts(data.posts || []);
          setSkip(limit);
        } else {
          setPosts(prev => [...prev, ...(data.posts || [])]);
          setSkip(prev => prev + limit);
        }
        setTotal(data.total || 0);
        if (data.activeClearance) {
          setClearanceLevel(data.activeClearance.level || 0);
        }
      } else {
        setErrorMsg(data.details ? `${data.error} (${data.details})` : (data.error || 'Failed to load timeline feed.'));
      }
    } catch {
      setErrorMsg('Network error while loading timeline feed.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Re-fetch when search or category/tag filters change
  useEffect(() => {
    if (authToken) {
      fetchPosts(true);
      fetchFilterMetadata();
    }
  }, [search, selectedCategory, selectedTag, authToken]);

  // Infinite Scroll / Lazy Load Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loading && !loadingMore && posts.length < total) {
          fetchPosts(false);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTargetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [loading, loadingMore, posts.length, total]);

  // Public Share handler
  const handleSharePost = (targetPost: Post) => {
    const url = `${window.location.origin}/?timelinePost=${targetPost._id}`;
    navigator.clipboard.writeText(url);
    setShareToastPostId(targetPost._id);
    setTimeout(() => {
      setShareToastPostId(prev => (prev === targetPost._id ? null : prev));
    }, 3000);
  };

  // Helper to convert DraftMediaItem into a binary Blob
  const getBlobFromDraftMedia = async (file: DraftMediaItem): Promise<Blob> => {
    if ((file as any).rawFile instanceof Blob) {
      return (file as any).rawFile;
    }
    if (file.base64 && file.base64.startsWith('data:')) {
      try {
        const res = await fetch(file.base64);
        return await res.blob();
      } catch {
        // Fallback to manual atob if fetch fails
      }
    }
    const base64Content = file.base64 ? file.base64.split(';base64,').pop() || file.base64 : '';
    const binaryString = atob(base64Content);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: file.type || 'image/jpeg' });
  };

  // Upload helper: uses single-request for small files (< 8MB), and 4MB chunked resumable upload for larger files (videos)
  const uploadMediaFileWithProgress = async (
    postId: string,
    file: DraftMediaItem,
    _token?: string,
    onProgress?: (chunkPercent: number, stepText: string) => void
  ): Promise<any> => {
    const blob = await getBlobFromDraftMedia(file);
    const size = blob.size;
    const CHUNK_THRESHOLD = 8 * 1024 * 1024; // 8 MB

    // Fast single-request upload for small images
    if (size < CHUNK_THRESHOLD) {
      onProgress?.(25, `Preparing ${file.name} (${(size / (1024 * 1024)).toFixed(1)} MB)...`);
      const res = await fetch(`/api/timeline/${postId}/media`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          name: file.name,
          type: file.type,
          base64: file.base64
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to upload "${file.name}"`);
      }
      onProgress?.(100, `Uploaded ${file.name} successfully!`);
      const data = await res.json();
      return data.mediaItem;
    }

    // Resumable Chunked Upload (4 MB slices to completely prevent HTTP 413)
    onProgress?.(5, `Starting chunked upload for ${file.name} (${(size / (1024 * 1024)).toFixed(1)} MB)...`);

    const initRes = await fetch(`/api/timeline/${postId}/media/init-chunked`, {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({
        name: file.name,
        type: file.type,
        size
      })
    });

    if (!initRes.ok) {
      const errData = await initRes.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to initialize chunked upload for "${file.name}"`);
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

      const chunkPercent = Math.round(((chunkIdx + 1) / totalChunks) * 100);
      onProgress?.(
        chunkPercent,
        `Uploading ${file.name}: chunk ${chunkIdx + 1} of ${totalChunks} (${(endByte / (1024 * 1024)).toFixed(1)} / ${(size / (1024 * 1024)).toFixed(1)} MB)...`
      );

      let success = false;
      let lastError = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const chunkRes = await fetch(`/api/timeline/${postId}/media/upload-chunk`, {
            method: 'POST',
            headers: getAuthHeaders({
              'Content-Type': 'application/json'
            }),
            body: JSON.stringify({
              uploadId,
              chunkBase64,
              startByte,
              endByte,
              totalBytes: size
            })
          });

          if (!chunkRes.ok) {
            const errData = await chunkRes.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${chunkRes.status}`);
          }

          const chunkData = await chunkRes.json();
          if (chunkIdx === totalChunks - 1) {
            if (!chunkData.complete) {
              throw new Error('Google Drive upload incomplete on final chunk.');
            }
            finalMediaItem = chunkData.mediaItem;
          }
          success = true;
          break;
        } catch (attemptErr: any) {
          lastError = attemptErr.message || 'Network error';
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 1200));
          }
        }
      }

      if (!success) {
        throw new Error(`Failed to upload chunk ${chunkIdx + 1}/${totalChunks} of "${file.name}": ${lastError}`);
      }
    }

    return finalMediaItem;
  };

  // Submit new post from Social Wizard with background queueing, single-file uploads & floating progress
  const handleWizardSubmit = async (postData: {
    draftId: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    timestamp: string;
    clearanceLevel?: number;
    clearanceTier?: 'prakata' | 'guhya' | 'nigudha';
    mediaFiles: DraftMediaItem[];
  }) => {
    if (!authToken) return;

    const totalMedia = postData.mediaFiles.length;
    setActiveUpload({
      ...postData,
      status: 'uploading',
      stepText: totalMedia > 0 ? 'Creating directory & post...' : 'Publishing moment...',
      progressPercent: 5,
      currentIndex: 0,
      totalMedia
    });

    // Safety First: Ensure draft is persisted to IndexedDB right now
    await saveFullDraftToDb({
      id: postData.draftId,
      title: postData.title,
      content: postData.content,
      category: postData.category,
      rawTags: postData.tags.join(', '),
      tags: postData.tags,
      timestamp: postData.timestamp,
      dateMode: 'AD',
      formBsYear: adToBs(new Date(postData.timestamp)).year,
      formBsMonth: adToBs(new Date(postData.timestamp)).month,
      formBsDay: adToBs(new Date(postData.timestamp)).day,
      currentStep: 3,
      mediaCount: totalMedia,
      mediaFiles: postData.mediaFiles,
      clearanceLevel: postData.clearanceLevel || 0,
      clearanceTier: postData.clearanceTier || 'prakata',
      status: 'queued',
      updatedAt: Date.now(),
      createdAt: Date.now()
    });
    refreshPendingDrafts();

    // If device is offline, enqueue to offline queue
    if (!isDeviceOnline()) {
      enqueueOfflineAction({
        url: '/api/timeline',
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: {
          draftId: postData.draftId,
          title: postData.title,
          content: postData.content,
          category: postData.category,
          tags: postData.tags,
          timestamp: postData.timestamp,
          clearanceLevel: postData.clearanceLevel || 0,
          clearanceTier: postData.clearanceTier || 'prakata',
          mediaFiles: [] // send empty so offline action fits in localStorage and never times out Azure Functions
        },
        description: `Timeline Moment: "${postData.title.trim() || 'Untitled'}"`,
        subapp: 'timeline'
      });
      setActiveUpload({
        ...postData,
        status: 'completed',
        progressPercent: 100,
        currentIndex: totalMedia,
        totalMedia,
        stepText: 'Saved to offline queue. Your writeup and all photos are safely stored on device.'
      });
      refreshPendingDrafts();
      setTimeout(() => setActiveUpload(null), 3500);
      return;
    }

    try {
      // Step 1: Create post on server with metadata and empty media list (fast!)
      const createRes = await fetch('/api/timeline', {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          title: postData.title,
          content: postData.content,
          category: postData.category,
          tags: postData.tags,
          timestamp: postData.timestamp,
          clearanceLevel: postData.clearanceLevel || 0,
          clearanceTier: postData.clearanceTier || 'prakata',
          mediaFiles: [] // send empty so creation is fast and avoids huge payload limits
        })
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        const detailMsg = errData.details ? `${errData.error} (${errData.details})` : errData.error;
        throw new Error(detailMsg || `Server error (HTTP ${createRes.status})`);
      }

      const createData = await createRes.json();
      const postId = createData.postId;

      // Step 2: Upload each media file 1-by-1 directly to the post folder
      let mediaGlitch = false;
      let mediaGlitchMsg = '';
      if (totalMedia > 0) {
        for (let i = 0; i < totalMedia; i++) {
          const file = postData.mediaFiles[i];
          const baseFilePercent = Math.round((i / totalMedia) * 100);

          setActiveUpload(prev => prev ? {
            ...prev,
            createdPostId: postId,
            currentIndex: i + 1,
            progressPercent: baseFilePercent,
            stepText: `Uploading file ${i + 1} of ${totalMedia}: ${file.name}...`
          } : null);

          try {
            await uploadMediaFileWithProgress(postId, file, authToken, (chunkPercent, stepText) => {
              const fileSliceProgress = Math.round(baseFilePercent + (chunkPercent / totalMedia));
              setActiveUpload(prev => prev ? {
                ...prev,
                createdPostId: postId,
                currentIndex: i + 1,
                progressPercent: Math.min(99, fileSliceProgress),
                stepText: `[File ${i + 1}/${totalMedia}] ${stepText}`
              } : null);
            });
          } catch (fileErr: any) {
            mediaGlitch = true;
            mediaGlitchMsg = fileErr.message || `Failed to upload "${file.name}"`;
            break;
          }
        }
      }

      if (mediaGlitch) {
        // DO NOT RETIRE DRAFT: Keep photos safe in IndexedDB
        await markDraftFailed(postData.draftId, mediaGlitchMsg);
        refreshPendingDrafts();
        setActiveUpload(prev => prev ? {
          ...prev,
          status: 'error',
          errorMsg: `${mediaGlitchMsg}. Your writeup was published, and your photos are safely retained in Drafts.`
        } : null);
        fetchPosts(true);
        return;
      }

      // Step 3: Success! Finalize draft cleanup and update feed
      setActiveUpload(prev => prev ? {
        ...prev,
        status: 'completed',
        progressPercent: 100,
        stepText: 'Moment published to timeline!'
      } : null);

      // ONLY NOW clear draft from IndexedDB / LocalStorage
      await finalizeSuccessfulDraftUpload(postData.draftId);

      // Refresh posts feed & drafts
      fetchPosts(true);
      fetchFilterMetadata();
      refreshPendingDrafts();

      // Auto-hide floating progress bar after 4 seconds
      setTimeout(() => {
        setActiveUpload(prev => (prev?.status === 'completed' ? null : prev));
      }, 4000);

    } catch (err: any) {
      console.error('Timeline upload failed:', err);
      await markDraftFailed(postData.draftId, err.message || 'Upload failed');
      refreshPendingDrafts();
      setActiveUpload(prev => prev ? {
        ...prev,
        status: 'error',
        errorMsg: `${err.message || 'Failed to upload files.'} Your writeup and photos are safely kept in Drafts.`
      } : null);
    }
  };

  // Delete post
  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Delete this memory? Media will be moved to trash.') || !authToken) return;

    try {
      const res = await fetch(`/api/timeline/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p._id !== id));
        setTotal(t => t - 1);
        fetchFilterMetadata();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete post.');
      }
    } catch {
      alert('Network error.');
    }
  };

  // Inline editing
  const startEdit = (post: Post) => {
    setEditingPostId(post._id);
    setEditTitle(post.title || '');
    setEditContent(post.content);
    setEditCategory(post.category);
    setEditRawTags(post.tags.join(', '));
    const adStr = new Date(post.timestamp).toISOString().substring(0, 16);
    setEditTimestamp(adStr);
    const bs = adToBs(post.timestamp);
    setEditBsYear(bs.year);
    setEditBsMonth(bs.month);
    setEditBsDay(bs.day);
    setEditDateMode('AD');
    setEditExistingMedia(post.media ? [...post.media] : []);
    setEditRemovedMediaIds([]);
    setEditNewMedia([]);
  };

  const handleEditAdTimestampChange = (newAdString: string) => {
    setEditTimestamp(newAdString);
    if (newAdString) {
      const bs = adToBs(new Date(newAdString));
      setEditBsYear(bs.year);
      setEditBsMonth(bs.month);
      setEditBsDay(bs.day);
    }
  };

  const handleEditBsDateChange = (year: number, month: number, day: number) => {
    setEditBsYear(year);
    setEditBsMonth(month);
    setEditBsDay(day);

    const maxDays = getMonthDays(year, month);
    const validDay = Math.min(day, maxDays);
    if (validDay !== day) {
      setEditBsDay(validDay);
    }

    const adDate = bsToAd(year, month, validDay);
    const currentTimeStr = editTimestamp ? editTimestamp.substring(11, 16) : '12:00';
    const yyyy = adDate.getFullYear();
    const mm = String(adDate.getMonth() + 1).padStart(2, '0');
    const dd = String(adDate.getDate()).padStart(2, '0');
    setEditTimestamp(`${yyyy}-${mm}-${dd}T${currentTimeStr}`);
  };

  const handleUpdatePost = async (id: string) => {
    if (!editContent.trim() || !authToken) return;

    setIsSavingEdit(true);
    try {
      let allExisting = [...editExistingMedia];
      if (editNewMedia.length > 0) {
        for (const file of editNewMedia) {
          const item = await uploadMediaFileWithProgress(id, file, authToken);
          if (item) allExisting.push(item);
        }
      }

      const res = await fetch(`/api/timeline/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          category: editCategory.trim(),
          tags: editRawTags.split(',').map(t => t.trim()).filter(Boolean),
          timestamp: new Date(editTimestamp).toISOString(),
          newMediaFiles: [],
          removedMediaIds: editRemovedMediaIds,
          reorderedMedia: allExisting
        })
      });

      if (res.ok) {
        const data = await res.json();
        const updatedPost = data.post;
        setPosts(prev => prev.map(p => {
          if (p._id === id) {
            return updatedPost || {
              ...p,
              title: editTitle.trim(),
              content: editContent.trim(),
              category: editCategory.trim(),
              tags: editRawTags.split(',').map(t => t.trim()).filter(Boolean),
              timestamp: new Date(editTimestamp).toISOString(),
              media: editExistingMedia
            };
          }
          return p;
        }));
        setEditingPostId(null);
        setEditExistingMedia([]);
        setEditRemovedMediaIds([]);
        setEditNewMedia([]);
        fetchFilterMetadata();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update post.');
      }
    } catch {
      alert('Network error.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Lightbox
  const handleOpenLightbox = (mediaList: MediaItem[], startIndex: number) => {
    setLightboxItems(mediaList.map(m => ({
      url: m.viewUrl,
      thumbnailUrl: m.thumbnailUrl,
      name: m.fileName,
      type: m.mimeType,
      size: (m as any).size,
      googleDriveId: m.googleDriveId,
      previewUrl: (m as any).previewUrl,
      streamUrl: (m as any).streamUrl
    })));
    setLightboxIndex(startIndex);
    setShowLightbox(true);
  };

  // Combine Timeline Posts with Streaks Moments when enabled
  const allTimelinePosts = useMemo(() => {
    if (!showStreaksMoments || streaksPosts.length === 0) return posts;
    const combined = [...posts, ...streaksPosts];
    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [posts, streaksPosts, showStreaksMoments]);

  // Bikram Sambat filtering
  const filteredPosts = useMemo(() => {
    return allTimelinePosts.filter(post => {
      if (!selectedBsYear && !selectedBsMonth) return true;
      const bs = adToBs(post.timestamp);
      if (selectedBsYear && bs.year !== parseInt(selectedBsYear, 10)) return false;
      if (selectedBsMonth && bs.month !== parseInt(selectedBsMonth, 10)) return false;
      return true;
    });
  }, [allTimelinePosts, selectedBsYear, selectedBsMonth]);

  // Robust Grouping of Filtered Posts by Local Calendar Day
  const dayGroups: DayGroup[] = useMemo(() => {
    const groupsMap: Record<string, Post[]> = {};

    filteredPosts.forEach(post => {
      // Use local date key so timezone offsets never split same-day snaps
      const dateKey = getLocalDateKey(post.timestamp);
      if (!groupsMap[dateKey]) {
        groupsMap[dateKey] = [];
      }
      groupsMap[dateKey].push(post);
    });

    return Object.entries(groupsMap).map(([dateKey, dayPosts]) => {
      // Sort day posts latest first
      dayPosts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const sampleDate = new Date(dayPosts[0].timestamp);
      const bsDate = adToBs(sampleDate);
      const totalSnaps = dayPosts.reduce((acc, p) => acc + (p.media?.length || 0), 0);

      return {
        dateKey,
        adDate: sampleDate,
        bsDate,
        posts: dayPosts,
        totalSnaps
      };
    });
  }, [filteredPosts]);

  // Turn page for a day group
  const handleTurnDayPage = (dateKey: string, direction: 'next' | 'prev', totalPages: number) => {
    setDayPageIndices(prev => {
      const current = prev[dateKey] || 0;
      const nextIndex = direction === 'next' 
        ? (current + 1) % totalPages 
        : (current - 1 + totalPages) % totalPages;
      return { ...prev, [dateKey]: nextIndex };
    });
  };

  // Turn media photo inside a single moment
  const handleTurnMomentPhoto = (postId: string, direction: 'next' | 'prev', totalMedia: number) => {
    setMomentPhotoIndices(prev => {
      const current = prev[postId] || 0;
      const nextIndex = direction === 'next'
        ? (current + 1) % totalMedia
        : (current - 1 + totalMedia) % totalMedia;
      return { ...prev, [postId]: nextIndex };
    });
  };

  // Toggle Day View Mode
  const toggleDayViewMode = (dateKey: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [dateKey]: !(prev[dateKey] ?? !globalDeckMode)
    }));
  };

  // Calculate active filter count
  const activeFilterCount = (search ? 1 : 0) + 
    (selectedCategory ? 1 : 0) + 
    (selectedTag ? 1 : 0) + 
    (selectedBsYear ? 1 : 0) + 
    (selectedBsMonth ? 1 : 0);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedTag('');
    setSelectedBsYear('');
    setSelectedBsMonth('');
  };

  // If not logged in
  if (!authToken) {
    return (
      <div className="max-w-md mx-auto my-16 text-center space-y-4">
        <div className="inline-flex p-4 bg-red-50 text-red-500 rounded-full">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Authentication Required</h2>
        <p className="text-slate-500 text-sm">Please log in to view or manage your personal Lifetime Line timeline feed.</p>
      </div>
    );
  }

  return (
    <div className="w-full pb-20 select-none">
      
      {/* ── Compact Space-Saving Top Header Bar with Signal-Based Clearance Cadence ── */}
      <div 
        className={`flex items-center justify-between gap-3 mb-6 border px-4 sm:px-6 py-3.5 rounded-2xl shadow-xs transition-colors duration-100 relative ${
          flashBg === 'amber'
            ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400/50'
            : flashBg === 'rose'
            ? 'bg-rose-100 border-rose-400 ring-2 ring-rose-400/50'
            : flashBg === 'reset'
            ? 'bg-slate-200 border-slate-400 ring-2 ring-slate-400/50'
            : clearanceLevel === 2
            ? 'bg-white border-rose-400/60 ring-1 ring-rose-400/20'
            : clearanceLevel === 1
            ? 'bg-white border-amber-400/60 ring-1 ring-amber-400/20'
            : 'bg-white border-slate-200/90'
        }`}
      >
        <div 
          onClick={handleHeaderCadenceClick}
          className="flex items-center gap-3 cursor-pointer select-none active:scale-[0.99] transition-transform"
          title=""
        >
          <div className={`p-2 rounded-xl transition-colors duration-300 ${
            clearanceLevel === 2
              ? 'bg-rose-50 text-rose-600'
              : clearanceLevel === 1
              ? 'bg-amber-50 text-amber-600'
              : 'bg-blue-50 text-blue-600'
          }`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 leading-none flex items-center gap-1.5">
              Lifetime Line
              {clearanceLevel === 1 && (
                <span 
                  onClick={(e) => { e.stopPropagation(); handlePanicConceal(); }} 
                  className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse cursor-pointer"
                  title=""
                />
              )}
              {clearanceLevel === 2 && (
                <span 
                  onClick={(e) => { e.stopPropagation(); handlePanicConceal(); }} 
                  className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-ping cursor-pointer"
                  title=""
                />
              )}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {total} memories in chronicle
            </p>
          </div>
        </div>

        {/* Cryptic reset door: 3 clicks on the empty space between title and right action icons */}
        <div 
          onClick={handleResetCadenceClick}
          className="flex-1 self-stretch cursor-pointer select-none min-h-[44px]"
          title=""
        />
        
        <div className="flex items-center gap-2">
          {/* Filters & Config Drawer Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
              activeFilterCount > 0 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title="Configure feed, search & calendar filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters & Config</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Clean Solid Document Moment Button (Zero Garish Gradients) */}
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Document Moment</span>
          </button>
        </div>
      </div>

      {/* ── Main Two-Column Layout (Timeline Feed + Side Configuration Bar) ── */}
      <div className="flex items-start gap-8">
        
        {/* Main Feed Content Area */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* ── Persistent Draft Alert: Guarantees user never loses writeup or photos ── */}
          {pendingDrafts.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200/90 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                    <span>{pendingDrafts.length} Saved / Offline Draft{pendingDrafts.length > 1 ? 's' : ''} on Device</span>
                    {pendingDrafts.some(d => d.status === 'failed') && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold border border-red-200">
                        Sync Issue (Data Preserved)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 truncate mt-0.5">
                    Latest: "{pendingDrafts[0].title || pendingDrafts[0].content?.slice(0, 45) || 'Untitled Draft'}" • {pendingDrafts[0].mediaFiles?.length || pendingDrafts[0].mediaCount || 0} snaps attached
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDraftIdToOpen(pendingDrafts[0].id);
                  setShowWizard(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 shrink-0"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Resume Draft
              </button>
            </div>
          )}
          
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Active Filter Chips Bar (If filters applied, show quick dismiss chips) */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 text-xs">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Active:</span>
              {search && (
                <span className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
                  "{search}"
                  <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-700">&times;</button>
                </span>
              )}
              {selectedCategory && (
                <span className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
                  Category: {selectedCategory}
                  <button onClick={() => setSelectedCategory('')} className="text-slate-400 hover:text-slate-700">&times;</button>
                </span>
              )}
              {selectedTag && (
                <span className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
                  #{selectedTag}
                  <button onClick={() => setSelectedTag('')} className="text-slate-400 hover:text-slate-700">&times;</button>
                </span>
              )}
              {selectedBsYear && (
                <span className="bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
                  BS Year: {selectedBsYear}
                  <button onClick={() => setSelectedBsYear('')} className="text-amber-600 hover:text-amber-900">&times;</button>
                </span>
              )}
              {selectedBsMonth && (
                <span className="bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
                  BS Month: {BS_MONTHS.find(m => String(m.id) === selectedBsMonth)?.en}
                  <button onClick={() => setSelectedBsMonth('')} className="text-amber-600 hover:text-amber-900">&times;</button>
                </span>
              )}
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-blue-600 hover:underline ml-auto pl-2"
              >
                Reset All
              </button>
            </div>
          )}

          {/* Timeline Feed Container */}
          {loading && posts.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-xs font-semibold">Loading your chronicle feed...</span>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-10 py-2">
              
              {dayGroups.map((group) => {
                const isDayExpanded = expandedDays[group.dateKey] ?? !globalDeckMode;
                const currentDayPageIndex = (dayPageIndices[group.dateKey] || 0) % group.posts.length;
                const activePost = group.posts[currentDayPageIndex] || group.posts[0];
                const hasMultipleInDay = group.posts.length > 1;

                return (
                  <div key={group.dateKey} className="relative group/day animate-in fade-in duration-200 space-y-3.5">
                    
                    {/* Day Timeline Dot & Milestone Connector */}
                    <div className="absolute -left-[37px] sm:-left-[45px] top-1.5 w-8 h-8 bg-white border-2 border-slate-300 group-hover/day:border-blue-600 rounded-full flex flex-col items-center justify-center shadow-xs text-[9px] font-extrabold text-slate-700 transition z-10">
                      {group.adDate.getDate()}
                      <span className="text-[7px] uppercase -mt-0.5 text-slate-400">
                        {group.adDate.toLocaleString('default', { month: 'short' })}
                      </span>
                    </div>

                    {/* Day Milestone Header Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100/90 px-3.5 py-1.5 rounded-xl border border-slate-200/80">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-900">
                          {group.adDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100/80 border border-amber-300/80 text-amber-900 font-extrabold text-[10px] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-700" />
                          <span>{group.bsDate.formattedBsNp}</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          {group.posts.length} {group.posts.length === 1 ? 'Moment' : 'Moments'}
                          {group.totalSnaps > 0 && ` • ${group.totalSnaps} Snaps`}
                        </span>
                      </div>

                      {/* Day View Toggle */}
                      {hasMultipleInDay && (
                        <button
                          type="button"
                          onClick={() => toggleDayViewMode(group.dateKey)}
                          className="px-2.5 py-0.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition flex items-center gap-1 shadow-xs"
                        >
                          {isDayExpanded ? (
                            <>
                              <Layers className="w-3 h-3 text-blue-600" />
                              <span>Stack Book</span>
                            </>
                          ) : (
                            <>
                              <List className="w-3 h-3 text-slate-500" />
                              <span>Expand</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* RENDERING: STACKED PAGE-TURNER DECK vs EXPANDED LIST */}
                    {!isDayExpanded && hasMultipleInDay ? (
                      
                      /* ═══════════ HORIZONTAL DAY STORY DECK (PAGE-TURNER) ═══════════ */
                      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-4 relative overflow-hidden group/card">
                        
                        {/* Top Page-Turn Navigation Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                              <Layers className="w-3 h-3 text-blue-600" />
                              <span>Moment {currentDayPageIndex + 1} of {group.posts.length}</span>
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              {new Date(activePost.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Previous & Next Page Turn Arrow Buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleTurnDayPage(group.dateKey, 'prev', group.posts.length)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 transition active:scale-95 shadow-xs"
                              title="Previous moment on this day"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            
                            {/* Dot indicators */}
                            <div className="flex items-center gap-1 px-1">
                              {group.posts.map((_, pIdx) => (
                                <button
                                  key={pIdx}
                                  onClick={() => setDayPageIndices(prev => ({ ...prev, [group.dateKey]: pIdx }))}
                                  className={`h-1.5 rounded-full transition-all ${
                                    pIdx === currentDayPageIndex ? 'w-4 bg-blue-600' : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                                  }`}
                                  title={`Jump to moment ${pIdx + 1}`}
                                />
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTurnDayPage(group.dateKey, 'next', group.posts.length)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 transition active:scale-95 shadow-xs"
                              title="Next moment on this day"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Active Post Content in the Deck */}
                        <MomentCardBody
                          post={activePost}
                          isEditing={editingPostId === activePost._id}
                          startEdit={() => startEdit(activePost)}
                          onDelete={() => handleDeletePost(activePost._id)}
                          onSharePost={handleSharePost}
                          isShareToastActive={shareToastPostId === activePost._id}
                          onOpenLightbox={(media, idx) => handleOpenLightbox(media, idx)}
                          momentPhotoIndex={momentPhotoIndices[activePost._id] || 0}
                          onTurnMomentPhoto={(dir, count) => handleTurnMomentPhoto(activePost._id, dir, count)}
                          selectedTag={selectedTag}
                          setSelectedTag={setSelectedTag}
                          editTitle={editTitle}
                          setEditTitle={setEditTitle}
                          editContent={editContent}
                          setEditContent={setEditContent}
                          editCategory={editCategory}
                          setEditCategory={setEditCategory}
                          editRawTags={editRawTags}
                          setEditRawTags={setEditRawTags}
                          editTimestamp={editTimestamp}
                          editDateMode={editDateMode}
                          setEditDateMode={setEditDateMode}
                          editBsYear={editBsYear}
                          editBsMonth={editBsMonth}
                          editBsDay={editBsDay}
                          handleEditAdTimestampChange={handleEditAdTimestampChange}
                          handleEditBsDateChange={handleEditBsDateChange}
                          handleUpdatePost={() => handleUpdatePost(activePost._id)}
                          cancelEdit={() => setEditingPostId(null)}
                          editExistingMedia={editExistingMedia}
                          setEditExistingMedia={setEditExistingMedia}
                          setEditRemovedMediaIds={setEditRemovedMediaIds}
                          editNewMedia={editNewMedia}
                          setEditNewMedia={setEditNewMedia}
                          isSavingEdit={isSavingEdit}
                        />

                        {/* Bottom Mini-Thumbnails Strip to Jump Quickly */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto scrollbar-none">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                            Day Snaps:
                          </span>
                          {group.posts.map((p, pIdx) => {
                            const isCurrent = pIdx === currentDayPageIndex;
                            const firstMedia = p.media && p.media.length > 0 ? p.media[0] : null;

                            return (
                              <button
                                key={p._id}
                                onClick={() => setDayPageIndices(prev => ({ ...prev, [group.dateKey]: pIdx }))}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition text-xs shrink-0 ${
                                  isCurrent
                                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-xs'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {firstMedia ? (
                                  <img 
                                    src={firstMedia.thumbnailUrl || firstMedia.viewUrl} 
                                    alt="" 
                                    loading="lazy"
                                    className="w-4 h-4 rounded-sm object-cover" 
                                  />
                                ) : (
                                  <Sparkles className="w-3 h-3 text-amber-500" />
                                )}
                                <span className="truncate max-w-[90px]">{p.title || `Moment #${pIdx + 1}`}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    ) : (

                      /* ═══════════ EXPANDED LIST OF MOMENTS FOR THIS DAY ═══════════ */
                      <div className="space-y-4">
                        {group.posts.map((post) => (
                          <div
                            key={post._id}
                            className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-sm transition space-y-4"
                          >
                            <MomentCardBody
                              post={post}
                              isEditing={editingPostId === post._id}
                              startEdit={() => startEdit(post)}
                              onDelete={() => handleDeletePost(post._id)}
                              onSharePost={handleSharePost}
                              isShareToastActive={shareToastPostId === post._id}
                              onOpenLightbox={(media, idx) => handleOpenLightbox(media, idx)}
                              momentPhotoIndex={momentPhotoIndices[post._id] || 0}
                              onTurnMomentPhoto={(dir, count) => handleTurnMomentPhoto(post._id, dir, count)}
                              selectedTag={selectedTag}
                              setSelectedTag={setSelectedTag}
                              editTitle={editTitle}
                              setEditTitle={setEditTitle}
                              editContent={editContent}
                              setEditContent={setEditContent}
                              editCategory={editCategory}
                              setEditCategory={setEditCategory}
                              editRawTags={editRawTags}
                              setEditRawTags={setEditRawTags}
                              editTimestamp={editTimestamp}
                              editDateMode={editDateMode}
                              setEditDateMode={setEditDateMode}
                              editBsYear={editBsYear}
                              editBsMonth={editBsMonth}
                              editBsDay={editBsDay}
                              handleEditAdTimestampChange={handleEditAdTimestampChange}
                              handleEditBsDateChange={handleEditBsDateChange}
                              handleUpdatePost={() => handleUpdatePost(post._id)}
                              cancelEdit={() => setEditingPostId(null)}
                              editExistingMedia={editExistingMedia}
                              setEditExistingMedia={setEditExistingMedia}
                              setEditRemovedMediaIds={setEditRemovedMediaIds}
                              editNewMedia={editNewMedia}
                              setEditNewMedia={setEditNewMedia}
                              isSavingEdit={isSavingEdit}
                            />
                          </div>
                        ))}
                      </div>

                    )}

                  </div>
                );
              })}

            </div>
          )}

          {/* ── Empty State ── */}
          {!loading && filteredPosts.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-white space-y-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <BookOpen className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">No moments found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Start documenting memories or adjust your calendar/search filters.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWizard(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Document First Moment</span>
              </button>
            </div>
          )}

          {/* ── Lazy Load / Infinite Scroll Sentinel ── */}
          <div ref={observerTargetRef} className="py-6 flex items-center justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Loading more moments...</span>
              </div>
            )}
            {!loading && !loadingMore && posts.length >= total && posts.length > 0 && (
              <span className="text-[11px] font-semibold text-slate-400">
                All {total} chronicle memories loaded
              </span>
            )}
          </div>

        </div>

        {/* ── Right-Side Desktop Configuration & Filters Sidebar ── */}
        <div className="hidden lg:block">
          <TimelineSidebar
            search={search}
            onSearchChange={setSearch}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedTag={selectedTag}
            onTagChange={setSelectedTag}
            categories={categories}
            tags={tags}
            selectedBsYear={selectedBsYear}
            onBsYearChange={setSelectedBsYear}
            selectedBsMonth={selectedBsMonth}
            onBsMonthChange={setSelectedBsMonth}
            globalDeckMode={globalDeckMode}
            onToggleGlobalDeckMode={() => setGlobalDeckMode(prev => !prev)}
            showStreaksMoments={showStreaksMoments}
            onToggleShowStreaksMoments={handleToggleShowStreaksMoments}
            onSyncDrive={handleSyncDrive}
            syncing={syncing}
            totalMoments={total}
            isOpen={true}
            onClose={() => {}}
            activeFilterCount={activeFilterCount}
            onResetFilters={handleResetFilters}
          />
        </div>

      </div>

      {/* ── Mobile Sidebar Drawer ── */}
      <div className="lg:hidden">
        <TimelineSidebar
          search={search}
          onSearchChange={setSearch}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedTag={selectedTag}
          onTagChange={setSelectedTag}
          categories={categories}
          tags={tags}
          selectedBsYear={selectedBsYear}
          onBsYearChange={setSelectedBsYear}
          selectedBsMonth={selectedBsMonth}
          onBsMonthChange={setSelectedBsMonth}
          globalDeckMode={globalDeckMode}
          onToggleGlobalDeckMode={() => setGlobalDeckMode(prev => !prev)}
          showStreaksMoments={showStreaksMoments}
          onToggleShowStreaksMoments={handleToggleShowStreaksMoments}
          onSyncDrive={handleSyncDrive}
          syncing={syncing}
          totalMoments={total}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
        />
      </div>

      {/* ── Social Moment Creation Wizard Modal ── */}
      {showWizard && (
        <TimelineWizardModal
          onClose={() => {
            setShowWizard(false);
            setSelectedDraftIdToOpen(undefined);
            refreshPendingDrafts();
          }}
          onSubmit={handleWizardSubmit}
          categoriesList={categories}
          tagsList={tags}
          initialDraftId={selectedDraftIdToOpen || activeUpload?.draftId}
        />
      )}

      {/* ── Discrete Steganographic Guhya Keycode Dialog (TOTP) ── */}
      {showGuhyaModal && (
        <div 
          onClick={() => {
            // Guard against accidental extra tap (e.g. 6th tap in quick burst)
            if (Date.now() - modalOpenedAtRef.current < 600) return;
            setShowGuhyaModal(false);
            setGuhyaInput('');
            setGuhyaError('');
          }}
          className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-150 relative"
          >
            {/* Explicit Close Button */}
            <button
              type="button"
              onClick={() => { setShowGuhyaModal(false); setGuhyaInput(''); setGuhyaError(''); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 p-1.5 rounded-xl hover:bg-slate-800/60 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-100 tracking-wider">
                गुह्य
              </h3>
              <p className="text-xs text-slate-400">
                Keycode required to illuminate chronicle
              </p>
            </div>

            <form 
              onSubmit={(e) => { e.preventDefault(); submitGuhyaCode(); }}
              className="w-full space-y-3"
            >
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={guhyaInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setGuhyaInput(val);
                  setGuhyaError('');
                  if (val.length === 6) {
                    submitGuhyaCode(val);
                  }
                }}
                placeholder="· · · · · ·"
                className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 px-4 bg-slate-950/60 border border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-2xl text-white outline-none transition placeholder:text-slate-600"
              />

              {guhyaError && (
                <p className="text-xs font-semibold text-rose-400 animate-in fade-in">
                  {guhyaError}
                </p>
              )}

              {guhyaLoading && (
                <div className="flex items-center justify-center gap-2 text-xs text-amber-300 font-semibold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ── Discrete Steganographic Nigudha Biometric Modal (WebAuthn / Passkeys) ── */}
      {showNigudhaModal && (
        <div 
          onClick={() => {
            // Guard against accidental extra tap (e.g. 6th tap in quick burst)
            if (Date.now() - modalOpenedAtRef.current < 600) return;
            if (!nigudhaLoading) {
              setShowNigudhaModal(false);
              setNigudhaError('');
            }
          }}
          className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-150 relative"
          >
            {/* Explicit Close Button */}
            <button
              type="button"
              disabled={nigudhaLoading}
              onClick={() => { setShowNigudhaModal(false); setNigudhaError(''); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 p-1.5 rounded-xl hover:bg-slate-800/60 transition disabled:opacity-30"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shadow-inner">
              <Sparkles className="w-6 h-6 text-rose-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-100 tracking-wider">
                निगूढ
              </h3>
              <p className="text-xs text-slate-400">
                Touch sensor, Windows Hello, or scan QR with Phone
              </p>
            </div>

            {nigudhaError && (
              <p className="text-xs font-semibold text-rose-400 animate-in fade-in">
                {nigudhaError}
              </p>
            )}

            <button
              type="button"
              disabled={nigudhaLoading}
              onClick={() => executeBiometricAuth()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-rose-500/25 transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {nigudhaLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Sensor...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Verify Biometrics / Phone</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Prominent Live Upload Progress Center Stage Banner ── */}
      {activeUpload && !activeUpload.isMinimized && (
        <aside 
          aria-label="Upload progress feedback"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[85] w-[94vw] max-w-lg rounded-3xl p-5 shadow-2xl border bg-slate-900/95 border-slate-700/80 text-white backdrop-blur-xl animate-in slide-in-from-top-4 duration-200"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                activeUpload.status === 'error'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : activeUpload.status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {activeUpload.status === 'uploading' && <Loader2 className="w-5 h-5 animate-spin" />}
                {activeUpload.status === 'completed' && <Check className="w-5 h-5" />}
                {activeUpload.status === 'error' && <AlertCircle className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold truncate text-white">
                    {activeUpload.title || 'Timeline Moment'}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-blue-400 border border-slate-700 shrink-0">
                    {activeUpload.totalMedia > 0 ? `${activeUpload.currentIndex}/${activeUpload.totalMedia}` : 'Writeup'}
                  </span>
                </div>
                <p className={`text-xs truncate mt-0.5 ${
                  activeUpload.status === 'error' 
                    ? 'text-red-400 font-semibold' 
                    : (activeUpload.status === 'completed' ? 'text-emerald-400 font-semibold' : 'text-slate-300 font-mono text-[11px]')
                }`}>
                  {activeUpload.status === 'error' ? activeUpload.errorMsg : activeUpload.stepText}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {activeUpload.status === 'uploading' && (
                <button
                  type="button"
                  onClick={() => setActiveUpload(prev => prev ? { ...prev, isMinimized: true } : null)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                  title="Minimize to corner"
                >
                  Minimize
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveUpload(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Large Dynamic Progress Bar */}
          {activeUpload.status === 'uploading' && (
            <div className="mt-4 space-y-1.5">
              <div className="w-full bg-slate-800/90 rounded-full h-3 overflow-hidden shadow-inner p-0.5 border border-slate-700/50">
                <div 
                  className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300 relative shadow-sm"
                  style={{ width: `${Math.max(4, activeUpload.progressPercent)}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                </div>
              </div>
              <div className="flex justify-between items-center text-xs font-mono text-slate-400 px-0.5">
                <span>{activeUpload.totalMedia > 0 ? `File ${activeUpload.currentIndex} of ${activeUpload.totalMedia}` : 'Publishing post'}</span>
                <span className="font-bold text-white text-sm">{activeUpload.progressPercent}%</span>
              </div>
            </div>
          )}

          {/* Action buttons if error - Never lose draft */}
          {activeUpload.status === 'error' && (
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Draft preserved safely</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDraftIdToOpen(activeUpload.draftId);
                    setShowWizard(true);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
                >
                  Open Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleWizardSubmit(activeUpload)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow"
                >
                  Retry Upload
                </button>
              </div>
            </div>
          )}
        </aside>
      )}

      {/* ── Minimized Floating Pill in Bottom Corner ── */}
      {activeUpload && activeUpload.isMinimized && (
        <aside
          onClick={() => setActiveUpload(prev => prev ? { ...prev, isMinimized: false } : null)}
          className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-slate-700 text-white rounded-2xl p-3 shadow-2xl cursor-pointer hover:scale-105 transition flex items-center gap-3 backdrop-blur-md"
          title="Click to expand upload progress"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0">
            {activeUpload.status === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </div>
          <div className="text-xs">
            <p className="font-bold">{activeUpload.progressPercent}% Uploading</p>
            <p className="text-[10px] text-slate-400">{activeUpload.currentIndex} / {activeUpload.totalMedia} files</p>
          </div>
        </aside>
      )}

      {/* ── Media Lightbox Modal ── */}
      {showLightbox && (
        <MediaLightboxModal
          items={lightboxItems}
          initialIndex={lightboxIndex}
          onClose={() => setShowLightbox(false)}
        />
      )}

    </div>
  );
};

// ── Sub-Component for Rendering an Individual Moment's Card Body ──
interface MomentCardBodyProps {
  post: Post;
  isEditing: boolean;
  startEdit: () => void;
  onDelete: () => void;
  onSharePost: (post: Post) => void;
  isShareToastActive: boolean;
  onOpenLightbox: (media: MediaItem[], index: number) => void;
  momentPhotoIndex: number;
  onTurnMomentPhoto: (direction: 'next' | 'prev', count: number) => void;
  selectedTag: string;
  setSelectedTag: (tag: string) => void;

  // Edit Props
  editTitle: string;
  setEditTitle: (val: string) => void;
  editContent: string;
  setEditContent: (val: string) => void;
  editCategory: string;
  setEditCategory: (val: string) => void;
  editRawTags: string;
  setEditRawTags: (val: string) => void;
  editTimestamp: string;
  editDateMode: 'AD' | 'BS';
  setEditDateMode: (val: 'AD' | 'BS') => void;
  editBsYear: number;
  editBsMonth: number;
  editBsDay: number;
  handleEditAdTimestampChange: (val: string) => void;
  handleEditBsDateChange: (y: number, m: number, d: number) => void;
  handleUpdatePost: () => void;
  cancelEdit: () => void;
  editExistingMedia: MediaItem[];
  setEditExistingMedia: React.Dispatch<React.SetStateAction<MediaItem[]>>;
  setEditRemovedMediaIds: React.Dispatch<React.SetStateAction<string[]>>;
  editNewMedia: DraftMediaItem[];
  setEditNewMedia: React.Dispatch<React.SetStateAction<DraftMediaItem[]>>;
  isSavingEdit: boolean;
}

const MomentCardBody: React.FC<MomentCardBodyProps> = ({
  post,
  isEditing,
  startEdit,
  onDelete,
  onSharePost,
  isShareToastActive,
  onOpenLightbox,
  momentPhotoIndex: _momentPhotoIndex,
  onTurnMomentPhoto: _onTurnMomentPhoto,
  selectedTag,
  setSelectedTag,
  editTitle,
  setEditTitle,
  editContent,
  setEditContent,
  editCategory,
  setEditCategory,
  editRawTags,
  setEditRawTags,
  editTimestamp,
  editDateMode,
  setEditDateMode,
  editBsYear,
  editBsMonth,
  editBsDay,
  handleEditAdTimestampChange,
  handleEditBsDateChange,
  handleUpdatePost,
  cancelEdit,
  editExistingMedia,
  setEditExistingMedia,
  setEditRemovedMediaIds,
  editNewMedia,
  setEditNewMedia,
  isSavingEdit
}) => {
  const dt = new Date(post.timestamp);
  const bsDate = adToBs(post.timestamp);

  // Social Engagement State on Card
  const [showComments, setShowComments] = useState(false);
  const reactions = post.reactions || [];
  const comments = post.comments || [];

  if (isEditing) {
    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-700">Edit Date Mode:</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setEditDateMode('AD')}
              className={`px-2.5 py-0.5 text-xs font-bold rounded ${editDateMode === 'AD' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
            >
              AD
            </button>
            <button
              type="button"
              onClick={() => setEditDateMode('BS')}
              className={`px-2.5 py-0.5 text-xs font-bold rounded ${editDateMode === 'BS' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'}`}
            >
              BS (Nepali)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="Title"
            className="md:col-span-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 font-medium"
          />

          {editDateMode === 'AD' ? (
            <input
              type="datetime-local"
              value={editTimestamp}
              onChange={e => handleEditAdTimestampChange(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50"
            />
          ) : (
            <div className="grid grid-cols-3 gap-1">
              <select
                value={editBsYear}
                onChange={e => handleEditBsDateChange(parseInt(e.target.value, 10), editBsMonth, editBsDay)}
                className="px-1.5 py-1 border border-slate-200 rounded-lg text-xs bg-amber-50"
              >
                {getAvailableBsYears().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={editBsMonth}
                onChange={e => handleEditBsDateChange(editBsYear, parseInt(e.target.value, 10), editBsDay)}
                className="px-1.5 py-1 border border-slate-200 rounded-lg text-xs bg-amber-50"
              >
                {BS_MONTHS.map(m => (
                  <option key={m.id} value={m.id}>{m.np}</option>
                ))}
              </select>
              <select
                value={editBsDay}
                onChange={e => handleEditBsDateChange(editBsYear, editBsMonth, parseInt(e.target.value, 10))}
                className="px-1.5 py-1 border border-slate-200 rounded-lg text-xs bg-amber-50"
              >
                {Array.from({ length: getMonthDays(editBsYear, editBsMonth) }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <textarea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 resize-y"
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={editCategory}
            onChange={e => setEditCategory(e.target.value)}
            placeholder="Category"
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 font-medium"
          />
          <input
            type="text"
            value={editRawTags}
            onChange={e => setEditRawTags(e.target.value)}
            placeholder="Tags (comma separated)"
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 font-medium"
          />
        </div>

        {/* Media / Pictures Management in Edit Mode */}
        <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-blue-600" />
                Attached Snaps ({editExistingMedia.length + editNewMedia.length})
              </span>
              <p className="text-[10px] text-slate-400">Use arrows to rearrange display sequence</p>
            </div>
            <label className="cursor-pointer px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 transition">
              <Plus className="w-3.5 h-3.5" /> Add Snaps
              <input
                type="file"
                multiple
                accept="image/*,video/*,.gif"
                className="hidden"
                onChange={e => {
                  const files = e.target.files;
                  if (!files) return;
                  Array.from(files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const base64 = ev.target?.result as string;
                      if (base64) {
                        setEditNewMedia(prev => [...prev, { name: file.name, type: file.type || 'image/jpeg', base64 }]);
                      }
                    };
                    reader.readAsDataURL(file);
                  });
                }}
              />
            </label>
          </div>

          {/* Pictures Preview Grid */}
          {(editExistingMedia.length > 0 || editNewMedia.length > 0) ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pt-1">
              {/* Existing Media with Reorder Buttons */}
              {editExistingMedia.map((m, idx) => (
                <div key={m.googleDriveId || idx} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-900">
                  {m.mimeType?.startsWith('video/') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white p-1">
                      <Film className="w-5 h-5 text-blue-400" />
                      <span className="text-[8px] truncate max-w-full font-mono">{m.fileName}</span>
                    </div>
                  ) : (
                    <img
                      src={m.thumbnailUrl || m.viewUrl}
                      alt={m.fileName}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Reorder Buttons */}
                  <div className="absolute top-1 left-1 flex items-center gap-0.5 z-10">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditExistingMedia(prev => {
                            const copy = [...prev];
                            const [item] = copy.splice(idx, 1);
                            copy.splice(idx - 1, 0, item);
                            return copy;
                          });
                        }}
                        className="p-0.5 bg-black/75 hover:bg-black text-white rounded text-[8px] transition"
                        title="Move Earlier"
                      >
                        <ChevronLeft className="w-2.5 h-2.5" />
                      </button>
                    )}
                    {idx < editExistingMedia.length - 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditExistingMedia(prev => {
                            const copy = [...prev];
                            const [item] = copy.splice(idx, 1);
                            copy.splice(idx + 1, 0, item);
                            return copy;
                          });
                        }}
                        className="p-0.5 bg-black/75 hover:bg-black text-white rounded text-[8px] transition"
                        title="Move Later"
                      >
                        <ChevronRight className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditRemovedMediaIds(prev => [...prev, m.googleDriveId]);
                      setEditExistingMedia(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-700 text-white rounded-full shadow transition z-10"
                    title="Remove Snap"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <span className="absolute bottom-0 inset-x-0 bg-slate-900/60 text-white text-[9px] px-1 py-0.5 truncate">
                    {m.fileName}
                  </span>
                </div>
              ))}

              {/* New Media Added */}
              {editNewMedia.map((m, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border-2 border-dashed border-blue-400 aspect-square bg-blue-50/50">
                  {m.type?.startsWith('video/') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-white p-1">
                      <Film className="w-5 h-5 text-blue-400" />
                      <span className="text-[8px] truncate max-w-full font-mono">{m.name}</span>
                    </div>
                  ) : (
                    <img
                      src={m.base64}
                      alt={m.name}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Reorder New Media Buttons */}
                  <div className="absolute top-1 left-1 flex items-center gap-0.5 z-10">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditNewMedia(prev => {
                            const copy = [...prev];
                            const [item] = copy.splice(idx, 1);
                            copy.splice(idx - 1, 0, item);
                            return copy;
                          });
                        }}
                        className="p-0.5 bg-black/75 hover:bg-black text-white rounded text-[8px]"
                        title="Move Earlier"
                      >
                        <ChevronLeft className="w-2.5 h-2.5" />
                      </button>
                    )}
                    {idx < editNewMedia.length - 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditNewMedia(prev => {
                            const copy = [...prev];
                            const [item] = copy.splice(idx, 1);
                            copy.splice(idx + 1, 0, item);
                            return copy;
                          });
                        }}
                        className="p-0.5 bg-black/75 hover:bg-black text-white rounded text-[8px]"
                        title="Move Later"
                      >
                        <ChevronRight className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditNewMedia(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-700 text-white rounded-full shadow transition z-10"
                    title="Remove New Photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <span className="absolute bottom-0 inset-x-0 bg-blue-600/80 text-white text-[9px] px-1 py-0.5 truncate font-semibold">
                    New: {m.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 text-center py-2">No pictures attached to this moment.</p>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={cancelEdit}
            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdatePost}
            disabled={isSavingEdit}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSavingEdit && <RefreshCw className="w-3 h-3 animate-spin" />}
            {isSavingEdit ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Top Bar with Category, Time & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {post.clearanceLevel === 1 && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" title="" />
          )}
          {post.clearanceLevel === 2 && (
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 animate-pulse" title="" />
          )}
          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 font-bold uppercase tracking-wider rounded-md text-[9px]">
            {post.category || 'General'}
          </span>
          <span className="text-slate-400 flex items-center gap-1 font-medium text-[11px]">
            <Clock className="w-3 h-3" />
            {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-[10px] flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5 text-amber-700" />
            <span>{bsDate.formattedBsNp}</span>
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition relative">
          {/* Public Social Share Button (Only for Prakata / Level 0 posts) */}
          {(!post.clearanceLevel || post.clearanceLevel === 0) && (
            <button
              onClick={() => onSharePost(post)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition relative"
              title="Share Public Link (Friends can like/comment with no login)"
            >
              {isShareToastActive ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>
          )}
          {isShareToastActive && (
            <span className="absolute -top-7 right-0 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap animate-in fade-in duration-150 z-30">
              Copied Share Link!
            </span>
          )}

          <button
            onClick={startEdit}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
            title="Edit moment"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Delete moment"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Photo / Video Collage Grid (Facebook Style) */}
      {post.media && post.media.length > 0 && (
        <MediaCollageGrid
          media={post.media}
          onOpenLightbox={(idx) => onOpenLightbox(post.media!, idx)}
        />
      )}

      {/* Title & Description */}
      <div className="space-y-1">
        {post.title && (
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-snug">
            {post.title}
          </h3>
        )}
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans whitespace-pre-wrap">
          {post.content}
        </p>
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {post.tags.map(t => (
            <span
              key={t}
              onClick={() => setSelectedTag(t === selectedTag ? '' : t)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition ${
                selectedTag === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Social Engagement Summary Bar: Facebook Icon Reactions & Comments */}
      <div className="pt-2 border-t border-slate-100/90 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Facebook-Style Reaction Summary with Circular Icon Badges */}
        <div className="flex items-center gap-1.5">
          {reactions.length > 0 ? (
            <FBReactionSummary reactions={reactions} />
          ) : (
            <span className="text-[11px] text-slate-400 italic">No reactions yet</span>
          )}
        </div>

        {/* Comments Count & Public Link */}
        <div className="flex items-center gap-2 ml-auto">
          {comments.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowComments(prev => !prev)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition flex items-center gap-1.5 shadow-2xs ${
                showComments
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>{comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 italic flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5 text-slate-300" />
              <span>0 comments</span>
            </span>
          )}

          <a
            href={`/?timelinePost=${post._id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-slate-50 transition"
            title="Open Public Social Media View"
          >
            <span>Public View</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Collapsible Comments List */}
      {showComments && comments.length > 0 && (
        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2 animate-in fade-in duration-150">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Public Comments ({comments.length}):
          </span>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {comments.map(c => (
              <div key={c.id} className="p-2.5 bg-white rounded-xl border border-slate-100 text-xs space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-extrabold text-slate-800 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[9px] flex items-center justify-center uppercase">
                      {c.name.slice(0, 1)}
                    </span>
                    {c.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-600 pl-5 text-[11px] whitespace-pre-wrap font-medium">
                  {c.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
