import { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, BookOpen, Share2, FileText, Terminal, Bookmark,
  Cloud, CloudOff, RefreshCw, Copy, Check, Database, X
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { LeetCodeTracker } from './components/LeetCodeTracker';
import { Airdrop } from './components/Airdrop';
import { TextRoom } from './components/TextRoom';
import { PromptVault } from './components/PromptVault';

// Default Prompts (migrated to database sync)
const DEFAULT_PROMPTS = [
  {
    id: '1',
    title: 'Code Refactoring Assistant',
    prompt: 'Act as a senior software engineer. Review the following code for code smell, performance bottlenecks, and adherence to clean coding principles. Provide a refactored version along with a bulleted list of changes made:\n\n[INSERT CODE HERE]',
    description: 'Prompts the AI to act as a senior developer to refactor your code and explain optimizations.',
    tags: ['Coding', 'Refactor', 'Performance'],
    createdAt: new Date().toLocaleDateString()
  },
  {
    id: '2',
    title: 'Creative Writing Editor',
    prompt: 'You are an expert editorial critic. Analyze the text below for pacing, voice consistency, and descriptive depth. Suggest constructive revisions to make the scene more immersive and emotionally resonant:\n\n[INSERT TEXT HERE]',
    description: 'Helps improve creative prose, narrative voice, and descriptive writing quality.',
    tags: ['Writing', 'Creative', 'Editing'],
    createdAt: new Date().toLocaleDateString()
  }
];

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [urlRoomId, setUrlRoomId] = useState<string | null>(null);

  // Database Sync States
  const [syncKey, setSyncKey] = useState<string>('');
  const [leetcodeProgress, setLeetcodeProgress] = useState<Record<string, any>>({});
  const [prompts, setPrompts] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [tempSyncInput, setTempSyncInput] = useState('');
  const [copied, setCopied] = useState(false);

  const isInitializedRef = useRef(false);

  // Check URL query parameters for ?room=room-id
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setUrlRoomId(room);
      setActiveTab('textroom');
    }
  }, []);

  // Ensure dark mode class is never present on document element (for single theme toast)
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
  }, []);

  // Load cloud data on mount
  useEffect(() => {
    let key = localStorage.getItem('shudkara_sync_key');
    if (!key) {
      // Generate a brand new user sync key
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      key = `shud-${result}`;
      localStorage.setItem('shudkara_sync_key', key);
    }
    setSyncKey(key);
    loadCloudData(key);
  }, []);

  // Debounced cloud save trigger
  useEffect(() => {
    if (!syncKey || !isInitializedRef.current) return;

    const delayDebounce = setTimeout(() => {
      setSyncStatus('saving');
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncKey,
          leetcodeProgress,
          prompts
        })
      })
      .then(res => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then(() => {
        setSyncStatus('saved');
      })
      .catch(err => {
        console.error('Auto-save failed:', err);
        setSyncStatus('error');
      });
    }, 1200); // 1.2s debounce is perfect for notes typing

    return () => clearTimeout(delayDebounce);
  }, [leetcodeProgress, prompts, syncKey]);

  // Load database data helper
  const loadCloudData = async (key: string) => {
    setSyncStatus('loading');
    isInitializedRef.current = false;
    try {
      const response = await fetch(`/api/sync?key=${encodeURIComponent(key)}`);
      if (!response.ok) throw new Error('Fetch failed');
      const data = await response.json();
      
      if (data.exists) {
        setLeetcodeProgress(data.leetcodeProgress || {});
        setPrompts(data.prompts || []);
        setSyncStatus('saved');
        // Clear local storage legacy items
        localStorage.removeItem('shudkara_leetcode_progress');
        localStorage.removeItem('shudkara_prompt_vault');
      } else {
        // Fresh cloud sync key. Read legacy items from localstorage if migrating
        const legacyProgress = localStorage.getItem('shudkara_leetcode_progress');
        const legacyPrompts = localStorage.getItem('shudkara_prompt_vault');
        
        let initialProgress = {};
        if (legacyProgress) {
          try { initialProgress = JSON.parse(legacyProgress); } catch {}
        }
        
        let initialPrompts = DEFAULT_PROMPTS;
        if (legacyPrompts) {
          try { initialPrompts = JSON.parse(legacyPrompts); } catch {}
        }
        
        setLeetcodeProgress(initialProgress);
        setPrompts(initialPrompts);
        
        // Write the initial document to cloud database immediately to register the key
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            syncKey: key,
            leetcodeProgress: initialProgress,
            prompts: initialPrompts
          })
        });
        
        setSyncStatus('saved');
        
        // Clear legacy keys so we don't migrate again
        localStorage.removeItem('shudkara_leetcode_progress');
        localStorage.removeItem('shudkara_prompt_vault');
      }
      isInitializedRef.current = true;
    } catch (err) {
      console.error('Failed to load from sync service:', err);
      setSyncStatus('error');
    }
  };

  const handleSwitchKey = async (newKey: string) => {
    if (!newKey.trim()) return;
    const targetKey = newKey.trim();
    setSyncKey(targetKey);
    localStorage.setItem('shudkara_sync_key', targetKey);
    await loadCloudData(targetKey);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(syncKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRoomChange = (roomId: string | null) => {
    if (roomId) {
      // Set query param ?room=roomId
      const newUrl = `${window.location.pathname}?room=${roomId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    } else {
      // Clear query param
      window.history.pushState({ path: window.location.pathname }, '', window.location.pathname);
      setUrlRoomId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 transition-colors duration-150">
      
      {/* Navbar Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo brand */}
          <div 
            onClick={() => setActiveTab('dashboard')} 
            className="flex items-center gap-2 cursor-pointer select-none group"
          >
            <span className="p-2 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <Terminal className="w-5 h-5" />
            </span>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              shudkara
            </span>
          </div>

          {/* Navigation links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-slate-100 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            
            <button
              onClick={() => setActiveTab('leetcode')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'leetcode'
                  ? 'bg-slate-100 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              LeetCode 75
            </button>
            
            <button
              onClick={() => setActiveTab('airdrop')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'airdrop'
                  ? 'bg-slate-100 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Share2 className="w-4 h-4" />
              P2P Airdrop
            </button>

            <button
              onClick={() => setActiveTab('textroom')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'textroom'
                  ? 'bg-slate-100 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              Text Rooms
            </button>

            <button
              onClick={() => setActiveTab('prompts')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'prompts'
                  ? 'bg-slate-100 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              PromptVault
            </button>
          </nav>

          {/* Cloud Sync Status Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTempSyncInput(syncKey);
                setIsSyncModalOpen(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-650 text-xs font-semibold transition"
              title="Cloud sync settings"
            >
              {syncStatus === 'loading' && (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                  <span>Syncing...</span>
                </>
              )}
              {syncStatus === 'saving' && (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                  <span>Syncing...</span>
                </>
              )}
              {syncStatus === 'saved' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Cloud className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Synced</span>
                </>
              )}
              {syncStatus === 'error' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                  <CloudOff className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-red-650">Offline</span>
                </>
              )}
              {syncStatus === 'idle' && (
                <>
                  <Cloud className="w-3.5 h-3.5 text-slate-400" />
                  <span>Database Off</span>
                </>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* Main body viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} progress={leetcodeProgress} />}
        {activeTab === 'leetcode' && <LeetCodeTracker progress={leetcodeProgress} onProgressChange={setLeetcodeProgress} />}
        {activeTab === 'airdrop' && <Airdrop />}
        {activeTab === 'prompts' && <PromptVault prompts={prompts} onPromptsChange={setPrompts} />}
        {activeTab === 'textroom' && (
          <TextRoom 
            initialRoomId={urlRoomId || undefined} 
            onRoomChange={handleRoomChange} 
          />
        )}
      </main>

      {/* Mobile Sticky Tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 flex items-center justify-around py-2 px-1 backdrop-blur-md shadow-2xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1.5 py-1 text-center shrink-0 w-1/5 ${
            activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-450'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Dash</span>
        </button>

        <button
          onClick={() => setActiveTab('leetcode')}
          className={`flex flex-col items-center gap-1.5 py-1 text-center shrink-0 w-1/5 ${
            activeTab === 'leetcode' ? 'text-blue-600' : 'text-slate-450'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] font-semibold">LeetCode</span>
        </button>

        <button
          onClick={() => setActiveTab('airdrop')}
          className={`flex flex-col items-center gap-1.5 py-1 text-center shrink-0 w-1/5 ${
            activeTab === 'airdrop' ? 'text-blue-600' : 'text-slate-450'
          }`}
        >
          <Share2 className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Airdrop</span>
        </button>

        <button
          onClick={() => setActiveTab('prompts')}
          className={`flex flex-col items-center gap-1.5 py-1 text-center shrink-0 w-1/5 ${
            activeTab === 'prompts' ? 'text-blue-600' : 'text-slate-450'
          }`}
        >
          <Bookmark className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Vault</span>
        </button>

        <button
          onClick={() => setActiveTab('textroom')}
          className={`flex flex-col items-center gap-1.5 py-1 text-center shrink-0 w-1/5 ${
            activeTab === 'textroom' ? 'text-blue-600' : 'text-slate-450'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Rooms</span>
        </button>
      </nav>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 text-center py-6 text-xs text-slate-400 pb-20 md:pb-6">
        <div className="max-w-6xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Shudkara Hub. Serverless Web App designed for Azure SWA.</p>
          <p className="mt-1 font-medium text-slate-350">
            Powered by MongoDB Cloud Sync & Azure Functions.
          </p>
        </div>
      </footer>

      {/* Cloud Sync Database Settings Overlay Dialog */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 relative animate-fade-in text-slate-800">
            <button
              onClick={() => setIsSyncModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Cloud Database Sync
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Keep your LeetCode progress and PromptVault in sync across all your devices without a login.
              </p>
            </div>

            {/* Current Sync Key Display */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Your Sync Key
              </label>
              <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono shadow-sm">
                <span className="text-slate-800 select-all overflow-x-auto whitespace-nowrap scrollbar-thin mr-2">{syncKey}</span>
                <button
                  onClick={handleCopyKey}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg flex items-center justify-center shrink-0 transition"
                  title="Copy Sync Key"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                ⚠️ Anyone with this key can view and edit your data. Keep it private.
              </p>
            </div>

            {/* Switch / Load Key Form */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Load data from another device
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Sync Key (e.g., shud-5z2b4x9a)"
                  value={tempSyncInput}
                  onChange={(e) => setTempSyncInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50 font-mono"
                />
                <button
                  onClick={() => {
                    if (tempSyncInput.trim()) {
                      handleSwitchKey(tempSyncInput.trim());
                      setIsSyncModalOpen(false);
                    }
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 transition"
                >
                  Load
                </button>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 text-center leading-relaxed">
              Automatic background saving is active. Powered by MongoDB Atlas.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
