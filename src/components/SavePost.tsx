import React, { useState, useEffect } from 'react';
import { 
  Bookmark, Plus, Search, Lock, Unlock, Copy, Trash2, Edit3, X, Check,
  Sparkles, ExternalLink, Globe, Tag, Clipboard, Pin,
  MessageSquare, BookOpen, Code, Video, Terminal, RefreshCw
} from 'lucide-react';

export interface SavedPostItem {
  id: string;
  url: string;
  title: string;
  description?: string;
  collection: string;
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

interface SavePostProps {
  authToken?: string | null;
  initialPostId?: string | null;
}

const DEFAULT_COLLECTIONS = [
  'All',
  'Inbox',
  'Tech & Dev',
  'Design & UI',
  'AI & Prompts',
  'Read Later',
  'Career & Business'
];

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

const PLATFORM_ICONS: Record<string, any> = {
  twitter: TwitterIcon,
  reddit: MessageSquare,
  youtube: YoutubeIcon,
  github: GithubIcon,
  linkedin: LinkedinIcon,
  instagram: InstagramIcon,
  medium: BookOpen,
  devto: Code,
  tiktok: Video,
  hackernews: Terminal,
  web: Globe
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-sky-500/10 text-sky-600 border-sky-200',
  reddit: 'bg-orange-500/10 text-orange-600 border-orange-200',
  youtube: 'bg-rose-500/10 text-rose-600 border-rose-200',
  github: 'bg-slate-900/10 text-slate-800 border-slate-300',
  linkedin: 'bg-blue-600/10 text-blue-700 border-blue-200',
  instagram: 'bg-pink-500/10 text-pink-600 border-pink-200',
  medium: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  devto: 'bg-purple-500/10 text-purple-700 border-purple-200',
  tiktok: 'bg-slate-800/10 text-slate-900 border-slate-300',
  hackernews: 'bg-amber-500/10 text-amber-700 border-amber-200',
  web: 'bg-indigo-500/10 text-indigo-700 border-indigo-200'
};

export const SavePost: React.FC<SavePostProps> = ({ authToken }) => {
  const [posts, setPosts] = useState<SavedPostItem[]>([]);
  const [isBoardPrivate, setIsBoardPrivate] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [activeCollection, setActiveCollection] = useState<string>('All');
  const [activePlatform, setActivePlatform] = useState<string>('All');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // UI Drawer & Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SavedPostItem | null>(null);
  const [showTagCheatsheet, setShowTagCheatsheet] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [fetchingMeta, setFetchingMeta] = useState(false);

  // Form States
  const [formUrl, setFormUrl] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCollection, setFormCollection] = useState('Inbox');
  const [formTagsInput, setFormTagsInput] = useState('');
  const [formThumbnail, setFormThumbnail] = useState('');
  const [formIsPrivate, setFormIsPrivate] = useState(false);
  const [formIsPinned, setFormIsPinned] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    fetchPosts();
  }, [authToken]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch('/api/savepost', { headers });
      if (res.ok) {
        const data = await res.json();
        setPosts(Array.isArray(data.posts) ? data.posts : []);
        setIsBoardPrivate(!!data.isBoardPrivate);
      }
    } catch (err) {
      console.error('Failed to load saved posts:', err);
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
      await fetch('/api/savepost/privacy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken
        },
        body: JSON.stringify({ isBoardPrivate: nextState })
      });
      triggerToast(nextState ? 'SavePost Vault set to Private' : 'SavePost Vault set to Public');
    } catch {
      triggerToast('Failed to update privacy setting', 'error');
    }
  };

  // Auto-fetch link metadata when URL is entered or pasted
  const handleFetchMetadata = async (urlToFetch: string) => {
    if (!urlToFetch || !urlToFetch.trim()) return;
    setFetchingMeta(true);
    try {
      const res = await fetch('/api/savepost/fetch-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToFetch.trim() })
      });
      if (res.ok) {
        const meta = await res.json();
        if (meta.title && !formTitle) setFormTitle(meta.title);
        if (meta.description && !formDescription) setFormDescription(meta.description);
        if (meta.thumbnail && !formThumbnail) setFormThumbnail(meta.thumbnail);
        triggerToast('Link preview metadata fetched!');
      }
    } catch (err) {
      console.warn('Failed to fetch metadata:', err);
    } finally {
      setFetchingMeta(false);
    }
  };

  // Instant Quick Save from Clipboard
  const handleInstantSaveFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        setFormUrl(text.trim());
        setFormTitle('');
        setFormDescription('');
        setFormCollection('Inbox');
        setFormTagsInput('');
        setFormThumbnail('');
        setFormIsPrivate(false);
        setFormIsPinned(false);
        setEditingPost(null);
        setIsModalOpen(true);
        handleFetchMetadata(text.trim());
      } else {
        triggerToast('Clipboard does not contain a valid web URL', 'error');
      }
    } catch {
      triggerToast('Unable to access clipboard. Please paste URL manually.', 'error');
    }
  };

  // Open modal for Create
  const handleOpenCreate = (defaultCollection = 'Inbox') => {
    setEditingPost(null);
    setFormUrl('');
    setFormTitle('');
    setFormDescription('');
    setFormCollection(defaultCollection === 'All' ? 'Inbox' : defaultCollection);
    setFormTagsInput('');
    setFormThumbnail('');
    setFormIsPrivate(false);
    setFormIsPinned(false);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (post: SavedPostItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPost(post);
    setFormUrl(post.url);
    setFormTitle(post.title);
    setFormDescription(post.description || '');
    setFormCollection(post.collection || 'Inbox');
    setFormTagsInput((post.tags || []).map(t => `#${t}`).join(' '));
    setFormThumbnail(post.thumbnail || '');
    setFormIsPrivate(!!post.isPrivate);
    setFormIsPinned(!!post.isPinned);
    setIsModalOpen(true);
  };

  // Submit Save / Update
  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl.trim()) return;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    const tagsArray = formTagsInput
      .split(/[\s,]+/)
      .map(t => t.replace(/^#/, '').trim())
      .filter(Boolean);

    const payload = {
      url: formUrl.trim(),
      title: formTitle.trim(),
      description: formDescription.trim(),
      collection: formCollection.trim() || 'Inbox',
      tags: tagsArray,
      thumbnail: formThumbnail.trim() || undefined,
      isPrivate: formIsPrivate,
      isPinned: formIsPinned
    };

    try {
      if (editingPost) {
        const res = await fetch(`/api/savepost/${editingPost.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const updated = await res.json();
          setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
          triggerToast('Saved post updated successfully');
        }
      } else {
        const res = await fetch('/api/savepost', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          setPosts(prev => [created, ...prev]);
          triggerToast('Link saved to ' + created.collection);
        }
      }
      setIsModalOpen(false);
    } catch {
      triggerToast('Failed to save link', 'error');
    }
  };

  // Delete Post
  const handleDeletePost = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this saved link?')) return;

    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch(`/api/savepost/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== id));
        triggerToast('Link deleted');
      }
    } catch {
      triggerToast('Failed to delete item', 'error');
    }
  };

  // Toggle Pin
  const handleTogglePin = async (post: SavedPostItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !post.isPinned;
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, isPinned: nextState } : p));

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      await fetch(`/api/savepost/${post.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isPinned: nextState })
      });
      triggerToast(nextState ? 'Post pinned to top' : 'Post unpinned');
    } catch {
      triggerToast('Failed to update pin state', 'error');
    }
  };

  // Extract all dynamic tags and counts across posts
  const allTagsWithCount = React.useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(p => {
      (p.tags || []).forEach(t => {
        const clean = t.toLowerCase();
        counts[clean] = (counts[clean] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  // Dynamic Collections list
  const existingCollections = React.useMemo(() => {
    const setColls = new Set(DEFAULT_COLLECTIONS);
    posts.forEach(p => {
      if (p.collection) setColls.add(p.collection);
    });
    return Array.from(setColls);
  }, [posts]);

  // Extract all platforms present
  const availablePlatforms = React.useMemo(() => {
    const setPlats = new Set<string>();
    posts.forEach(p => {
      if (p.platform?.key) setPlats.add(p.platform.key);
    });
    return Array.from(setPlats);
  }, [posts]);

  // Filtered posts list
  const filteredPosts = posts.filter(p => {
    const matchesColl = activeCollection === 'All' || p.collection === activeCollection;
    const matchesPlat = activePlatform === 'All' || p.platform?.key === activePlatform;
    const matchesTag = !selectedTag || (p.tags || []).some(t => t.toLowerCase() === selectedTag.toLowerCase());
    const matchesSearch = !searchQuery.trim() || 
      (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.url || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesColl && matchesPlat && matchesTag && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 text-slate-800">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium flex items-center gap-2.5 transition-all duration-300 ${
          toastMsg.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-900 border-slate-800 text-white'
        }`}>
          <Sparkles className="w-4 h-4 text-amber-400" />
          {toastMsg.text}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Top Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-tr from-sky-500 to-indigo-600 text-white rounded-2xl shadow-lg shadow-sky-500/20">
                <Bookmark className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                  SavePost Vault
                  {isBoardPrivate && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-full">
                      <Lock className="w-3 h-3" /> Private Board
                    </span>
                  )}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Organize saved posts across Twitter, Reddit, YouTube, GitHub, & Web with auto metadata extraction.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            {authToken && (
              <button
                onClick={handleToggleBoardPrivacy}
                className={`px-4 py-2.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 transition-all shadow-sm ${
                  isBoardPrivate
                    ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="Toggle Vault Privacy"
              >
                {isBoardPrivate ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4 text-emerald-600" />}
                <span>{isBoardPrivate ? 'Private Board' : 'Public Board'}</span>
              </button>
            )}

            <button
              onClick={handleInstantSaveFromClipboard}
              className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-sm"
              title="Paste link from clipboard & auto-fetch metadata"
            >
              <Clipboard className="w-4 h-4 text-amber-400" />
              <span>Paste Clipboard URL</span>
            </button>

            <button
              onClick={() => handleOpenCreate(activeCollection)}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Save New Link</span>
            </button>
          </div>
        </div>

        {/* Dynamic Tag Cheatsheet Bar */}
        {allTagsWithCount.length > 0 && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Tag className="w-4 h-4 text-indigo-600" />
                <span>Tag Cheatsheet ({allTagsWithCount.length} Tags)</span>
                {selectedTag && (
                  <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    Active Filter: #{selectedTag}
                    <button onClick={() => setSelectedTag(null)} className="hover:text-rose-600"><X className="w-3 h-3" /></button>
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowTagCheatsheet(prev => !prev)}
                className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
              >
                {showTagCheatsheet ? 'Collapse Tags' : 'View All Tags'}
              </button>
            </div>

            <div className={`flex flex-wrap gap-2 transition-all ${showTagCheatsheet ? 'max-h-96' : 'max-h-12 overflow-hidden'}`}>
              {allTagsWithCount.map(([tag, count]) => {
                const isSelected = selectedTag?.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(isSelected ? null : tag)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>#{tag}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-indigo-800 text-indigo-200' : 'bg-slate-200 text-slate-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Collections & Platform Filter Toolbar */}
        <div className="space-y-4">
          {/* Top Row: Collections (Single Level) */}
          <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2 scrollbar-none">
            <div className="flex items-center gap-2">
              {existingCollections.map(coll => {
                const isActive = activeCollection === coll;
                const count = coll === 'All' ? posts.length : posts.filter(p => p.collection === coll).length;
                return (
                  <button
                    key={coll}
                    onClick={() => setActiveCollection(coll)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{coll === 'Inbox' ? '📥 Inbox' : coll}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isActive ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-xl text-xs font-bold border transition ${viewMode === 'grid' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400'}`}
                title="Grid View"
              >
                ▦
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-xl text-xs font-bold border transition ${viewMode === 'list' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400'}`}
                title="List View"
              >
                ≡
              </button>
            </div>
          </div>

          {/* Bottom Row: Platforms & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs">
            {/* Auto Platform Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">Platform:</span>
              <button
                onClick={() => setActivePlatform('All')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  activePlatform === 'All' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              {availablePlatforms.map(platKey => {
                const IconComp = PLATFORM_ICONS[platKey] || Globe;
                const isActive = activePlatform === platKey;
                return (
                  <button
                    key={platKey}
                    onClick={() => setActivePlatform(platKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                      isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span className="capitalize">{platKey}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search saved posts, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* POSTS GRID / LIST DISPLAY */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-white border border-slate-200 rounded-3xl p-6" />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-500">
              <Bookmark className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">No Saved Posts Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery || selectedTag || activePlatform !== 'All' 
                  ? 'No posts match your selected filters.'
                  : 'Save links from Twitter, Reddit, YouTube, or any site to organize them here.'}
              </p>
            </div>
            <button
              onClick={() => handleOpenCreate(activeCollection)}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-md transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Save First Link
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredPosts.map(post => {
              const IconComponent = PLATFORM_ICONS[post.platform?.key] || Globe;
              const platColorClass = PLATFORM_COLORS[post.platform?.key] || 'bg-slate-100 text-slate-700 border-slate-200';

              return (
                <div
                  key={post.id}
                  className={`group bg-white border border-slate-200/80 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                    post.isPinned ? 'ring-2 ring-indigo-500/40 bg-gradient-to-b from-indigo-50/20 to-white' : ''
                  }`}
                >
                  {/* Pinned Accent Ribbon */}
                  {post.isPinned && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-sm z-10">
                      <Pin className="w-3 h-3 fill-current" /> Pinned
                    </div>
                  )}

                  <div className="p-6 space-y-4">
                    {/* Header Row: Platform Badge + Domain + Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${platColorClass}`}>
                          <IconComponent className="w-3.5 h-3.5" />
                          <span>{post.platform?.name || post.domain}</span>
                        </span>

                        <span className="text-xs font-bold text-slate-500 truncate flex items-center gap-1">
                          {post.favicon && <img src={post.favicon} alt="" className="w-3.5 h-3.5 rounded-xs inline-block" />}
                          {post.domain}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleTogglePin(post, e)}
                          className={`p-1.5 rounded-lg transition ${post.isPinned ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600'}`}
                          title={post.isPinned ? 'Unpin' : 'Pin to Top'}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(post.url);
                            triggerToast('URL copied to clipboard!');
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition"
                          title="Copy Link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {authToken && (
                          <button
                            onClick={(e) => handleOpenEdit(post, e)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition"
                            title="Edit Link"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {authToken && (
                          <button
                            onClick={(e) => handleDeletePost(post.id, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Thumbnail Preview if available */}
                    {post.thumbnail && (
                      <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-slate-900 border border-slate-100">
                        <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    )}

                    {/* Title */}
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/link block text-base font-bold text-slate-900 tracking-tight group-hover/link:text-indigo-600 transition-colors line-clamp-2"
                    >
                      {post.title}
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover/link:text-indigo-600 inline-block ml-1.5" />
                    </a>

                    {/* Short Description */}
                    {post.description && (
                      <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                        {post.description}
                      </p>
                    )}
                  </div>

                  {/* Footer Meta & Tags */}
                  <div className="p-6 pt-0 space-y-3">
                    {/* Tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {post.tags.map(t => (
                          <button
                            key={t}
                            onClick={() => setSelectedTag(t)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200/60 transition"
                          >
                            #{t}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-400 font-semibold">
                      <span className="bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-600 font-extrabold">
                        📁 {post.collection || 'Inbox'}
                      </span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-indigo-600" />
                {editingPost ? 'Edit Saved Post' : 'Save New Post / Link'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePost} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Web URL *
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://x.com/username/status/..."
                    value={formUrl}
                    onChange={(e) => {
                      setFormUrl(e.target.value);
                      if (e.target.value.startsWith('http')) handleFetchMetadata(e.target.value);
                    }}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleFetchMetadata(formUrl)}
                    disabled={fetchingMeta || !formUrl}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition shrink-0 flex items-center gap-1.5"
                    title="Auto-fetch title & preview"
                  >
                    <RefreshCw className={`w-4 h-4 ${fetchingMeta ? 'animate-spin text-indigo-600' : ''}`} />
                    <span>Fetch Meta</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Title (Optional - Auto fetched if empty)
                </label>
                <input
                  type="text"
                  placeholder="Title of post or article"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Collection (Flat Bucket)
                </label>
                <select
                  value={formCollection}
                  onChange={(e) => setFormCollection(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {existingCollections.map(c => (
                    <option key={c} value={c}>{c === 'Inbox' ? '📥 Inbox (Default Quick Save)' : c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Tags (Separated by space or comma)
                </label>
                <input
                  type="text"
                  placeholder="#react #ai #ui #twitter"
                  value={formTagsInput}
                  onChange={(e) => setFormTagsInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Description / Personal Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Key takeaways or summary..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formIsPrivate}
                    onChange={(e) => setFormIsPrivate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Private Link (Requires Login to view)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold shadow-md transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Save Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
