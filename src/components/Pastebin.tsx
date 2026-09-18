import React, { useState, useEffect } from 'react';
import { 
  FileCode, Plus, Search, Lock, Unlock, Share2, Copy, Trash2, Edit3, X, Check,
  Clock, Flame, HardDrive, Sparkles, Maximize2, Zap, Clipboard
} from 'lucide-react';

export interface PasteItem {
  id: string;
  title: string;
  content: string;
  language: string;
  category?: string;
  type: 'ephemeral' | 'persistent';
  expiryOption?: string; // '10m', '1h', '24h', '7d', 'burn'
  expiresAt?: string | null;
  isBurnAfterReading?: boolean;
  isPrivate?: boolean;
  isPinned?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface PastebinProps {
  authToken?: string | null;
  initialPasteId?: string | null;
}

const LANGUAGES = [
  { id: 'plaintext', name: 'Plain Text' },
  { id: 'javascript', name: 'JavaScript / Node' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'python', name: 'Python' },
  { id: 'html', name: 'HTML / XML' },
  { id: 'css', name: 'CSS / Tailwind' },
  { id: 'json', name: 'JSON' },
  { id: 'sql', name: 'SQL' },
  { id: 'bash', name: 'Shell / Bash' }
];

const EXPIRY_OPTIONS = [
  { id: '10m', label: '10 Minutes' },
  { id: '1h', label: '1 Hour' },
  { id: '24h', label: '24 Hours' },
  { id: '7d', label: '7 Days' },
  { id: 'burn', label: '🔥 Burn After Reading' }
];

export const Pastebin: React.FC<PastebinProps> = ({ authToken, initialPasteId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'ephemeral' | 'persistent'>('ephemeral');
  const [pastes, setPastes] = useState<PasteItem[]>([]);
  const [isBoardPrivate, setIsBoardPrivate] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

  // UI Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState('All');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPaste, setEditingPaste] = useState<PasteItem | null>(null);
  const [viewingPaste, setViewingPaste] = useState<PasteItem | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formLanguage, setFormLanguage] = useState('plaintext');
  const [formCategory, setFormCategory] = useState('General');
  const [formType, setFormType] = useState<'ephemeral' | 'persistent'>('ephemeral');
  const [formExpiryOption, setFormExpiryOption] = useState('24h');
  const [formIsPrivate, setFormIsPrivate] = useState(false);
  const [formIsPinned, setFormIsPinned] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Live timer interval (ticks every 5s to update expiry badges)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch pastes
  useEffect(() => {
    fetchPastes();
  }, [authToken]);

  // Handle initial pasteId from URL
  useEffect(() => {
    if (initialPasteId && pastes.length > 0) {
      const found = pastes.find(p => p.id === initialPasteId);
      if (found) {
        setViewingPaste(found);
      }
    }
  }, [initialPasteId, pastes]);

  // Instant Clipboard Paste Handler (Ctrl + V)
  const handleInstantPaste = async (text: string) => {
    if (!text || !text.trim()) return;

    const trimmed = text.trim();
    const isImageData = trimmed.startsWith('data:image/');
    const firstLine = trimmed.split('\n')[0].replace(/[\r\n]/g, '').trim();
    const title = isImageData ? 'Pasted Image' : (firstLine.length > 40 ? `${firstLine.substring(0, 40)}...` : (firstLine || 'Instant Paste'));

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    const payload = {
      title,
      content: trimmed,
      language: isImageData ? 'image' : 'plaintext',
      category: isImageData ? 'Images' : 'General',
      type: 'ephemeral',
      expiryOption: '24h',
      isPrivate: false,
      isPinned: false
    };

    try {
      const res = await fetch('/api/pastebin', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const created = await res.json();
        setPastes(prev => [created, ...prev]);
        setActiveSubTab('ephemeral');
        triggerToast(isImageData ? 'Image pasted instantly!' : 'Clipboard content pasted instantly!', 'success');
      }
    } catch (err) {
      triggerToast('Failed to save instant paste', 'error');
    }
  };

  const handleInstantImagePaste = async (dataUrl: string, name = 'Pasted Image') => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    const payload = {
      title: name,
      content: dataUrl,
      language: 'image',
      category: 'Images',
      type: 'ephemeral',
      expiryOption: '24h',
      isPrivate: false,
      isPinned: false
    };

    try {
      const res = await fetch('/api/pastebin', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const created = await res.json();
        setPastes(prev => [created, ...prev]);
        setActiveSubTab('ephemeral');
        triggerToast('Image pasted instantly! Expiration: 24 Hours', 'success');
      }
    } catch {
      triggerToast('Failed to save pasted image', 'error');
    }
  };

  // Listen for global Ctrl + V paste events anywhere on page (Text & Images)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target && 
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      // Check for Image item in clipboard
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            e.preventDefault();
            const blob = items[i].getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                if (dataUrl) {
                  handleInstantImagePaste(dataUrl, blob.name || 'Pasted Image');
                }
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
        }
      }

      const pastedText = e.clipboardData?.getData('text');
      if (pastedText && pastedText.trim()) {
        e.preventDefault();
        handleInstantPaste(pastedText);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [authToken]);

  const fetchPastes = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch('/api/pastebin', { headers });
      if (res.ok) {
        const data = await res.json();
        setPastes(Array.isArray(data.pastes) ? data.pastes : []);
        setIsBoardPrivate(!!data.isBoardPrivate);
      }
    } catch (err) {
      console.error('Failed to load pastes:', err);
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
      await fetch('/api/pastebin/privacy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken
        },
        body: JSON.stringify({ isBoardPrivate: nextState })
      });
      triggerToast(nextState ? 'Pastebin section set to Private' : 'Pastebin section set to Public');
    } catch (err) {
      triggerToast('Failed to update privacy setting', 'error');
    }
  };

  // Open modal for Create
  const handleOpenCreate = (defaultType: 'ephemeral' | 'persistent' = activeSubTab) => {
    setEditingPaste(null);
    setFormTitle('');
    setFormContent('');
    setFormLanguage('plaintext');
    setFormCategory('General');
    setFormType(defaultType);
    setFormExpiryOption('24h');
    setFormIsPrivate(false);
    setFormIsPinned(false);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (p: PasteItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPaste(p);
    setFormTitle(p.title);
    setFormContent(p.content);
    setFormLanguage(p.language || 'plaintext');
    setFormCategory(p.category || 'General');
    setFormType(p.type);
    setFormExpiryOption(p.expiryOption || '24h');
    setFormIsPrivate(!!p.isPrivate);
    setFormIsPinned(!!p.isPinned);
    setIsModalOpen(true);
  };

  // Save Paste Submit
  const handleSavePaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    const payload = {
      title: formTitle.trim() || 'Untitled Paste',
      content: formContent,
      language: formLanguage,
      category: formCategory,
      type: formType,
      expiryOption: formExpiryOption,
      isPrivate: formIsPrivate,
      isPinned: formIsPinned
    };

    try {
      if (editingPaste) {
        const res = await fetch(`/api/pastebin/${editingPaste.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const updated = await res.json();
          setPastes(prev => prev.map(item => item.id === updated.id ? updated : item));
          if (viewingPaste?.id === updated.id) setViewingPaste(updated);
          triggerToast('Paste updated successfully');
        }
      } else {
        const res = await fetch('/api/pastebin', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          setPastes(prev => [created, ...prev]);
          triggerToast(formType === 'ephemeral' ? 'Ephemeral paste created' : 'Persistent paste saved');
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      triggerToast('Failed to save paste', 'error');
    }
  };

  // Delete Paste
  const handleDeletePaste = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this paste?')) return;

    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch(`/api/pastebin/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setPastes(prev => prev.filter(p => p.id !== id));
        if (viewingPaste?.id === id) setViewingPaste(null);
        triggerToast('Paste deleted');
      }
    } catch (err) {
      triggerToast('Failed to delete paste', 'error');
    }
  };

  // Copy Paste Content
  const handleCopyContent = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    triggerToast('Paste content copied to clipboard!');
  };

  // Share Paste Link
  const handleShareLink = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = `${window.location.origin}/?pasteId=${id}`;
    navigator.clipboard.writeText(shareUrl);
    triggerToast('Paste share link copied to clipboard!');
  };

  // Format Expiry Time Label
  const getExpiryBadge = (p: PasteItem) => {
    if (p.type !== 'ephemeral') return null;
    if (p.isBurnAfterReading) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-full animate-pulse">
          <Flame className="w-3 h-3 text-rose-500" /> Burn After Reading
        </span>
      );
    }
    if (!p.expiresAt) return null;

    const diffMs = new Date(p.expiresAt).getTime() - now;
    if (diffMs <= 0) {
      return <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Expired</span>;
    }

    const minsLeft = Math.floor(diffMs / 60000);
    const hrsLeft = Math.floor(minsLeft / 60);

    const timeLabel = hrsLeft > 24 
      ? `${Math.floor(hrsLeft / 24)}d left`
      : hrsLeft > 0 
        ? `${hrsLeft}h left` 
        : `${minsLeft}m left`;

    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
        <Clock className="w-3 h-3 text-amber-600" /> Expires in {timeLabel}
      </span>
    );
  };

  // Filtered lists for SubTabs
  const filteredPastes = pastes.filter(p => {
    const matchesTab = p.type === activeSubTab;
    const matchesSearch = (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.content || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLang = selectedLang === 'All' || p.language === selectedLang;
    return matchesTab && matchesSearch && matchesLang;
  });

  const ephemeralCount = pastes.filter(p => p.type === 'ephemeral').length;
  const persistentCount = pastes.filter(p => p.type === 'persistent').length;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 text-slate-800">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium flex items-center gap-2.5 transition-all duration-300 animate-slide-up ${
          toastMsg.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-700' 
            : 'bg-slate-900 border-slate-800 text-white'
        }`}>
          {toastMsg.type === 'error' ? <AlertCircleIcon className="w-4 h-4 text-rose-500" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
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
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                  Pastebin Vault
                  {isBoardPrivate && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-full">
                      <Lock className="w-3 h-3" /> Private Board
                    </span>
                  )}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Share temporary code snippets or store persistent scripts with encryption & custom retention.
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

            <button
              onClick={() => handleOpenCreate(activeSubTab)}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Paste</span>
            </button>
          </div>
        </div>

        {/* Instant Paste Pro-Tip Banner */}
        <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-200/80 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-700 rounded-2xl shrink-0">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Instant Clipboard Paste (<kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-xs font-mono shadow-xs">Ctrl</kbd> + <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-xs font-mono shadow-xs">V</kbd>)
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Press <span className="font-semibold text-slate-800">Ctrl + V</span> anywhere on this page to save instantly. Default retention: <span className="font-semibold text-amber-700">24 Hours</span> (no form required).
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) {
                  handleInstantPaste(text);
                } else {
                  triggerToast('Clipboard is empty', 'error');
                }
              } catch {
                triggerToast('Please press Ctrl + V on your keyboard', 'error');
              }
            }}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-2xl shadow-xs flex items-center gap-2 shrink-0 transition-all active:scale-95"
          >
            <Clipboard className="w-4 h-4 text-indigo-600" /> Paste From Clipboard
          </button>
        </div>

        {/* SUBTABS: EPHEMERAL vs PERSISTENT */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2 bg-slate-200/60 p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveSubTab('ephemeral')}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeSubTab === 'ephemeral'
                  ? 'bg-white text-amber-700 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Ephemeral Pastes</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-extrabold">
                {ephemeralCount}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('persistent')}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeSubTab === 'persistent'
                  ? 'bg-white text-indigo-700 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HardDrive className="w-4 h-4 text-indigo-600" />
              <span>Persistent Vault</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-extrabold">
                {persistentCount}
              </span>
            </button>
          </div>

          {/* Search & Language Filters */}
          <div className="flex items-center gap-3">
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
            >
              <option value="All">All Languages</option>
              {LANGUAGES.map(lang => (
                <option key={lang.id} value={lang.id}>{lang.name}</option>
              ))}
            </select>

            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search pastes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PASTES GRID LIST */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-white border border-slate-200 rounded-3xl p-6" />
            ))}
          </div>
        ) : filteredPastes.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              {activeSubTab === 'ephemeral' ? <Clock className="w-7 h-7 text-amber-500" /> : <HardDrive className="w-7 h-7 text-indigo-500" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                No {activeSubTab === 'ephemeral' ? 'Ephemeral' : 'Persistent'} Pastes Found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery || selectedLang !== 'All' 
                  ? 'No pastes match your search filters.' 
                  : activeSubTab === 'ephemeral'
                    ? 'Ephemeral pastes expire automatically after set retention time or after single view.'
                    : 'Store permanent code snippets, configs, or notes securely in your persistent vault.'}
              </p>
            </div>
            <button
              onClick={() => handleOpenCreate(activeSubTab)}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-md transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create {activeSubTab === 'ephemeral' ? 'Ephemeral' : 'Persistent'} Paste
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPastes.map(p => {
              const langObj = LANGUAGES.find(l => l.id === p.language) || { name: p.language || 'Plain Text' };
              const lineCount = (p.content || '').split('\n').length;

              return (
                <div
                  key={p.id}
                  onClick={() => setViewingPaste(p)}
                  className="group bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden hover:-translate-y-1 space-y-4"
                >
                  {/* Top Accent line */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                    p.type === 'ephemeral' ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  }`} />

                  {/* Top Info & Badges */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                          {langObj.name}
                        </span>
                        {getExpiryBadge(p)}
                        {p.isPrivate && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Private
                          </span>
                        )}
                      </div>

                      {/* Action Menu */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleCopyContent(p.content, e)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          title="Copy Content"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(e) => handleShareLink(p.id, e)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          title="Copy Share Link"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        {authToken && (
                          <button
                            onClick={(e) => handleOpenEdit(p, e)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Edit Paste"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {authToken && (
                          <button
                            onClick={(e) => handleDeletePaste(p.id, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Delete Paste"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {p.title}
                    </h3>
                  </div>

                  {/* Snippet Preview Box */}
                  <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 font-mono text-xs overflow-hidden relative max-h-36 border border-slate-800">
                    {(p.language === 'image' || p.content.startsWith('data:image/')) ? (
                      <img src={p.content} alt={p.title} className="max-h-28 w-full object-contain rounded-lg mx-auto" />
                    ) : (
                      <pre className="line-clamp-4 leading-relaxed whitespace-pre-wrap break-all text-slate-100">
                        {p.content}
                      </pre>
                    )}
                  </div>

                  {/* Footer Meta info */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100">
                    <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
                    <span className="text-indigo-600 group-hover:underline flex items-center gap-1 font-semibold">
                      View Snippet <Maximize2 className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* VIEW PASTE MODAL */}
      {viewingPaste && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-6 my-auto overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold uppercase tracking-wider">
                  {viewingPaste.language}
                </span>
                {getExpiryBadge(viewingPaste)}
                {viewingPaste.isPrivate && (
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Private
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyContent(viewingPaste.content)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
                >
                  <Copy className="w-4 h-4" /> Copy Raw
                </button>

                <button
                  onClick={() => handleShareLink(viewingPaste.id)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <Share2 className="w-4 h-4 text-indigo-400" /> Share
                </button>

                <button
                  onClick={() => setViewingPaste(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-2xl font-bold text-white">{viewingPaste.title}</h2>
              <p className="text-xs text-slate-400 mt-1">
                Created on {new Date(viewingPaste.createdAt).toLocaleString()} • {viewingPaste.type === 'ephemeral' ? 'Ephemeral Paste' : 'Persistent Vault Paste'}
              </p>
            </div>

            {/* Code / Image View Area */}
            <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 font-mono text-xs sm:text-sm text-slate-100 overflow-x-auto max-h-[60vh] leading-relaxed relative">
              {(viewingPaste.language === 'image' || viewingPaste.content.startsWith('data:image/')) ? (
                <img src={viewingPaste.content} alt={viewingPaste.title} className="max-h-[50vh] w-full object-contain rounded-xl mx-auto" />
              ) : (
                <pre className="whitespace-pre-wrap break-all text-slate-100 font-mono">
                  {viewingPaste.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PASTE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-600" />
                {editingPaste ? 'Edit Paste' : 'Create New Paste'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePaste} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFormType('ephemeral')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    formType === 'ephemeral' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  <Clock className="w-4 h-4 text-amber-600" /> Ephemeral (Temporary)
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('persistent')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    formType === 'persistent' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  <HardDrive className="w-4 h-4 text-indigo-600" /> Persistent (Vault)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Paste Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Auth helper middleware, API response dump"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Syntax / Language
                  </label>
                  <select
                    value={formLanguage}
                    onChange={(e) => setFormLanguage(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang.id} value={lang.id}>{lang.name}</option>
                    ))}
                  </select>
                </div>

                {formType === 'ephemeral' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Retention Expiration
                    </label>
                    <select
                      value={formExpiryOption}
                      onChange={(e) => setFormExpiryOption(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      {EXPIRY_OPTIONS.map(exp => (
                        <option key={exp.id} value={exp.id}>{exp.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Content / Snippet *
                </label>
                <textarea
                  rows={8}
                  required
                  placeholder="Paste your code or text content here..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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
                  <span>Private Paste (Requires Login to view)</span>
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
                  <Check className="w-4 h-4" /> Save Paste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper alert icon component fallback
const AlertCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
    <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
  </svg>
);
