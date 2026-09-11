import React, { useState, useEffect } from 'react';
import { 
  Clock, Plus, Search, Pin, PinOff, Lock, Unlock, Share2, 
  Trash2, Edit3, X, Check, Calendar, AlertCircle, Sparkles, Maximize2,
  GripVertical, ChevronLeft, ChevronRight
} from 'lucide-react';

export interface CountdownTimer {
  id: string;
  title: string;
  targetDate: string; // ISO string
  description?: string;
  category?: string;
  color?: string; // indigo, rose, emerald, amber, purple, cyan, slate
  isPinned?: boolean;
  isPrivate?: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface TimersProps {
  authToken?: string | null;
  initialTimerId?: string | null;
}

const COLOR_THEMES: Record<string, { bg: string; border: string; badge: string; text: string; ring: string; gradient: string }> = {
  indigo: {
    bg: 'bg-indigo-50/70',
    border: 'border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-700',
    text: 'text-indigo-600',
    ring: 'focus:ring-indigo-500',
    gradient: 'from-indigo-600 to-purple-600'
  },
  rose: {
    bg: 'bg-rose-50/70',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-700',
    text: 'text-rose-600',
    ring: 'focus:ring-rose-500',
    gradient: 'from-rose-500 to-pink-600'
  },
  emerald: {
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    text: 'text-emerald-600',
    ring: 'focus:ring-emerald-500',
    gradient: 'from-emerald-500 to-teal-600'
  },
  amber: {
    bg: 'bg-amber-50/70',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    text: 'text-amber-600',
    ring: 'focus:ring-amber-500',
    gradient: 'from-amber-500 to-orange-600'
  },
  purple: {
    bg: 'bg-purple-50/70',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    text: 'text-purple-600',
    ring: 'focus:ring-purple-500',
    gradient: 'from-purple-600 to-indigo-600'
  },
  cyan: {
    bg: 'bg-cyan-50/70',
    border: 'border-cyan-200',
    badge: 'bg-cyan-100 text-cyan-800',
    text: 'text-cyan-600',
    ring: 'focus:ring-cyan-500',
    gradient: 'from-cyan-500 to-blue-600'
  },
  slate: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-700',
    text: 'text-slate-600',
    ring: 'focus:ring-slate-500',
    gradient: 'from-slate-700 to-slate-900'
  }
};

const CATEGORIES = ['All', 'Personal', 'Work', 'Deadline', 'Milestone', 'Event'];

export const Timers: React.FC<TimersProps> = ({ authToken, initialTimerId }) => {
  const [timers, setTimers] = useState<CountdownTimer[]>([]);
  const [isBoardPrivate, setIsBoardPrivate] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

  // UI Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTimer, setEditingTimer] = useState<CountdownTimer | null>(null);
  const [focusedTimer, setFocusedTimer] = useState<CountdownTimer | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('Personal');
  const [formColor, setFormColor] = useState('indigo');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formIsPrivate, setFormIsPrivate] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Live timer interval (ticks every second)
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch timers from API
  useEffect(() => {
    fetchTimers();
  }, [authToken]);

  // Open initial focused timer if initialTimerId is provided in URL
  useEffect(() => {
    if (initialTimerId && timers.length > 0) {
      const found = timers.find(t => t.id === initialTimerId);
      if (found) {
        setFocusedTimer(found);
      }
    }
  }, [initialTimerId, timers]);

  const fetchTimers = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch('/api/timers', { headers });
      if (res.ok) {
        const data = await res.json();
        setTimers(Array.isArray(data.timers) ? data.timers : []);
        setIsBoardPrivate(!!data.isBoardPrivate);
      }
    } catch (err) {
      console.error('Failed to load timers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Section Board Privacy
  const handleToggleBoardPrivacy = async () => {
    if (!authToken) return;
    const nextState = !isBoardPrivate;
    setIsBoardPrivate(nextState);
    try {
      await fetch('/api/timers/privacy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken
        },
        body: JSON.stringify({ isBoardPrivate: nextState })
      });
      triggerToast(nextState ? 'Timers section set to Private' : 'Timers section set to Public');
    } catch (err) {
      triggerToast('Failed to update privacy setting', 'error');
    }
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingTimer(null);
    setFormTitle('');
    // Default target date: tomorrow at current time
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localIso = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
    setFormTargetDate(localIso);
    setFormDesc('');
    setFormCategory('Personal');
    setFormColor('indigo');
    setFormIsPinned(false);
    setFormIsPrivate(false);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (t: CountdownTimer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTimer(t);
    setFormTitle(t.title);
    
    // Format date for datetime-local input
    const d = new Date(t.targetDate);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localIso = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setFormTargetDate(localIso);

    setFormDesc(t.description || '');
    setFormCategory(t.category || 'Personal');
    setFormColor(t.color || 'indigo');
    setFormIsPinned(!!t.isPinned);
    setFormIsPrivate(!!t.isPrivate);
    setIsModalOpen(true);
  };

  // Save Timer Submit
  const handleSaveTimer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formTargetDate) return;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    const payload = {
      title: formTitle,
      targetDate: new Date(formTargetDate).toISOString(),
      description: formDesc,
      category: formCategory,
      color: formColor,
      isPinned: formIsPinned,
      isPrivate: formIsPrivate
    };

    try {
      if (editingTimer) {
        const res = await fetch(`/api/timers/${editingTimer.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const updated = await res.json();
          setTimers(prev => prev.map(item => item.id === updated.id ? updated : item));
          if (focusedTimer?.id === updated.id) setFocusedTimer(updated);
          triggerToast('Timer updated successfully');
        }
      } else {
        const res = await fetch('/api/timers', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          setTimers(prev => [created, ...prev]);
          triggerToast('Timer created successfully');
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      triggerToast('Failed to save timer', 'error');
    }
  };

  // Delete Timer
  const handleDeleteTimer = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this timer?')) return;

    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch(`/api/timers/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setTimers(prev => prev.filter(t => t.id !== id));
        if (focusedTimer?.id === id) setFocusedTimer(null);
        triggerToast('Timer deleted');
      }
    } catch (err) {
      triggerToast('Failed to delete timer', 'error');
    }
  };

  // Toggle Pinned
  const handleTogglePin = async (t: CountdownTimer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!authToken) return;
    const nextPinned = !t.isPinned;
    const updated = { ...t, isPinned: nextPinned };

    setTimers(prev => prev.map(item => item.id === t.id ? updated : item));
    if (focusedTimer?.id === t.id) setFocusedTimer(updated);

    try {
      await fetch(`/api/timers/${t.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken
        },
        body: JSON.stringify({ isPinned: nextPinned })
      });
      triggerToast(nextPinned ? 'Timer pinned to Whiteboard' : 'Timer unpinned');
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Item Granular Privacy
  const handleToggleItemPrivate = async (t: CountdownTimer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!authToken) return;
    const nextPrivate = !t.isPrivate;
    const updated = { ...t, isPrivate: nextPrivate };

    setTimers(prev => prev.map(item => item.id === t.id ? updated : item));
    if (focusedTimer?.id === t.id) setFocusedTimer(updated);

    try {
      await fetch(`/api/timers/${t.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken
        },
        body: JSON.stringify({ isPrivate: nextPrivate })
      });
      triggerToast(nextPrivate ? 'Timer set to Private' : 'Timer set to Public');
    } catch (err) {
      console.error(err);
    }
  };

  // Share Timer Link
  const handleShareLink = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = `${window.location.origin}/?timerId=${id}`;
    navigator.clipboard.writeText(shareUrl);
    triggerToast('Timer share link copied to clipboard!');
  };

  // Calculate remaining time breakdown
  const getRemainingTime = (targetIso: string) => {
    const targetMs = new Date(targetIso).getTime();
    const diff = targetMs - now;

    if (diff <= 0) {
      return { isExpired: true, days: 0, hours: 0, minutes: 0, seconds: 0, diffMs: 0 };
    }

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    return { isExpired: false, days, hours, minutes, seconds, diffMs: diff };
  };

  // Calculate equivalent date breakdown in years, months, and days
  const getHumanizedDuration = (targetIso: string): string | null => {
    const target = new Date(targetIso);
    const from = new Date(now);
    const diffMs = target.getTime() - from.getTime();
    if (diffMs <= 0) return null;

    let years = target.getFullYear() - from.getFullYear();
    let months = target.getMonth() - from.getMonth();
    let days = target.getDate() - from.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(target.getFullYear(), target.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
    if (days > 0 || parts.length === 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);

    return parts.join(', ');
  };

  // Drag & drop / Reorder handlers
  const [draggedTimerId, setDraggedTimerId] = useState<string | null>(null);

  const handleReorderTimers = async (reordered: CountdownTimer[]) => {
    setTimers(reordered);
    if (!authToken) return;
    const payloadItems = reordered.map((t, idx) => ({ id: t.id, order: idx }));
    try {
      await fetch('/api/timers/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken
        },
        body: JSON.stringify({ items: payloadItems })
      });
    } catch (err) {
      console.error('Failed to save reordered timers:', err);
    }
  };

  const handleMoveTimer = (timerId: string, direction: 'prev' | 'next', e: React.MouseEvent) => {
    e.stopPropagation();
    const currIndex = timers.findIndex(t => t.id === timerId);
    if (currIndex === -1) return;
    const targetIndex = direction === 'prev' ? currIndex - 1 : currIndex + 1;
    if (targetIndex < 0 || targetIndex >= timers.length) return;

    const newTimers = [...timers];
    const [moved] = newTimers.splice(currIndex, 1);
    newTimers.splice(targetIndex, 0, moved);
    handleReorderTimers(newTimers);
    triggerToast('Timer order updated');
  };

  const handleDragStart = (timerId: string) => {
    setDraggedTimerId(timerId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetTimerId: string) => {
    if (!draggedTimerId || draggedTimerId === targetTimerId) return;
    const fromIdx = timers.findIndex(t => t.id === draggedTimerId);
    const toIdx = timers.findIndex(t => t.id === targetTimerId);
    if (fromIdx === -1 || toIdx === -1) return;

    const newTimers = [...timers];
    const [moved] = newTimers.splice(fromIdx, 1);
    newTimers.splice(toIdx, 0, moved);
    setDraggedTimerId(null);
    handleReorderTimers(newTimers);
    triggerToast('Timer reordered successfully!');
  };

  // Filtered list
  const filteredTimers = timers.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || (t.category || 'Personal') === selectedCategory;
    const matchesPinned = !showPinnedOnly || t.isPinned;
    return matchesSearch && matchesCat && matchesPinned;
  });

  const pinnedTimers = timers.filter(t => t.isPinned);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 text-slate-800">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium flex items-center gap-2.5 transition-all duration-300 animate-slide-up ${
          toastMsg.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-700' 
            : 'bg-slate-900 border-slate-800 text-white'
        }`}>
          {toastMsg.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-500" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
          {toastMsg.text}
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        
        {/* Header Section */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                  Countdown Vault
                  {isBoardPrivate && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-full">
                      <Lock className="w-3 h-3" /> Private Board
                    </span>
                  )}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Track important dates, upcoming milestones, and personal countdowns in real-time.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {authToken && (
              <button
                onClick={handleToggleBoardPrivacy}
                className={`px-4 py-2.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 transition-all shadow-sm ${
                  isBoardPrivate
                    ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="Toggle Master Section Privacy"
              >
                {isBoardPrivate ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4 text-emerald-600" />}
                <span>{isBoardPrivate ? 'Private Section' : 'Public Section'}</span>
              </button>
            )}

            {authToken && (
              <button
                onClick={handleOpenCreate}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New Timer</span>
              </button>
            )}
          </div>
        </div>

        {/* WHITEBOARD PINNED CANVAS AREA */}
        {pinnedTimers.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-900/50 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Pin className="w-4 h-4 text-amber-400 fill-amber-400 rotate-12" />
                Whiteboard Pinned Focus
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {pinnedTimers.length} Pinned {pinnedTimers.length === 1 ? 'Timer' : 'Timers'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {pinnedTimers.map(t => {
                const rem = getRemainingTime(t.targetDate);
                return (
                  <div
                    key={`pinned-${t.id}`}
                    onClick={() => setFocusedTimer(t)}
                    className="group bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-white/15 text-indigo-200">
                          {t.category || 'Personal'}
                        </span>
                        <h3 className="font-bold text-white text-base mt-1 line-clamp-1 group-hover:text-indigo-200 transition-colors">
                          {t.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1">
                        {authToken && (
                          <button
                            onClick={(e) => handleTogglePin(t, e)}
                            className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-white/10 transition-colors"
                            title="Unpin from Whiteboard"
                          >
                            <PinOff className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleShareLink(t.id, e)}
                          className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                          title="Share direct link"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Countdown Digits */}
                    {rem.isExpired ? (
                      <div className="py-2 text-amber-300 font-bold text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 animate-bounce" /> Time Arrived / Event Started!
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
                        <div className="bg-slate-900/60 rounded-xl p-2 border border-white/10">
                          <div className="text-xl font-black text-white">{rem.days}</div>
                          <div className="text-[9px] uppercase text-slate-400">Days</div>
                        </div>
                        <div className="bg-slate-900/60 rounded-xl p-2 border border-white/10">
                          <div className="text-xl font-black text-white">{String(rem.hours).padStart(2, '0')}</div>
                          <div className="text-[9px] uppercase text-slate-400">Hours</div>
                        </div>
                        <div className="bg-slate-900/60 rounded-xl p-2 border border-white/10">
                          <div className="text-xl font-black text-white">{String(rem.minutes).padStart(2, '0')}</div>
                          <div className="text-[9px] uppercase text-slate-400">Mins</div>
                        </div>
                        <div className="bg-slate-900/60 rounded-xl p-2 border border-white/10">
                          <div className="text-xl font-black text-indigo-300">{String(rem.seconds).padStart(2, '0')}</div>
                          <div className="text-[9px] uppercase text-slate-400">Secs</div>
                        </div>
                      </div>
                    )}

                    {/* Equivalent Date duration in months/days/years */}
                    {(() => {
                      const humanized = getHumanizedDuration(t.targetDate);
                      return humanized ? (
                        <div className="text-[10px] font-medium text-indigo-200 text-center bg-white/10 rounded-lg py-1 px-2 border border-white/10 mt-1">
                          ⏳ Approx. <strong className="text-white font-bold">{humanized}</strong> remaining
                        </div>
                      ) : null;
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              onClick={() => setShowPinnedOnly(prev => !prev)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 whitespace-nowrap ${
                showPinnedOnly
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Pin className="w-3 h-3" /> Pinned
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search timers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* TIMERS GRID */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-56 bg-white border border-slate-200 rounded-3xl p-6" />
            ))}
          </div>
        ) : filteredTimers.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">No Countdown Timers Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery || selectedCategory !== 'All' 
                  ? 'No timers match your search criteria. Try resetting filters.'
                  : 'Start tracking important dates by creating your first countdown timer.'}
              </p>
            </div>
            {authToken && (
              <button
                onClick={handleOpenCreate}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-md transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Countdown
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTimers.map(t => {
              const rem = getRemainingTime(t.targetDate);
              const theme = COLOR_THEMES[t.color || 'indigo'] || COLOR_THEMES.indigo;
              const formattedDate = new Date(t.targetDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={t.id}
                  draggable={!!authToken}
                  onDragStart={() => handleDragStart(t.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(t.id)}
                  onClick={() => setFocusedTimer(t)}
                  className={`group bg-white border ${theme.border} rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden hover:-translate-y-1 ${
                    draggedTimerId === t.id ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''
                  }`}
                >
                  {/* Accent Top Border Bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${theme.gradient}`} />

                  {/* Top Bar Info & Badges */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {authToken && (
                          <div 
                            className="p-1 text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing hover:bg-slate-100 rounded-lg transition-colors"
                            title="Drag to reorder"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${theme.badge}`}>
                          {t.category || 'Personal'}
                        </span>
                        {t.isPrivate && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Private
                          </span>
                        )}
                      </div>

                      {/* Action Menu Buttons */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {authToken && (
                          <>
                            <button
                              onClick={(e) => handleMoveTimer(t.id, 'prev', e)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Move Left"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleMoveTimer(t.id, 'next', e)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Move Right"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {authToken && (
                          <button
                            onClick={(e) => handleTogglePin(t, e)}
                            className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${
                              t.isPinned ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title={t.isPinned ? 'Unpin from Whiteboard' : 'Pin to Whiteboard'}
                          >
                            <Pin className={`w-4 h-4 ${t.isPinned ? 'fill-amber-500' : ''}`} />
                          </button>
                        )}

                        {authToken && (
                          <button
                            onClick={(e) => handleToggleItemPrivate(t, e)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title={t.isPrivate ? 'Make Public' : 'Make Private'}
                          >
                            {t.isPrivate ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4 text-emerald-600" />}
                          </button>
                        )}

                        <button
                          onClick={(e) => handleShareLink(t.id, e)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          title="Copy Share Link"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        {authToken && (
                          <button
                            onClick={(e) => handleOpenEdit(t, e)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Edit Timer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {authToken && (
                          <button
                            onClick={(e) => handleDeleteTimer(t.id, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Delete Timer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {t.title}
                    </h3>
                    {t.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                    )}
                  </div>

                  {/* Dynamic Countdown Section */}
                  <div className="mt-6 pt-4 border-t border-slate-100">
                    {rem.isExpired ? (
                      <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl text-center space-y-1">
                        <div className="text-amber-800 font-extrabold text-sm flex items-center justify-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" /> Goal / Date Reached!
                        </div>
                        <p className="text-[11px] text-amber-600 font-medium">Target passed on {formattedDate}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-2 text-center font-mono">
                          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl py-2 px-1">
                            <div className="text-xl font-extrabold text-slate-900">{rem.days}</div>
                            <div className="text-[9px] uppercase font-bold text-slate-400">Days</div>
                          </div>
                          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl py-2 px-1">
                            <div className="text-xl font-extrabold text-slate-900">{String(rem.hours).padStart(2, '0')}</div>
                            <div className="text-[9px] uppercase font-bold text-slate-400">Hours</div>
                          </div>
                          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl py-2 px-1">
                            <div className="text-xl font-extrabold text-slate-900">{String(rem.minutes).padStart(2, '0')}</div>
                            <div className="text-[9px] uppercase font-bold text-slate-400">Mins</div>
                          </div>
                          <div className={`border rounded-2xl py-2 px-1 ${theme.bg} ${theme.border}`}>
                            <div className={`text-xl font-extrabold ${theme.text}`}>{String(rem.seconds).padStart(2, '0')}</div>
                            <div className="text-[9px] uppercase font-bold text-slate-400">Secs</div>
                          </div>
                        </div>

                        {/* Equivalent Date duration in months/days/years */}
                        {(() => {
                          const humanized = getHumanizedDuration(t.targetDate);
                          return humanized ? (
                            <div className="text-[11px] font-medium text-slate-600 bg-indigo-50/70 rounded-xl py-1.5 px-3 border border-indigo-100/80 flex items-center justify-center gap-1.5 text-center">
                              <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span>Approx. <strong className="text-slate-900 font-semibold">{humanized}</strong> remaining</span>
                            </div>
                          ) : null;
                        })()}

                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> {formattedDate}
                          </span>
                          <span className="text-indigo-600 group-hover:underline flex items-center gap-1 font-semibold">
                            Focus View <Maximize2 className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FOCUSED / IMMERSIVE "BIGGER SCREEN" TIMER VIEW MODAL */}
      {focusedTimer && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 text-white shadow-2xl space-y-8 my-auto overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Top Controls */}
            <div className="flex items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold uppercase tracking-wider">
                  {focusedTimer.category || 'Personal'}
                </span>
                {focusedTimer.isPrivate && (
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Private
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleShareLink(focusedTimer.id)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <Share2 className="w-4 h-4 text-indigo-400" /> Share Link
                </button>
                <button
                  onClick={() => setFocusedTimer(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Immersive Title & Description */}
            <div className="text-center space-y-3 relative z-10">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                {focusedTimer.title}
              </h2>
              {focusedTimer.description && (
                <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                  "{focusedTimer.description}"
                </p>
              )}
            </div>

            {/* BIG IMMERSIVE COUNTDOWN DIGITS */}
            <div className="relative z-10 py-6">
              {(() => {
                const rem = getRemainingTime(focusedTimer.targetDate);
                if (rem.isExpired) {
                  return (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-8 text-center space-y-3 animate-pulse">
                      <Sparkles className="w-12 h-12 text-amber-400 mx-auto" />
                      <h3 className="text-2xl font-black text-amber-300">Countdown Completed!</h3>
                      <p className="text-sm text-slate-300">
                        The target date ({new Date(focusedTimer.targetDate).toLocaleString()}) has arrived.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
                    <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-inner backdrop-blur-md">
                      <div className="text-4xl sm:text-6xl font-black text-white tracking-tight">{rem.days}</div>
                      <div className="text-xs uppercase font-bold text-slate-400 mt-2">Days</div>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-inner backdrop-blur-md">
                      <div className="text-4xl sm:text-6xl font-black text-white tracking-tight">{String(rem.hours).padStart(2, '0')}</div>
                      <div className="text-xs uppercase font-bold text-slate-400 mt-2">Hours</div>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-inner backdrop-blur-md">
                      <div className="text-4xl sm:text-6xl font-black text-white tracking-tight">{String(rem.minutes).padStart(2, '0')}</div>
                      <div className="text-xs uppercase font-bold text-slate-400 mt-2">Minutes</div>
                    </div>
                    <div className="bg-indigo-600/30 border border-indigo-500/50 rounded-3xl p-5 sm:p-6 shadow-inner backdrop-blur-md">
                      <div className="text-4xl sm:text-6xl font-black text-indigo-300 tracking-tight">{String(rem.seconds).padStart(2, '0')}</div>
                      <div className="text-xs uppercase font-bold text-indigo-400 mt-2">Seconds</div>
                    </div>
                  </div>
                );
              })()}

              {/* Equivalent Date duration in months/days/years */}
              {(() => {
                const humanized = getHumanizedDuration(focusedTimer.targetDate);
                return humanized ? (
                  <div className="mt-4 py-3 px-5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-center text-sm text-indigo-200 font-medium backdrop-blur-sm">
                    ⏳ Equivalent duration: <strong className="text-white font-bold text-base">{humanized}</strong> remaining
                  </div>
                ) : null;
              })()}
            </div>

            {/* Target Date Details & Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800 text-xs text-slate-400 relative z-10">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Target: <strong className="text-slate-200 font-semibold">{new Date(focusedTimer.targetDate).toLocaleString()}</strong></span>
              </div>

              {authToken && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleTogglePin(focusedTimer, e)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      focusedTimer.isPinned
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                    {focusedTimer.isPinned ? 'Pinned to Whiteboard' : 'Pin to Whiteboard'}
                  </button>
                  <button
                    onClick={() => {
                      const timerToEdit = focusedTimer;
                      setFocusedTimer(null);
                      handleOpenEdit(timerToEdit);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                  >
                    Edit Timer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT TIMER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                {editingTimer ? 'Edit Countdown Timer' : 'Create New Countdown Timer'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTimer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Timer Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. New Year 2027, App Release, Vacation Flight"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Target Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formTargetDate}
                  onChange={(e) => setFormTargetDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Theme Color
                  </label>
                  <select
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 capitalize"
                  >
                    {Object.keys(COLOR_THEMES).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Description / Note (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Add context, milestone goal notes, or a motivation quote..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Pin to Whiteboard Featured Banner</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formIsPrivate}
                    onChange={(e) => setFormIsPrivate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Private Timer (Logged-in only)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Save Timer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
