import React, { useState, useEffect } from 'react';
import { Key, Copy, Check, Plus, Trash2, Search, Lock, RefreshCw } from 'lucide-react';

interface KeyValPair {
  key: string;
  value: string;
  updatedAt: string;
}

interface KeyValProps {
  authToken: string | null;
}

export const KeyVal: React.FC<KeyValProps> = ({ authToken }) => {
  const [pairs, setPairs] = useState<KeyValPair[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form states (visible only if logged in)
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLoggedIn = !!authToken;

  const fetchPairs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/keyval');
      if (res.ok) {
        const data = await res.json();
        setPairs(data);
      }
    } catch (err) {
      console.error('Failed to load key-value pairs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPairs();
  }, []);

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) {
      setFormError('Both key and value fields are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const res = await fetch('/api/keyval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          key: newKey.trim(),
          value: newValue.trim()
        })
      });

      if (res.ok) {
        setNewKey('');
        setNewValue('');
        await fetchPairs();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Failed to save key-value.');
      }
    } catch (err) {
      setFormError('Network error saving key-value.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (key: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent trigger copy value when clicking delete
    if (!window.confirm(`Are you sure you want to delete the key "${key}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/keyval/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (res.ok) {
        await fetchPairs();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete key.');
      }
    } catch (err) {
      alert('Network error deleting key.');
    }
  };

  const filteredPairs = pairs.filter(p => 
    p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.value.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className="space-y-8 animate-fade-in text-slate-800">
      
      {/* Header Block */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-750 text-xs font-semibold border border-blue-100">
            <Key className="w-3.5 h-3.5 text-blue-600" />
            <span>Key Copy Deck</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
            KeyVal Store
          </h1>
          <p className="text-sm md:text-base text-slate-600 max-w-xl leading-relaxed">
            Click on any key-value card to copy its value immediately to your clipboard. Public search is active; writes require manager authentication.
          </p>
        </div>
      </div>

      {/* Grid: Editor Panel + List View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Editor panel (Only visible if logged in, or shows login prompt) */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Manage Key-Values
          </h2>
          
          {isLoggedIn ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. AZURE_API_ENDPOINT"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Value
                </label>
                <textarea
                  placeholder="Paste value here..."
                  rows={4}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-mono text-xs"
                  required
                />
              </div>

              {formError && (
                <p className="text-xs text-red-650 font-semibold">{formError}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-xs transition shadow-md shadow-blue-500/10"
              >
                {isSubmitting ? 'Saving...' : 'Add / Update Pair'}
              </button>
            </form>
          ) : (
            <div className="text-center py-6 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
              <Lock className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">Creation Locked</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                You can search and copy values freely, but creating or updating keys requires owner authentication.
              </p>
            </div>
          )}
        </div>

        {/* Display List panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search bar */}
          <div className="relative bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center">
            <Search className="w-4 h-4 text-slate-400 ml-2" />
            <input
              type="text"
              placeholder="Search keys or values..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-2 py-1.5 focus:outline-none text-sm"
            />
          </div>

          {/* List display */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
            {loading ? (
              <div className="text-center py-10">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                <span className="text-xs text-slate-500">Loading keys database...</span>
              </div>
            ) : filteredPairs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {filteredPairs.map((p) => {
                  const isCopied = copiedKey === p.key;
                  return (
                    <div
                      key={p.key}
                      onClick={() => handleCopy(p.key, p.value)}
                      className={`group border border-slate-200 rounded-2xl p-4 hover:border-blue-300 hover:shadow-sm bg-slate-50/30 hover:bg-white transition duration-150 cursor-pointer flex items-center justify-between gap-4`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <span className="font-mono text-xs font-extrabold text-slate-800 block truncate group-hover:text-blue-600 transition-colors">
                          {p.key}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 block truncate leading-relaxed">
                          {p.value}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        {isLoggedIn && (
                          <button
                            onClick={(e) => handleDelete(p.key, e)}
                            className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-slate-50 rounded-lg transition"
                            title="Delete pair"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded transition ${
                          isCopied 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-transparent'
                        }`}>
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              Copy
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 space-y-3">
                <Key className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-lg font-bold text-slate-700">No keys found</h3>
                <p className="text-xs text-slate-550 max-w-sm mx-auto leading-relaxed">
                  {searchQuery 
                    ? 'No matching keys or values found. Try typing another search query.'
                    : 'The database is currently empty.'}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
