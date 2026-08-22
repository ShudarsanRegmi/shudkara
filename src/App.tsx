import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, BookOpen, Share2, FileText, Moon, Sun, Terminal 
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { LeetCodeTracker } from './components/LeetCodeTracker';
import { Airdrop } from './components/Airdrop';
import { TextRoom } from './components/TextRoom';

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [urlRoomId, setUrlRoomId] = useState<string | null>(null);
  
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Check local storage or system preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shudkara_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return systemPrefersDark ? 'dark' : 'light';
    }
    return 'light';
  });

  // Check URL query parameters for ?room=room-id
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setUrlRoomId(room);
      setActiveTab('textroom');
    }
  }, []);

  // Sync theme to document element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('shudkara_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
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
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-150">
      
      {/* Navbar Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo brand */}
          <div 
            onClick={() => setActiveTab('dashboard')} 
            className="flex items-center gap-2 cursor-pointer select-none group"
          >
            <span className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
              <Terminal className="w-5 h-5" />
            </span>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              shudkara
            </span>
          </div>

          {/* Navigation links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-slate-100 dark:bg-slate-800 text-indigo-650 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-250'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            
            <button
              onClick={() => setActiveTab('leetcode')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'leetcode'
                  ? 'bg-slate-100 dark:bg-slate-800 text-indigo-650 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-250'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              LeetCode 75
            </button>
            
            <button
              onClick={() => setActiveTab('airdrop')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'airdrop'
                  ? 'bg-slate-100 dark:bg-slate-800 text-indigo-650 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-250'
              }`}
            >
              <Share2 className="w-4 h-4" />
              P2P Airdrop
            </button>

            <button
              onClick={() => setActiveTab('textroom')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'textroom'
                  ? 'bg-slate-100 dark:bg-slate-800 text-indigo-650 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-250'
              }`}
            >
              <FileText className="w-4 h-4" />
              Text Rooms
            </button>
          </nav>

          {/* Theme switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/80 transition-all"
              title={theme === 'dark' ? 'Activate Light Mode' : 'Activate Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </header>

      {/* Main body viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
        {activeTab === 'leetcode' && <LeetCodeTracker />}
        {activeTab === 'airdrop' && <Airdrop />}
        {activeTab === 'textroom' && (
          <TextRoom 
            initialRoomId={urlRoomId || undefined} 
            onRoomChange={handleRoomChange} 
          />
        )}
      </main>

      {/* Mobile Sticky Tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-2 px-1 backdrop-blur-md shadow-2xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1.5 py-1 text-center shrink-0 w-1/4 ${
            activeTab === 'dashboard' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-450'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Dash</span>
        </button>

        <button
          onClick={() => setActiveTab('leetcode')}
          className={`flex flex-col items-center gap-1.5 py-1 text-center shrink-0 w-1/4 ${
            activeTab === 'leetcode' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-450'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] font-semibold">LeetCode</span>
        </button>

        <button
          onClick={() => setActiveTab('airdrop')}
          className={`flex flex-col items-center gap-1.5 py-1 text-center shrink-0 w-1/4 ${
            activeTab === 'airdrop' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-450'
          }`}
        >
          <Share2 className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Airdrop</span>
        </button>

        <button
          onClick={() => setActiveTab('textroom')}
          className={`flex flex-col items-center gap-1.5 py-1 text-center shrink-0 w-1/4 ${
            activeTab === 'textroom' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-450'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Rooms</span>
        </button>
      </nav>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-center py-6 text-xs text-slate-400 dark:text-slate-500 pb-20 md:pb-6">
        <div className="max-w-6xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Shudkara Hub. Serverless Web App designed for Azure SWA.</p>
          <p className="mt-1 font-medium text-slate-350 dark:text-slate-650">
            Powered by PeerJS WebRTC (Airdrop) & Azure Functions (Text Rooms).
          </p>
        </div>
      </footer>

    </div>
  );
}

export default App;
