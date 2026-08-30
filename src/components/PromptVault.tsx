import React, { useState } from 'react';
import { Bookmark, Copy, Check, Plus, Trash2, Edit2, Search, X, FolderOpen } from 'lucide-react';

interface AIPrompt {
  id: string;
  title: string;
  prompt: string;
  description: string;
  tags: string[];
  createdAt: string;
}

interface PromptVaultProps {
  prompts: AIPrompt[];
  onPromptsChange: (updated: AIPrompt[]) => void;
}

export const PromptVault: React.FC<PromptVaultProps> = ({ prompts, onPromptsChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  
  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTags, setFormTags] = useState('');

  // Save prompts helper
  const savePrompts = (updated: AIPrompt[]) => {
    onPromptsChange(updated);
  };

  // Handle Copy to Clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingPrompt(null);
    setFormTitle('');
    setFormPrompt('');
    setFormDesc('');
    setFormTags('');
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (prompt: AIPrompt) => {
    setEditingPrompt(prompt);
    setFormTitle(prompt.title);
    setFormPrompt(prompt.prompt);
    setFormDesc(prompt.description);
    setFormTags(prompt.tags.join(', '));
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
            tags: processedTags
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
        createdAt: new Date().toLocaleDateString()
      };
      savePrompts([newPrompt, ...prompts]);
    }

    setIsModalOpen(false);
  };

  // Extract all unique tags
  const allTags = Array.from(
    new Set(prompts.flatMap(p => p.tags))
  ).sort();

  // Filter prompts
  const filteredPrompts = prompts.filter(p => {
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
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            <span>AI Utility Deck</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
            PromptVault
          </h1>
          <p className="text-sm md:text-base text-slate-600 max-w-xl leading-relaxed">
            Store, curate, and search your personal library of optimized AI instructions. Copy prompts with a single click.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="self-start md:self-center flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-md shadow-blue-500/10 hover:shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          Add Prompt
        </button>
      </div>

      {/* Control bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search prompts by title, content, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50"
          />
        </div>
        {/* Quick Tag Filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-semibold text-slate-400 mr-1">Filter:</span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                selectedTag === null
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-650'
              }`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  selectedTag === tag
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-650'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Prompts Display */}
      {filteredPrompts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPrompts.map((p) => (
            <div 
              key={p.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-bold text-slate-900 leading-tight">
                    {p.title}
                  </h3>
                  <div className="flex items-center gap-1">
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
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {p.description}
                  </p>
                )}

                {/* The prompt block */}
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
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl p-8 space-y-4">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-700">No prompts found</h3>
          <p className="text-sm text-slate-550 max-w-sm mx-auto">
            {searchQuery || selectedTag 
              ? 'Try modifying your search query or tag filters.'
              : 'Add your first prompt using the button above to start building your library.'}
          </p>
        </div>
      )}

      {/* Create / Edit Dialog Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 relative animate-fade-in">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-2xl font-bold text-slate-900 pr-8">
              {editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Code Reviewer"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Analyzes code structure and readability"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Prompt Content *
                </label>
                <textarea
                  placeholder="Act as a..."
                  rows={6}
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="Coding, Writing, Marketing"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50"
                />
              </div>

              <div className="flex gap-3 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10"
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
