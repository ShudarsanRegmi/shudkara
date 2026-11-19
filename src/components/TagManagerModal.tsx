import React, { useState } from 'react';
import { Tag, Plus, Search, Edit2, Trash2, X, Check, BookOpen, AlertCircle } from 'lucide-react';

export interface TimelineTag {
  name: string;
  description: string;
  color?: string;
  postCount?: number;
  updatedAt?: string | Date;
}

export interface TagManagerModalProps {
  isOpen?: boolean;
  onClose: () => void;
  tagPool: TimelineTag[];
  onRefresh?: () => Promise<void>;
  onRefreshTags?: () => Promise<void>;
  onSelectTagForFilter?: (tagName: string) => void;
  authToken?: string | null;
}

export const TagManagerModal: React.FC<TagManagerModalProps> = ({
  isOpen = true,
  onClose,
  tagPool,
  onRefresh,
  onRefreshTags,
  onSelectTagForFilter,
  authToken
}) => {
  if (isOpen === false) return null;

  const handleRefresh = onRefresh || onRefreshTags || (async () => {});
  const [search, setSearch] = useState('');
  const [editingTagName, setEditingTagName] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');

  // Create new tag form states
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (authToken) headers['X-Session-Token'] = authToken;
    return headers;
  };

  const filteredTags = tagPool.filter(t => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  });

  const handleStartEdit = (t: TimelineTag) => {
    setEditingTagName(t.name);
    setEditDescription(t.description || '');
    setEditColor(t.color || '#3b82f6');
  };

  const handleSaveEdit = async (name: string) => {
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/timeline/tags', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name,
          description: editDescription.trim(),
          color: editColor
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update tag');
      }
      setEditingTagName(null);
      await handleRefresh();
      setStatusMsg({ type: 'success', text: `Tag #${name} updated.` });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error updating tag' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTag = async (name: string) => {
    if (!window.confirm(`Are you sure you want to remove #${name} from the tag pool?`)) return;
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/timeline/tags/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete tag');
      }
      await handleRefresh();
      setStatusMsg({ type: 'success', text: `Tag #${name} removed from pool.` });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error deleting tag' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmitting(true);
    setStatusMsg(null);

    const cleanName = newName.trim().toLowerCase().replace(/^#/, '');

    try {
      const res = await fetch('/api/timeline/tags', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: cleanName,
          description: newDescription.trim(),
          color: newColor
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create tag');
      }
      setNewName('');
      setNewDescription('');
      setIsCreating(false);
      await handleRefresh();
      setStatusMsg({ type: 'success', text: `Tag #${cleanName} created!` });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error creating tag' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1', '#14b8a6', '#64748b'];

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
    >
      <div 
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                Timeline Tag Pool & Knowledge Base
              </h3>
              <p className="text-[11px] text-slate-500">
                Browse tags, see usage counts, define keywords and descriptions so you never forget
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCreating && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Tag</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMsg && (
          <div className={`px-5 py-2 text-xs font-bold flex items-center gap-1.5 ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-b border-emerald-100' : 'bg-red-50 text-red-700 border-b border-red-100'
          }`}>
            {statusMsg.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Create Tag Form Drawer */}
        {isCreating && (
          <form onSubmit={handleCreateNewTag} className="p-4 bg-blue-50/60 border-b border-blue-100 space-y-3 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-600" /> Create New Tag Definition
              </span>
              <button 
                type="button" 
                onClick={() => setIsCreating(false)} 
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tag Keyword</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-slate-400 font-bold text-xs">#</span>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. mindfulness"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Meaning / What it's for</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="e.g. Meditation sessions, quiet thinking, breathwork and clarity"
                  className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500">Color:</span>
                {presetColors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-4 h-4 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-blue-500 ring-offset-1' : 'opacity-80 hover:opacity-100'}`}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !newName.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Save Tag
              </button>
            </div>
          </form>
        )}

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-100 bg-white">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by tag keyword or description words..."
              className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition"
            />
            {search && (
              <button 
                type="button" 
                onClick={() => setSearch('')}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tag List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredTags.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-1.5">
              <BookOpen className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">No matching tags found</p>
              <p className="text-[11px] text-slate-400">Click "+ New Tag" above to create and define your first tag.</p>
            </div>
          ) : (
            filteredTags.map((t) => {
              const isEditing = editingTagName === t.name;

              if (isEditing) {
                return (
                  <div key={t.name} className="p-3 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-blue-900 font-mono">
                        #{t.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(t.name)}
                          disabled={isSubmitting}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTagName(null)}
                          className="px-2 py-1 text-slate-500 hover:bg-slate-200 rounded-lg text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Description / Keywords</label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        placeholder="Explain what this tag covers..."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium"
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={t.name}
                  className="p-3 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition flex items-start justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectTagForFilter) {
                            onSelectTagForFilter(t.name);
                            onClose();
                          }
                        }}
                        className="text-xs font-extrabold text-blue-700 hover:underline font-mono bg-blue-100/70 hover:bg-blue-100 px-2 py-0.5 rounded-lg transition"
                        title="Click to filter timeline moments by this tag"
                      >
                        #{t.name}
                      </button>

                      {/* Post Count Pill */}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-mono">
                        {(t.postCount || 0)} {t.postCount === 1 ? 'post' : 'posts'}
                      </span>
                    </div>

                    {t.description ? (
                      <p className="text-xs text-slate-600 font-normal leading-relaxed">
                        {t.description}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        No description added yet. Click edit to explain what this tag is for.
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(t)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                      title="Edit tag description"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTag(t.name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Delete from tag pool"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>{tagPool.length} tags in pool</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
