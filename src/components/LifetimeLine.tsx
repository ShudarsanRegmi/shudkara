import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Trash2, Edit2, 
  Film, AlertCircle, 
  Loader2, Sparkles, BookOpen, Clock, Calendar,
  ChevronLeft, ChevronRight, Layers, List, Eye, SlidersHorizontal
} from 'lucide-react';
import { 
  adToBs, bsToAd, BS_MONTHS, getAvailableBsYears, getMonthDays, 
  type BikramSambatDate 
} from '../utils/bikramSambat';
import { MediaLightboxModal, type LightboxMediaItem } from './MediaLightboxModal';
import { TimelineWizardModal, type DraftMediaItem } from './TimelineWizardModal';
import { TimelineSidebar } from './TimelineSidebar';

export interface MediaItem {
  googleDriveId: string;
  fileName: string;
  mimeType: string;
  viewUrl: string;
  thumbnailUrl: string;
}

export interface Post {
  _id: string;
  title?: string;
  content: string;
  timestamp: string;
  createdAt: string;
  category: string;
  tags: string[];
  media?: MediaItem[];
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

export const LifetimeLine: React.FC<LifetimeLineProps> = ({ authToken }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
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

  // Social Wizard Modal State
  const [showWizard, setShowWizard] = useState(false);

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
        headers: { 'X-Session-Token': authToken }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Sync successful');
        fetchPosts(true);
        fetchFilterMetadata();
      } else {
        setErrorMsg(data.error || 'Failed to sync Google Drive.');
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
        headers: { 'X-Session-Token': authToken }
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
        headers: { 'X-Session-Token': authToken }
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
      } else {
        setErrorMsg(data.error || 'Failed to load timeline feed.');
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

  // Submit new post from Social Wizard
  const handleWizardSubmit = async (postData: {
    title: string;
    content: string;
    category: string;
    tags: string[];
    timestamp: string;
    mediaFiles: DraftMediaItem[];
  }): Promise<boolean> => {
    if (!authToken) return false;

    const res = await fetch('/api/timeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': authToken
      },
      body: JSON.stringify({
        title: postData.title,
        content: postData.content,
        category: postData.category,
        tags: postData.tags,
        timestamp: postData.timestamp,
        mediaFiles: postData.mediaFiles
      })
    });

    const data = await res.json();
    if (res.ok) {
      fetchPosts(true);
      fetchFilterMetadata();
      return true;
    } else {
      throw new Error(data.error || 'Failed to create post.');
    }
  };

  // Delete post
  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Delete this memory? Media will be moved to trash.') || !authToken) return;

    try {
      const res = await fetch(`/api/timeline/${id}`, {
        method: 'DELETE',
        headers: { 'X-Session-Token': authToken }
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

    try {
      const res = await fetch(`/api/timeline/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          category: editCategory.trim(),
          tags: editRawTags.split(',').map(t => t.trim()).filter(Boolean),
          timestamp: new Date(editTimestamp).toISOString()
        })
      });

      if (res.ok) {
        setPosts(prev => prev.map(p => {
          if (p._id === id) {
            return {
              ...p,
              title: editTitle.trim(),
              content: editContent.trim(),
              category: editCategory.trim(),
              tags: editRawTags.split(',').map(t => t.trim()).filter(Boolean),
              timestamp: new Date(editTimestamp).toISOString()
            };
          }
          return p;
        }));
        setEditingPostId(null);
        fetchFilterMetadata();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update post.');
      }
    } catch {
      alert('Network error.');
    }
  };

  // Open Lightbox
  const handleOpenLightbox = (mediaList: MediaItem[], startIndex: number) => {
    setLightboxItems(mediaList.map(m => ({
      url: m.viewUrl,
      thumbnailUrl: m.thumbnailUrl,
      name: m.fileName,
      type: m.mimeType
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
      
      {/* ── Compact Space-Saving Top Header Bar ── */}
      <div className="flex items-center justify-between gap-3 mb-6 bg-white border border-slate-200/90 px-4 sm:px-6 py-3.5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 leading-none">
              Lifetime Line
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {total} memories in chronicle
            </p>
          </div>
        </div>
        
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
        <div className="flex-1 min-w-0 space-y-8">
          
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
          onClose={() => setShowWizard(false)}
          onSubmit={handleWizardSubmit}
          categoriesList={categories}
          tagsList={tags}
        />
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
}

const MomentCardBody: React.FC<MomentCardBodyProps> = ({
  post,
  isEditing,
  startEdit,
  onDelete,
  onOpenLightbox,
  momentPhotoIndex,
  onTurnMomentPhoto,
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
  cancelEdit
}) => {
  const dt = new Date(post.timestamp);
  const bsDate = adToBs(post.timestamp);
  const mediaCount = post.media?.length || 0;
  const currentMediaIdx = mediaCount > 0 ? momentPhotoIndex % mediaCount : 0;
  const currentMedia = post.media && post.media.length > 0 ? post.media[currentMediaIdx] : null;

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

        <div className="flex gap-2 justify-end">
          <button
            onClick={cancelEdit}
            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdatePost}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
          >
            Save Changes
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

        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
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

      {/* Horizontal Multi-Snap Media Carousel / Deck */}
      {currentMedia && (
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video sm:aspect-[16/9] max-h-[380px] flex items-center justify-center border border-slate-100 shadow-xs group/snap">
          {currentMedia.mimeType.startsWith('video/') ? (
            <div 
              onClick={() => onOpenLightbox(post.media!, currentMediaIdx)}
              className="w-full h-full flex flex-col items-center justify-center relative cursor-pointer text-white"
            >
              <Film className="w-12 h-12 text-blue-400 group-hover/snap:scale-110 transition duration-150" />
              <span className="text-xs font-mono text-slate-300 absolute bottom-3 px-3 truncate max-w-full">{currentMedia.fileName}</span>
            </div>
          ) : (
            <img
              src={currentMedia.viewUrl}
              alt={currentMedia.fileName}
              onClick={() => onOpenLightbox(post.media!, currentMediaIdx)}
              loading="lazy"
              className="w-full h-full object-cover cursor-pointer group-hover/snap:scale-[1.02] transition duration-300"
            />
          )}

          {/* Quick Full-Screen View Overlay */}
          <button
            type="button"
            onClick={() => onOpenLightbox(post.media!, currentMediaIdx)}
            className="absolute top-3 left-3 p-1.5 bg-black/50 hover:bg-black/75 text-white rounded-lg backdrop-blur-md opacity-0 group-hover/snap:opacity-100 transition"
            title="View Full Resolution"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {/* Snap page count badge */}
          {mediaCount > 1 && (
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-0.5 rounded-full text-white text-[10px] font-bold">
              Snap {currentMediaIdx + 1} of {mediaCount}
            </div>
          )}

          {/* Page-turner navigation arrows inside multi-image moment */}
          {mediaCount > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTurnMomentPhoto('prev', mediaCount);
                }}
                className="absolute left-2.5 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition shadow-lg active:scale-90"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTurnMomentPhoto('next', mediaCount);
                }}
                className="absolute right-2.5 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition shadow-lg active:scale-90"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Dot indicators */}
          {mediaCount > 1 && (
            <div className="absolute bottom-2.5 flex items-center gap-1">
              {post.media!.map((_, dotIdx) => (
                <div
                  key={dotIdx}
                  className={`h-1.5 rounded-full transition-all ${
                    dotIdx === currentMediaIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
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
    </div>
  );
};
