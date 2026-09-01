import React, { useState } from 'react';
import { Bookmark, Copy, Check, Plus, Trash2, Edit2, Search, X, FolderOpen, Lock, Unlock, Link2 } from 'lucide-react';

export interface AIPrompt {
  id: string;
  title: string;
  prompt: string;
  description: string;
  tags: string[];
  createdAt: string;
  isPrivate?: boolean;
}

interface PromptVaultProps {
  prompts: AIPrompt[];
  onPromptsChange: (updated: AIPrompt[]) => void;
  authToken?: string | null;
}

export const PromptVault: React.FC<PromptVaultProps> = ({ prompts, onPromptsChange, authToken }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  
  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formIsPrivate, setFormIsPrivate] = useState(false);

  // Save prompts helper
  const savePrompts = (updated: AIPrompt[]) => {
    onPromptsChange(updated);
  };

  // Handle Copy Prompt Content
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle Share Prompt Direct Link
  const handleShareLink = (id: string) => {
    const shareUrl = `${window.location.origin}/?promptId=${id}`;
    navigator.clipboard.writeText(shareUrl);
    setSharedId(id);
    setTimeout(() => setSharedId(null), 2500);
  };

  // Toggle Public / Private (Lockpad)
  const handleTogglePrivate = (id: string) => {
    if (!authToken) return;
    const updated = prompts.map(p => {
      if (p.id === id) {
        return { ...p, isPrivate: !p.isPrivate };
      }
      return p;
    });
    savePrompts(updated);
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingPrompt(null);
    setFormTitle('');
    setFormPrompt('');
    setFormDesc('');
    setFormTags('');
    setFormIsPrivate(false);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (prompt: AIPrompt) => {
    setEditingPrompt(prompt);
    setFormTitle(prompt.title);
    setFormPrompt(prompt.prompt);
    setFormDesc(prompt.description);
    setFormTags(prompt.tags.join(', '));
    setFormIsPrivate(!!prompt.isPrivate);
    setIsModalOpen(true);
  };

  // Delete Prompt
  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this prompt?')) {
      const updated = prompts.filter(p => p.id !== id);
      savePrompts(updated);
    }
  };

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formPrompt.trim()) {
      alert('Title and Prompt fields are required.');
      return;
    }

    const processedTags = formTags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    if (editingPrompt) {
      // Edit mode
      const updated = prompts.map(p => {
        if (p.id === editingPrompt.id) {
          return {
            ...p,
            title: formTitle.trim(),
            prompt: formPrompt.trim(),
            description: formDesc.trim(),
            tags: processedTags,
            isPrivate: formIsPrivate
          };
        }
        return p;
      });
      savePrompts(updated);
    } else {
      // Create mode
      const newPrompt: AIPrompt = {
        id: Date.now().toString(),
        title: formTitle.trim(),
        prompt: formPrompt.trim(),
        description: formDesc.trim(),
        tags: processedTags,
        createdAt: new Date().toLocaleDateString(),
        isPrivate: formIsPrivate
      };
      savePrompts([newPrompt, ...prompts]);
    }

    setIsModalOpen(false);
  };

  // Visible prompts filtering:
  // Non-logged-in users only see public prompts (!p.isPrivate). Logged-in owner sees all.
  const visiblePrompts = prompts.filter(p => {
    if (!authToken && p.isPrivate) return false;
    return true;
  });

  // Extract all unique tags from visible prompts
  const allTags = Array.from(
    new Set(visiblePrompts.flatMap(p => p.tags))
  ).sort();

  // Filter prompts by search and tag
  const filteredPrompts = visiblePrompts.filter(p => {
    const matchesSearch = 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.prompt.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesTag = selectedTag ? p.tags.includes(selectedTag) : true;
    
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header Block */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-750 text-xs font-semibold border border-blue-100">
            <Bookmark className="w-3.5 h-3.5" />
            AI Prompt Vault
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Prompt Repository
          </h1>
          <p className="text-slate-550 text-sm max-w-xl">
            Store, categorize, and quickly copy or share optimized prompts. Click the share icon to get a clean standalone link.
          </p>
        </div>

        {authToken && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-2xl text-sm transition shadow-md shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create New Prompt
          </button>
        )}
      </div>

      {/* Search & Tag Filter Bar */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search prompts by title, description, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Tags:</span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                selectedTag === null
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                  selectedTag === tag
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Prompts Grid */}
      {filteredPrompts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPrompts.map((p) => (
            <div 
              key={p.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between space-y-5 relative"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">
                      {p.title}
                    </h3>
                  </div>

                  {/* Top card actions */}
                  <div className="flex items-center gap-1">
                    {/* Share Link Button */}
                    <button
                      onClick={() => handleShareLink(p.id)}
                      className={`p-1.5 rounded-lg transition ${
                        sharedId === p.id 
                          ? 'bg-emerald-50 text-emerald-600 font-bold' 
                          : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                      title="Copy Shareable Link"
                    >
                      {sharedId === p.id ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                    </button>

                    {/* Lockpad toggle (Only logged-in owner can toggle) */}
                    {authToken && (
                      <button
                        onClick={() => handleTogglePrivate(p.id)}
                        className={`p-1.5 rounded-lg transition ${
                          p.isPrivate 
                            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                        title={p.isPrivate ? 'Private (Click to make Public)' : 'Public (Click to Lock)'}
                      >
                        {p.isPrivate ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* Edit / Delete (Owner only) */}
                    {authToken && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                          title="Edit Prompt"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-50"
                          title="Delete Prompt"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {p.description}
                  </p>
                )}

                {/* Privacy Badge if Private */}
                {authToken && p.isPrivate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold">
                    <Lock className="w-3 h-3" /> Private (Owner Only)
                  </span>
                )}

                {/* The prompt content block */}
                <div className="relative group bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-48 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-800 break-words whitespace-pre-wrap">
                  {p.prompt}
                </div>
              </div>

              {/* Card Footer tags and copy */}
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-4">
                <div className="flex flex-wrap gap-1">
                  {p.tags.map(tag => (
                    <span 
                      key={tag}
                      className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(p.id, p.prompt)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      copiedId === p.id 
                        ? 'bg-emerald-100 text-emerald-750' 
                        : 'bg-blue-600 text-white hover:bg-blue-750'
                    }`}
                  >
                    {copiedId === p.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Prompt
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl p-8 space-y-4">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-700">No prompts found</h3>
          <p className="text-sm text-slate-550 max-w-sm mx-auto">
            {searchQuery || selectedTag 
              ? 'Try modifying your search query or tag filters.'
              : 'No public prompts available right now.'}
          </p>
        </div>
      )}

      {/* Create / Edit Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 relative animate-fade-in">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-slate-900">
              {editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Code Refactoring Assistant"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Brief description of what this prompt achieves..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prompt Text *</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Act as a senior engineer..."
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="Coding, Refactor, Performance"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formIsPrivate"
                  checked={formIsPrivate}
                  onChange={(e) => setFormIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="formIsPrivate" className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  Make Private (Visible only to logged-in owner)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
                >
                  {editingPrompt ? 'Save Changes' : 'Create Prompt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
