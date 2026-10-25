import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Workflow,
  FileCode,
  Clock,
  Package,
  CheckSquare,
  ListOrdered,
  BookOpen,
  Share2,
  FileText,
  Terminal,
  Sparkles,
  Link as LinkIcon,
  Key as KeyIcon,
  Image as ImageIcon,
  SlidersHorizontal,
  Search,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  X,
  Lock,
  Eye,
  EyeOff,
  LayoutGrid,
  Pencil,
  Cloud,
  RefreshCw,
  Flame
} from 'lucide-react';

export interface AppDefinition {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'Tools & Utilities' | 'Knowledge & Vaults';
  requiresLogin: boolean;
  colorBg: string;
  colorText: string;
  colorBorder: string;
}

export const ALL_APPS: AppDefinition[] = [
  {
    id: 'notes',
    label: 'Notes',
    description: 'Categorized markdown notebook, tags, cards & organization',
    icon: FileText,
    category: 'Knowledge & Vaults',
    requiresLogin: false,
    colorBg: 'bg-indigo-50',
    colorText: 'text-indigo-700',
    colorBorder: 'border-indigo-200'
  },
  {
    id: 'streaks',
    label: 'Streaks',
    description: 'Daily photo streak challenge with aggressive Duolingo reminders',
    icon: Flame,
    category: 'Knowledge & Vaults',
    requiresLogin: false,
    colorBg: 'bg-orange-50',
    colorText: 'text-orange-700',
    colorBorder: 'border-orange-200'
  },
  {
    id: 'savepost',
    label: 'SavePost',
    description: 'Social post & link bookmark vault with auto-metadata',
    icon: Bookmark,
    category: 'Knowledge & Vaults',
    requiresLogin: false,
    colorBg: 'bg-amber-50',
    colorText: 'text-amber-700',
    colorBorder: 'border-amber-200'
  },
  {
    id: 'concurrency',
    label: 'Concurrency',
    description: 'Parallel workstreams, context manager & task tracker',
    icon: Workflow,
    category: 'Tools & Utilities',
    requiresLogin: false,
    colorBg: 'bg-indigo-50',
    colorText: 'text-indigo-700',
    colorBorder: 'border-indigo-200'
  },
  {
    id: 'pastebin',
    label: 'Pastebin',
    description: 'Ephemeral & persistent code, image and doc pastes',
    icon: FileCode,
    category: 'Tools & Utilities',
    requiresLogin: false,
    colorBg: 'bg-sky-50',
    colorText: 'text-sky-700',
    colorBorder: 'border-sky-200'
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Lifetime Line daily moments, camera snaps & memories',
    icon: Sparkles,
    category: 'Knowledge & Vaults',
    requiresLogin: true,
    colorBg: 'bg-pink-50',
    colorText: 'text-pink-700',
    colorBorder: 'border-pink-200'
  },
  {
    id: 'timers',
    label: 'Timers',
    description: 'Multiple countdown timers with whiteboard canvas',
    icon: Clock,
    category: 'Tools & Utilities',
    requiresLogin: false,
    colorBg: 'bg-emerald-50',
    colorText: 'text-emerald-700',
    colorBorder: 'border-emerald-200'
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Private personal belongings & asset tracker',
    icon: Package,
    category: 'Knowledge & Vaults',
    requiresLogin: true,
    colorBg: 'bg-purple-50',
    colorText: 'text-purple-700',
    colorBorder: 'border-purple-200'
  },
  {
    id: 'todos',
    label: 'Todos',
    description: 'Aesthetic whiteboard & flat task management',
    icon: CheckSquare,
    category: 'Tools & Utilities',
    requiresLogin: false,
    colorBg: 'bg-teal-50',
    colorText: 'text-teal-700',
    colorBorder: 'border-teal-200'
  },
  {
    id: 'lists',
    label: 'Lists',
    description: 'Static reference collections, checklists & notes',
    icon: ListOrdered,
    category: 'Knowledge & Vaults',
    requiresLogin: false,
    colorBg: 'bg-cyan-50',
    colorText: 'text-cyan-700',
    colorBorder: 'border-cyan-200'
  },
  {
    id: 'leetcode',
    label: 'Tracker',
    description: 'Blind 75 & coding interview problem revision',
    icon: BookOpen,
    category: 'Knowledge & Vaults',
    requiresLogin: false,
    colorBg: 'bg-orange-50',
    colorText: 'text-orange-700',
    colorBorder: 'border-orange-200'
  },
  {
    id: 'airdrop',
    label: 'Airdrop',
    description: 'Direct P2P serverless browser-to-browser file sharing',
    icon: Share2,
    category: 'Tools & Utilities',
    requiresLogin: false,
    colorBg: 'bg-blue-50',
    colorText: 'text-blue-700',
    colorBorder: 'border-blue-200'
  },
  {
    id: 'textroom',
    label: 'Rooms',
    description: 'Live collaborative text pad protected with passcode',
    icon: FileText,
    category: 'Tools & Utilities',
    requiresLogin: false,
    colorBg: 'bg-slate-100',
    colorText: 'text-slate-700',
    colorBorder: 'border-slate-200'
  },
  {
    id: 'prompts',
    label: 'PromptVault',
    description: 'AI prompt engineering library & share links',
    icon: Terminal,
    category: 'Knowledge & Vaults',
    requiresLogin: false,
    colorBg: 'bg-violet-50',
    colorText: 'text-violet-700',
    colorBorder: 'border-violet-200'
  },
  {
    id: 'links',
    label: 'LinkManager',
    description: 'Hierarchical tree bookmark & directory organizer',
    icon: LinkIcon,
    category: 'Knowledge & Vaults',
    requiresLogin: false,
    colorBg: 'bg-rose-50',
    colorText: 'text-rose-700',
    colorBorder: 'border-rose-200'
  },
  {
    id: 'keyval',
    label: 'KeyVal',
    description: 'Encrypted key-value runbox for rapid credentials',
    icon: KeyIcon,
    category: 'Tools & Utilities',
    requiresLogin: false,
    colorBg: 'bg-amber-50',
    colorText: 'text-amber-800',
    colorBorder: 'border-amber-200'
  },
  {
    id: 'imgdrop',
    label: 'ImgDrop',
    description: 'Temporary image drop & cloud share utility',
    icon: ImageIcon,
    category: 'Tools & Utilities',
    requiresLogin: false,
    colorBg: 'bg-emerald-50',
    colorText: 'text-emerald-800',
    colorBorder: 'border-emerald-200'
  }
];

export interface ShortcutPreference {
  id: string;
  visible: boolean;
  customLabel?: string;
}

const STORAGE_KEY = 'shudkara_home_shortcuts';

interface AppDrawerProps {
  onNavigate: (tabKey: string) => void;
  authToken: string | null;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({ onNavigate, authToken }) => {
  // Initialize shortcut preferences from localStorage for instant zero-latency UI
  const [preferences, setPreferences] = useState<ShortcutPreference[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: ShortcutPreference[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge in any newly introduced apps not present in saved preferences
          const savedIds = new Set(parsed.map(p => p.id));
          const missing = ALL_APPS.filter(app => !savedIds.has(app.id)).map(app => ({
            id: app.id,
            visible: true
          }));
          return [...parsed, ...missing];
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved shortcut preferences:', e);
    }
    // Default: all apps visible in default order
    return ALL_APPS.map(app => ({ id: app.id, visible: true }));
  });

  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'Tools & Utilities' | 'Knowledge & Vaults' | 'pinned'>('all');
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [tempLabel, setTempLabel] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Fetch shortcuts from server and merge with client
  const fetchShortcutsFromServer = async () => {
    try {
      setSyncStatus('syncing');
      const res = await fetch('/api/shortcuts');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.shortcuts) && data.shortcuts.length > 0) {
          const serverShortcuts: ShortcutPreference[] = data.shortcuts;
          const serverIds = new Set(serverShortcuts.map(s => s.id));
          const missing = ALL_APPS.filter(app => !serverIds.has(app.id)).map(app => ({
            id: app.id,
            visible: true
          }));
          const merged = [...serverShortcuts, ...missing];
          setPreferences(merged);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
          setSyncStatus('synced');
          return;
        }
      }
      setSyncStatus('synced');
    } catch (err) {
      console.warn('Failed to fetch shortcuts from server:', err);
      setSyncStatus('idle');
    }
  };

  // Sync from server on mount and listen to multi-tab storage updates
  useEffect(() => {
    fetchShortcutsFromServer();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPreferences(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Update preferences locally and persist immediately to server
  const savePreferences = async (newPrefs: ShortcutPreference[]) => {
    setPreferences(newPrefs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }

    setSyncStatus('syncing');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;
      const res = await fetch('/api/shortcuts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ shortcuts: newPrefs })
      });
      if (res.ok) {
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Failed to save shortcuts to server:', err);
      setSyncStatus('error');
    }
  };

  // Map preferences to combined app objects
  const appMap = new Map(ALL_APPS.map(a => [a.id, a]));
  const orderedApps = preferences
    .map(pref => {
      const def = appMap.get(pref.id);
      if (!def) return null;
      return {
        ...def,
        visible: pref.visible,
        displayLabel: pref.customLabel?.trim() || def.label
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  // Reordering helpers
  const moveApp = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= preferences.length) return;
    const newPrefs = [...preferences];
    const temp = newPrefs[index];
    newPrefs[index] = newPrefs[targetIndex];
    newPrefs[targetIndex] = temp;
    savePreferences(newPrefs);
  };

  const toggleVisibility = (id: string) => {
    const newPrefs = preferences.map(p =>
      p.id === id ? { ...p, visible: !p.visible } : p
    );
    savePreferences(newPrefs);
  };

  const startRename = (id: string, currentLabel: string) => {
    setEditingLabelId(id);
    setTempLabel(currentLabel);
  };

  const saveRename = (id: string) => {
    const newPrefs = preferences.map(p =>
      p.id === id ? { ...p, customLabel: tempLabel.trim() || undefined } : p
    );
    savePreferences(newPrefs);
    setEditingLabelId(null);
  };

  const resetToDefault = () => {
    if (window.confirm('Reset all app shortcuts to original defaults?')) {
      const defaults = ALL_APPS.map(app => ({ id: app.id, visible: true }));
      savePreferences(defaults);
      setIsEditing(false);
    }
  };

  // Filter apps for display
  const filteredApps = orderedApps.filter(app => {
    if (!isEditing && activeCategory === 'pinned' && !app.visible) return false;
    if (!isEditing && activeCategory !== 'all' && activeCategory !== 'pinned' && app.category !== activeCategory) {
      return false;
    }
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLabel = app.displayLabel.toLowerCase().includes(q);
      const matchDesc = app.description.toLowerCase().includes(q);
      const matchId = app.id.toLowerCase().includes(q);
      if (!matchLabel && !matchDesc && !matchId) return false;
    }
    // In normal (non-editing) mode, only display visible apps unless user chose 'all'
    if (!isEditing && activeCategory !== 'all' && !app.visible) {
      return false;
    }
    if (!isEditing && activeCategory === 'all' && !app.visible) {
      return false;
    }
    return true;
  });

  const pinnedCount = preferences.filter(p => p.visible).length;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
      {/* Drawer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              App Drawer & Shortcuts
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {pinnedCount} / {ALL_APPS.length} active
            </span>

            {/* Cloud Sync Status Pill */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition ${
                syncStatus === 'syncing'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : syncStatus === 'synced'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : syncStatus === 'error'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
              title="Synced with server across laptop and phone"
            >
              {syncStatus === 'syncing' ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                  <span className="text-[11px]">Syncing...</span>
                </>
              ) : syncStatus === 'synced' ? (
                <>
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  <span className="text-[11px]">Synced to cloud</span>
                </>
              ) : syncStatus === 'error' ? (
                <>
                  <Cloud className="w-3 h-3 text-amber-600" />
                  <span className="text-[11px]">Saved locally</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 text-slate-400" />
                  <span className="text-[11px]">Cloud sync</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Click any shortcut to launch the app. Customize the grid order or toggle visibility anytime.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick sync reload button */}
          <button
            onClick={fetchShortcutsFromServer}
            disabled={syncStatus === 'syncing'}
            className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-xl transition disabled:opacity-50"
            title="Refresh shortcuts from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
          </button>
          {isEditing && (
            <button
              onClick={resetToDefault}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-xl transition flex items-center gap-1.5"
              title="Reset order and visibility to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm ${
              isEditing
                ? 'bg-blue-600 text-white hover:bg-blue-750'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            {isEditing ? (
              <>
                <Check className="w-4 h-4" />
                <span>Done Editing</span>
              </>
            ) : (
              <>
                <SlidersHorizontal className="w-4 h-4" />
                <span>Customize Shortcuts</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        {!isEditing && (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60 w-fit">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeCategory === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Pinned ({pinnedCount})
            </button>
            <button
              onClick={() => setActiveCategory('Tools & Utilities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeCategory === 'Tools & Utilities'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tools & Utilities
            </button>
            <button
              onClick={() => setActiveCategory('Knowledge & Vaults')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeCategory === 'Knowledge & Vaults'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Knowledge & Vaults
            </button>
          </div>
        )}

        {isEditing && (
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <span>Customize view: Use arrows to reorder, eye to show/hide, or pencil to rename.</span>
          </div>
        )}

        {/* Search Input */}
        <div className="relative min-w-[200px] sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── EDIT MODE VIEW ── */}
      {isEditing ? (
        <div className="space-y-2 border border-slate-200 rounded-2xl p-3 bg-slate-50/60 max-h-[500px] overflow-y-auto">
          {orderedApps.map((app, index) => {
            const Icon = app.icon;
            const isFirst = index === 0;
            const isLast = index === orderedApps.length - 1;
            const isRenaming = editingLabelId === app.id;

            return (
              <div
                key={app.id}
                className={`flex items-center justify-between gap-3 p-3 bg-white border rounded-xl transition ${
                  app.visible ? 'border-slate-200 shadow-xs' : 'border-dashed border-slate-300 opacity-60'
                }`}
              >
                {/* Left: Drag index + Icon + Title */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xs font-mono font-bold text-slate-400 w-5 text-right shrink-0">
                    {index + 1}
                  </span>

                  <div className={`p-2 rounded-xl shrink-0 border ${app.colorBg} ${app.colorText} ${app.colorBorder}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tempLabel}
                          onChange={e => setTempLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveRename(app.id);
                            if (e.key === 'Escape') setEditingLabelId(null);
                          }}
                          className="px-2 py-1 text-xs font-bold border border-blue-400 rounded-lg focus:outline-none bg-white w-48"
                          autoFocus
                        />
                        <button
                          onClick={() => saveRename(app.id)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md"
                          title="Save Label"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingLabelId(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded-md"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 truncate">
                          {app.displayLabel}
                        </span>
                        {app.displayLabel !== app.label && (
                          <span className="text-[10px] text-slate-400 truncate">({app.label})</span>
                        )}
                        <button
                          onClick={() => startRename(app.id, app.displayLabel)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                          title="Rename shortcut"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 truncate">{app.description}</p>
                  </div>
                </div>

                {/* Right: Controls (Visibility Toggle + Move Up / Down) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleVisibility(app.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                      app.visible
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                    }`}
                    title={app.visible ? 'Hide from drawer' : 'Show in drawer'}
                  >
                    {app.visible ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Hidden</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                    <button
                      onClick={() => moveApp(index, 'up')}
                      disabled={isFirst}
                      className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 rounded transition"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveApp(index, 'down')}
                      disabled={isLast}
                      className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 rounded transition"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── NORMAL APP DRAWER GRID ── */
        <div>
          {filteredApps.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl space-y-2">
              <LayoutGrid className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">No matching apps found</p>
              <p className="text-xs text-slate-400">
                {searchQuery
                  ? 'Try adjusting your search query.'
                  : 'All shortcuts may be hidden. Click "Customize Shortcuts" to re-enable them.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredApps.map(app => {
                const Icon = app.icon;
                const requiresAuth = app.requiresLogin && !authToken;

                return (
                  <button
                    key={app.id}
                    onClick={() => onNavigate(app.id)}
                    className="group relative flex flex-col items-start p-4 bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 rounded-2xl text-left transition-all duration-200"
                  >
                    {/* Top Row: Icon + Badge / Lock */}
                    <div className="flex items-center justify-between w-full mb-3">
                      <div className={`p-2.5 rounded-xl border ${app.colorBg} ${app.colorText} ${app.colorBorder} transition group-hover:scale-105`}>
                        <Icon className="w-5 h-5" />
                      </div>

                      {requiresAuth ? (
                        <span
                          className="p-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold flex items-center gap-1"
                          title="Requires owner login"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 opacity-60 group-hover:text-blue-600 group-hover:opacity-100 transition">
                          Launch
                        </span>
                      )}
                    </div>

                    {/* Middle: Title */}
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition mb-1 truncate w-full">
                      {app.displayLabel}
                    </h3>

                    {/* Bottom: Description */}
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {app.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
