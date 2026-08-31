import React, { useState, useRef, useEffect } from 'react';
import { Check, X, Plus, Trash2, ChevronDown, ChevronUp, Keyboard } from 'lucide-react';

interface KeyValProps {
  authToken?: string | null;
}

type Status = 'idle' | 'loading' | 'copied' | 'not_found' | 'error';

export const KeyVal: React.FC<KeyValProps> = ({ authToken }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);

  // Admin panel state
  const [adminKeys, setAdminKeys] = useState<{ key: string; updatedAt: string }[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [adminMsg, setAdminMsg] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the run box
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset status after 2.5s
  useEffect(() => {
    if (status === 'copied' || status === 'not_found' || status === 'error') {
      const t = setTimeout(() => {
        setStatus('idle');
        setQuery('');
        setErrorMsg('');
        inputRef.current?.focus();
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [status]);

  const handleRun = async () => {
    const key = query.trim();
    if (!key) return;

    setStatus('loading');
    try {
      const res = await fetch(`/api/keyval/${encodeURIComponent(key)}`);
      if (res.status === 404) {
        setStatus('not_found');
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || 'Error fetching key.');
        setStatus('error');
        return;
      }
      const data = await res.json();
      // Copy to clipboard — never displayed in DOM
      await navigator.clipboard.writeText(data.value);
      setStatus('copied');
    } catch {
      setErrorMsg('Clipboard access failed or network error.');
      setStatus('error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRun();
    if (e.key === 'Escape') {
      setQuery('');
      setStatus('idle');
    }
  };

  // ── Admin: load key names (no values) ────────────────────────────────────
  const loadAdminKeys = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/keyval/__list__', {
        headers: { 'X-Session-Token': authToken }
      });
      if (res.ok) setAdminKeys(await res.json());
    } catch {}
  };

  const toggleAdmin = () => {
    if (!showAdmin && authToken) loadAdminKeys();
    setShowAdmin(v => !v);
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim() || !authToken) return;
    setAdminMsg('');
    try {
      const res = await fetch('/api/keyval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': authToken },
        body: JSON.stringify({ key: newKey.trim(), value: newValue.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setNewKey(''); setNewValue('');
        setAdminMsg(`Saved "${data.key}"`);
        await loadAdminKeys();
      } else {
        setAdminMsg(data.error || 'Failed to save key.');
      }
    } catch { setAdminMsg('Network error.'); }
  };

  const handleDeleteKey = async (key: string) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/keyval/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { 'X-Session-Token': authToken }
      });
      if (res.ok) await loadAdminKeys();
    } catch {}
  };

  // ── Status color and icon ─────────────────────────────────────────────────
  const statusRing: Record<Status, string> = {
    idle:      'ring-slate-200 focus-within:ring-blue-400',
    loading:   'ring-blue-400',
    copied:    'ring-emerald-400',
    not_found: 'ring-red-300',
    error:     'ring-red-400',
  };

  const statusIndicator = () => {
    if (status === 'copied')    return <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><Check className="w-3.5 h-3.5" />Copied to clipboard</span>;
    if (status === 'not_found') return <span className="flex items-center gap-1 text-xs font-semibold text-red-500"><X className="w-3.5 h-3.5" />Key not found</span>;
    if (status === 'error')     return <span className="flex items-center gap-1 text-xs font-semibold text-red-500"><X className="w-3.5 h-3.5" />{errorMsg}</span>;
    if (status === 'loading')   return <span className="text-xs text-slate-400">Looking up…</span>;
    return null;
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 select-none">

      {/* ── Run Box ── */}
      <div className="w-full max-w-lg space-y-3">

        {/* Label */}
        <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">
          <Keyboard className="w-3.5 h-3.5" />
          KeyVal
        </div>

        {/* Input */}
        <div className={`flex items-center bg-white border-2 rounded-2xl shadow-lg ring-2 transition-all duration-150 ${statusRing[status]}`}>
          <input
            ref={inputRef}
            type="text"
            value={status === 'idle' || status === 'loading' ? query : ''}
            onChange={e => { setQuery(e.target.value); setStatus('idle'); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a key and press Enter…"
            className="flex-1 bg-transparent px-5 py-4 text-lg font-mono font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            disabled={status === 'loading'}
          />
          {query && status === 'idle' && (
            <button
              onClick={handleRun}
              className="mr-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
            >
              ↵
            </button>
          )}
        </div>

        {/* Status */}
        <div className="h-5 flex items-center pl-1">
          {statusIndicator()}
          {status === 'idle' && !query && (
            <span className="text-[11px] text-slate-300">Esc to clear · Enter to copy</span>
          )}
        </div>
      </div>

      {/* ── Admin Panel (logged-in only) ── */}
      {authToken && (
        <div className="w-full max-w-lg mt-12">
          <button
            onClick={toggleAdmin}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 font-semibold uppercase tracking-widest transition"
          >
            {showAdmin ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Manage Keys
          </button>

          {showAdmin && (
            <div className="mt-4 bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-5">

              {/* Add new key */}
              <form onSubmit={handleAddKey} className="space-y-2">
                <p className="text-[11px] uppercase font-bold text-slate-400 tracking-widest">Add / Update</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="key"
                    className="w-1/3 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <input
                    type="text"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="value"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={!newKey.trim() || !newValue.trim()}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {adminMsg && (
                  <p className="text-xs font-medium text-slate-500 pl-1">{adminMsg}</p>
                )}
              </form>

              {/* Key list (names only, no values) */}
              {adminKeys.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase font-bold text-slate-400 tracking-widest">Stored Keys</p>
                  {adminKeys.map(({ key }) => (
                    <div key={key} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl">
                      <span className="font-mono text-sm text-slate-700">{key}</span>
                      <button
                        onClick={() => handleDeleteKey(key)}
                        className="text-slate-300 hover:text-red-500 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {adminKeys.length === 0 && (
                <p className="text-xs text-slate-300 text-center py-2">No keys stored yet.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
