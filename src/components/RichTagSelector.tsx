import React, { useState, useMemo } from 'react';
import { Tag, Plus, Search, X, Check, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import type { TimelineTag } from './TagManagerModal';

interface RichTagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  tagPool: TimelineTag[];
  onRefreshTags: () => Promise<void>;
  onOpenTagManager?: () => void;
  authToken?: string | null;
  className?: string;
}

export const RichTagSelector: React.FC<RichTagSelectorProps> = ({
  selectedTags,
  onChange,
  tagPool,
  onRefreshTags,
  onOpenTagManager,
  authToken,
  className = ''
}) => {
  const [search, setSearch] = useState('');
  const [isPoolExpanded, setIsPoolExpanded] = useState(false);
  const [showInlineCreate, setShowInlineCreate] = useState(false);

  // New tag inline state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  const cleanSelected = useMemo(() => {
    return Array.from(new Set(selectedTags.map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean)));
  }, [selectedTags]);

  const removeTag = (tagName: string) => {
    const updated = cleanSelected.filter(t => t !== tagName);
    onChange(updated);
  };

  const addTag = (tagName: string) => {
    const clean = tagName.trim().toLowerCase().replace(/^#/, '');
    if (!clean) return;
    if (!cleanSelected.includes(clean)) {
      onChange([...cleanSelected, clean]);
    }
  };

  const toggleTag = (tagName: string) => {
    const clean = tagName.trim().toLowerCase().replace(/^#/, '');
    if (cleanSelected.includes(clean)) {
      removeTag(clean);
    } else {
      addTag(clean);
    }
  };

  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tagPool;
    return tagPool.filter(t => 
      t.name.toLowerCase().includes(q) || 
      (t.description && t.description.toLowerCase().includes(q))
    );
  }, [tagPool, search]);

  const handleCreateOnTheFly = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim().toLowerCase().replace(/^#/, '');
    if (!clean) return;

    setIsSubmitting(true);
    setCreateError('');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch('/api/timeline/tags', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: clean,
          description: newDesc.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create tag');
      }

      await onRefreshTags();
      addTag(clean);
      setNewName('');
      setNewDesc('');
      setShowInlineCreate(false);
    } catch (err: any) {
      setCreateError(err.message || 'Error creating tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`space-y-2 select-none ${className}`}>
      
      {/* ── Top Bar: Title & Toggle Knowledge Pool ── */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-blue-600" />
          Tags & Knowledge Pool
        </label>
        
        <div className="flex items-center gap-1.5">
          {onOpenTagManager && (
            <button
              type="button"
              onClick={onOpenTagManager}
              className="text-[10px] font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded-md hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer"
              title="Open full-fledged Tag Manager"
            >
              <SlidersHorizontal className="w-3 h-3 text-slate-400" />
              <span>Manage Tags</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsPoolExpanded(prev => !prev)}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100/70 transition flex items-center gap-0.5 cursor-pointer"
          >
            <span>{isPoolExpanded ? 'Hide Tag Pool' : `Browse Pool (${tagPool.length})`}</span>
            {isPoolExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* ── Selected Tags Pills ── */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
        {cleanSelected.length === 0 ? (
          <span className="text-[11px] text-slate-400 italic">No tags selected yet. Browse below or type to search.</span>
        ) : (
          cleanSelected.map((tag) => {
            const meta = tagPool.find(p => p.name.toLowerCase() === tag.toLowerCase());
            return (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold font-mono shadow-2xs animate-in zoom-in-95"
              >
                <span>#{tag}</span>
                {meta && typeof meta.postCount === 'number' && (
                  <span className="text-[9px] px-1 py-0.2 bg-white/20 rounded font-sans text-blue-100">
                    {meta.postCount}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="p-0.5 hover:bg-blue-700 rounded text-blue-200 hover:text-white transition ml-0.5 cursor-pointer"
                  title={`Remove #${tag}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })
        )}
      </div>

      {/* ── Search & Quick Tag Pool ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                if (!isPoolExpanded) setIsPoolExpanded(true);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (search.trim()) {
                    addTag(search);
                    setSearch('');
                  }
                }
              }}
              placeholder="Search tag keywords or descriptions (Press Enter to add)..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none"
            />
            {search && (
              <button 
                type="button" 
                onClick={() => setSearch('')}
                className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowInlineCreate(prev => !prev)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-slate-200 cursor-pointer shrink-0"
            title="Create a new tag with description on the fly"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Tag</span>
          </button>
        </div>

        {/* ── Inline On-The-Fly Tag Creator ── */}
        {showInlineCreate && (
          <form onSubmit={handleCreateOnTheFly} className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 animate-in slide-in-from-top-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-blue-900 flex items-center gap-1">
                <Plus className="w-3 h-3 text-blue-600" /> Define New Tag On The Fly
              </span>
              <button
                type="button"
                onClick={() => setShowInlineCreate(false)}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-semibold"
              >
                Cancel
              </button>
            </div>

            {createError && (
              <p className="text-[10px] text-red-600 font-bold">{createError}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Tag name (e.g. coffee)"
                className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono"
              />
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Description: e.g. Espresso reviews, cafes..."
                className="sm:col-span-2 px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !newName.trim()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Save & Add Tag
              </button>
            </div>
          </form>
        )}

        {/* ── Browseable Tag Pool Cards / Chips ── */}
        {isPoolExpanded && (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl max-h-52 overflow-y-auto space-y-1.5 scrollbar-thin">
            {filteredPool.length === 0 ? (
              <div className="text-center py-4 text-slate-400">
                <p className="text-xs font-semibold">No tags matching "{search}"</p>
                <button
                  type="button"
                  onClick={() => {
                    setNewName(search);
                    setShowInlineCreate(true);
                  }}
                  className="mt-1 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  + Create "#{search}" with description
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {filteredPool.map((t) => {
                  const isSelected = cleanSelected.includes(t.name.toLowerCase());

                  return (
                    <div
                      key={t.name}
                      onClick={() => toggleTag(t.name)}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition flex items-start justify-between gap-2 ${
                        isSelected
                          ? 'bg-blue-100/80 border-blue-400 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold font-mono ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                            #{t.name}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
                            {t.postCount || 0} {t.postCount === 1 ? 'post' : 'posts'}
                          </span>
                        </div>
                        {t.description && (
                          <p className="text-[10px] text-slate-500 truncate mt-0.5 leading-tight">
                            {t.description}
                          </p>
                        )}
                      </div>

                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 border transition ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
