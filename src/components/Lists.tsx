import React, { useState } from 'react';
import { 
  ListOrdered, Trash2, Lock, Unlock, 
  FolderPlus, ChevronRight, X 
} from 'lucide-react';

export interface ListItem {
  id: string;
  text: string;
  note?: string;
  isPrivate?: boolean;
  createdAt: string;
}

export interface ListCategory {
  id: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  items: ListItem[];
}

interface ListsProps {
  authToken?: string | null;
  lists: ListCategory[];
  onListsChange: (updated: ListCategory[]) => void;
}

export const Lists: React.FC<ListsProps> = ({ authToken, lists, onListsChange }) => {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(lists[0]?.id || null);
  
  // Category creation modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catIsPrivate, setCatIsPrivate] = useState(false);

  // Item creation state
  const [itemText, setItemText] = useState('');
  const [itemNote, setItemNote] = useState('');
  const [itemIsPrivate, setItemIsPrivate] = useState(false);

  const isLoggedIn = !!authToken;

  // Filter categories for non-logged-in visitors (hide private categories)
  const visibleCategories = lists.filter(cat => {
    if (!isLoggedIn && cat.isPrivate) return false;
    return true;
  });

  const activeCategory = visibleCategories.find(c => c.id === selectedCatId) || visibleCategories[0];

  // Create category
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    const newCat: ListCategory = {
      id: Date.now().toString(),
      name: catName.trim(),
      description: catDesc.trim(),
      isPrivate: catIsPrivate,
      items: []
    };

    const updated = [newCat, ...lists];
    onListsChange(updated);
    setSelectedCatId(newCat.id);
    setCatName('');
    setCatDesc('');
    setCatIsPrivate(false);
    setIsCatModalOpen(false);
  };

  // Toggle Category Privacy (Lockpad)
  const handleToggleCatPrivacy = (catId: string) => {
    if (!isLoggedIn) return;
    const updated = lists.map(c => c.id === catId ? { ...c, isPrivate: !c.isPrivate } : c);
    onListsChange(updated);
  };

  // Delete Category
  const handleDeleteCategory = (catId: string, name: string) => {
    if (window.confirm(`Delete entire list "${name}"?`)) {
      const updated = lists.filter(c => c.id !== catId);
      onListsChange(updated);
      if (selectedCatId === catId) {
        setSelectedCatId(updated[0]?.id || null);
      }
    }
  };

  // Add Item to active category
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCategory || !itemText.trim()) return;

    const newItem: ListItem = {
      id: Date.now().toString(),
      text: itemText.trim(),
      note: itemNote.trim(),
      isPrivate: itemIsPrivate,
      createdAt: new Date().toLocaleDateString()
    };

    const updated = lists.map(c => {
      if (c.id === activeCategory.id) {
        return { ...c, items: [newItem, ...c.items] };
      }
      return c;
    });

    onListsChange(updated);
    setItemText('');
    setItemNote('');
    setItemIsPrivate(false);
  };

  // Toggle Item Privacy
  const handleToggleItemPrivacy = (itemId: string) => {
    if (!isLoggedIn || !activeCategory) return;
    const updated = lists.map(c => {
      if (c.id === activeCategory.id) {
        return {
          ...c,
          items: c.items.map(it => it.id === itemId ? { ...it, isPrivate: !it.isPrivate } : it)
        };
      }
      return c;
    });
    onListsChange(updated);
  };

  // Delete Item
  const handleDeleteItem = (itemId: string) => {
    if (!activeCategory) return;
    const updated = lists.map(c => {
      if (c.id === activeCategory.id) {
        return { ...c, items: c.items.filter(it => it.id !== itemId) };
      }
      return c;
    });
    onListsChange(updated);
  };

  return (
    <div className="space-y-6 select-none animate-fade-in">
      
      {/* Header Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-extrabold uppercase tracking-wider">
            <ListOrdered className="w-4 h-4" />
            Static Reference Vault
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Curated Lists
          </h1>
          <p className="text-xs text-slate-500">Long-term static reference notes, principles, and curated collections.</p>
        </div>

        {isLoggedIn && (
          <button
            onClick={() => setIsCatModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md shrink-0"
          >
            <FolderPlus className="w-4 h-4" />
            Create New List Category
          </button>
        )}
      </div>

      {/* Main Grid: Categories Sidebar + Active List Items */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Categories Sidebar */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-2 h-fit">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-2 py-1">
            Lists Categories ({visibleCategories.length})
          </p>

          {visibleCategories.length > 0 ? (
            visibleCategories.map((cat) => {
              const isSelected = activeCategory?.id === cat.id;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition ${
                    isSelected 
                      ? 'bg-blue-50 border border-blue-200 text-blue-700 font-bold shadow-sm' 
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight className={`w-4 h-4 shrink-0 transition ${isSelected ? 'text-blue-600 rotate-90' : 'text-slate-400'}`} />
                    <span className="text-xs truncate">{cat.name}</span>
                    {cat.isPrivate && (
                      <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                    )}
                  </div>

                  {isLoggedIn && isSelected && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleCatPrivacy(cat.id); }}
                        className="p-1 hover:bg-blue-100 rounded text-slate-500"
                        title={cat.isPrivate ? 'Private (Click to make Public)' : 'Public'}
                      >
                        {cat.isPrivate ? <Lock className="w-3 h-3 text-amber-600" /> : <Unlock className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id, cat.name); }}
                        className="p-1 hover:bg-rose-100 rounded text-rose-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-400 p-2 text-center">No categories created yet.</p>
          )}
        </div>

        {/* Active List Items View */}
        <div className="md:col-span-2 space-y-4">
          {activeCategory ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              
              {/* Category Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{activeCategory.name}</h2>
                  {activeCategory.description && (
                    <p className="text-xs text-slate-500 mt-1">{activeCategory.description}</p>
                  )}
                </div>
                {activeCategory.isPrivate && (
                  <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold rounded-lg flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Private List
                  </span>
                )}
              </div>

              {/* Add Item Form (Logged-in only) */}
              {isLoggedIn && (
                <form onSubmit={handleAddItem} className="space-y-3 bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
                  <input
                    type="text"
                    placeholder="Item title or static entry..."
                    value={itemText}
                    onChange={e => setItemText(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Optional notes or details..."
                      value={itemNote}
                      onChange={e => setItemNote(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setItemIsPrivate(!itemIsPrivate)}
                      className={`p-2 rounded-xl border transition ${
                        itemIsPrivate ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-400'
                      }`}
                      title={itemIsPrivate ? 'Private Item' : 'Public Item'}
                    >
                      {itemIsPrivate ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4" />}
                    </button>
                    <button
                      type="submit"
                      disabled={!itemText.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition shadow-sm"
                    >
                      Add Item
                    </button>
                  </div>
                </form>
              )}

              {/* Items List */}
              <div className="space-y-3">
                {activeCategory.items
                  .filter(it => isLoggedIn || !it.isPrivate)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-4 bg-slate-50 hover:bg-slate-100/60 border border-slate-200/80 rounded-2xl transition group"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                          <p className="text-xs font-bold text-slate-800 break-words">{item.text}</p>
                          {item.isPrivate && (
                            <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                          )}
                        </div>
                        {item.note && (
                          <p className="text-[11px] text-slate-500 pl-4 leading-relaxed font-sans">{item.note}</p>
                        )}
                      </div>

                      {isLoggedIn && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => handleToggleItemPrivacy(item.id)}
                            className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-white"
                          >
                            {item.isPrivate ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-white"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                ))}

                {activeCategory.items.filter(it => isLoggedIn || !it.isPrivate).length === 0 && (
                  <p className="text-center py-10 text-xs text-slate-400 font-medium">This list is empty.</p>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs font-semibold">
              Select or create a list category to view items.
            </div>
          )}
        </div>

      </div>

      {/* Create Category Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 relative animate-fade-in">
            <button
              onClick={() => setIsCatModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-slate-900">Create List Category</h3>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">List Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Favorite Software, Core Principles"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Short summary of this list..."
                  value={catDesc}
                  onChange={e => setCatDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="catIsPrivate"
                  checked={catIsPrivate}
                  onChange={e => setCatIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="catIsPrivate" className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  Make Category Private (Owner Only)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
