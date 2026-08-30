import { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, BookOpen, Share2, FileText, Terminal, Bookmark,
  Link as LinkIcon, Key as KeyIcon, Image as ImageIcon, LogIn, LogOut
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { LeetCodeTracker } from './components/LeetCodeTracker';
import { Airdrop } from './components/Airdrop';
import { TextRoom } from './components/TextRoom';
import { PromptVault } from './components/PromptVault';
import { LinkManager } from './components/LinkManager';
import { KeyVal } from './components/KeyVal';
import { ImgDrop } from './components/ImgDrop';
import { Login } from './components/Login';

const GLOBAL_SYNC_KEY = 'global_user';

// Tab Configuration & Permissions Control
const TAB_CONFIG: Record<string, { requiresLogin: boolean; label: string; icon: any }> = {
  dashboard: { requiresLogin: false, label: 'Dashboard', icon: LayoutDashboard },
  leetcode: { requiresLogin: true, label: 'LeetCode 75', icon: BookOpen },
  airdrop: { requiresLogin: false, label: 'Airdrop', icon: Share2 },
  textroom: { requiresLogin: false, label: 'Rooms', icon: FileText },
  prompts: { requiresLogin: true, label: 'PromptVault', icon: Bookmark },
  links: { requiresLogin: false, label: 'LinkManager', icon: LinkIcon },
  keyval: { requiresLogin: false, label: 'KeyVal', icon: KeyIcon },
  imgdrop: { requiresLogin: false, label: 'ImgDrop', icon: ImageIcon }
};

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [urlRoomId, setUrlRoomId] = useState<string | null>(null);

  // Authentication State
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Database Sync States (silent background sync)
  const [leetcodeProgress, setLeetcodeProgress] = useState<Record<string, any>>({});
  const [prompts, setPrompts] = useState<any[]>([]);
  const isInitializedRef = useRef(false);

  // Check URL query parameters for ?room=room-id or Firebase Auth link redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setUrlRoomId(room);
      setActiveTab('textroom');
    }

    // If redirected back from Firebase Email OTP link
    if (window.location.href.includes('apiKey=') && window.location.href.includes('oobCode=')) {
      setActiveTab('login');
    }
  }, []);

  // Ensure dark mode class is never present on document element (for single theme toast)
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
  }, []);

  // Load and verify local auth token on startup
  useEffect(() => {
    const token = localStorage.getItem('shudkara_auth_token');
    if (token) {
      fetch('/api/auth/check', {
        headers: { 'X-Session-Token': token }
      })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setAuthToken(token);
        } else {
          localStorage.removeItem('shudkara_auth_token');
          setAuthToken(null);
        }
      })
      .catch(() => {
        // Keep token on network glitch
        setAuthToken(token);
      });
    }
  }, []);

  // Load cloud data on mount
  useEffect(() => {
    loadCloudData();
  }, []);

  // Debounced cloud save trigger
  useEffect(() => {
    if (!isInitializedRef.current) return;

    const delayDebounce = setTimeout(() => {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncKey: GLOBAL_SYNC_KEY,
          leetcodeProgress,
          prompts
        })
      })
      .catch(err => {
        console.error('Auto-save failed:', err);
      });
    }, 1200);

    return () => clearTimeout(delayDebounce);
  }, [leetcodeProgress, prompts]);

  // Load database data helper
  const loadCloudData = async () => {
    isInitializedRef.current = false;
    try {
      const response = await fetch(`/api/sync?key=${encodeURIComponent(GLOBAL_SYNC_KEY)}`);
      if (!response.ok) throw new Error('Fetch failed');
      const data = await response.json();
      
      if (data.exists) {
        setLeetcodeProgress(data.leetcodeProgress || {});
        setPrompts(data.prompts || []);
      } else {
        // First-time seed
        const legacyProgress = localStorage.getItem('shudkara_leetcode_progress');
        const legacyPrompts = localStorage.getItem('shudkara_prompt_vault');
        
        let initialProgress = {};
        if (legacyProgress) {
          try { initialProgress = JSON.parse(legacyProgress); } catch {}
        }
        
        const initialPrompts = legacyPrompts ? JSON.parse(legacyPrompts) : [
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
        
        setLeetcodeProgress(initialProgress);
        setPrompts(initialPrompts);
        
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            syncKey: GLOBAL_SYNC_KEY,
            leetcodeProgress: initialProgress,
            prompts: initialPrompts
          })
        });

        localStorage.removeItem('shudkara_leetcode_progress');
        localStorage.removeItem('shudkara_prompt_vault');
      }
      isInitializedRef.current = true;
    } catch (err) {
      console.error('Failed to load from sync service:', err);
    }
  };

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem('shudkara_auth_token', token);
    setAuthToken(token);
    setActiveTab('dashboard'); // Redirect to dashboard
  };

  const handleLogout = async () => {
    if (authToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'X-Session-Token': authToken ?? '' }
        });
      } catch {}
    }
    localStorage.removeItem('shudkara_auth_token');
    setAuthToken(null);
    setActiveTab('dashboard');
  };

  const handleRoomChange = (roomId: string | null) => {
    if (roomId) {
      const newUrl = `${window.location.pathname}?room=${roomId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    } else {
      window.history.pushState({ path: window.location.pathname }, '', window.location.pathname);
      setUrlRoomId(null);
    }
  };

  // Determine current active component
  const renderTabContent = () => {
    const config = TAB_CONFIG[activeTab];
    if (config?.requiresLogin && !authToken) {
      return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    if (activeTab === 'login') {
      return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} progress={leetcodeProgress} authToken={authToken} />;
      case 'leetcode':
        return <LeetCodeTracker progress={leetcodeProgress} onProgressChange={setLeetcodeProgress} />;
      case 'airdrop':
        return <Airdrop />;
      case 'textroom':
        return (
          <TextRoom 
            initialRoomId={urlRoomId || undefined} 
            onRoomChange={handleRoomChange} 
          />
        );
      case 'prompts':
        return <PromptVault prompts={prompts} onPromptsChange={setPrompts} />;
      case 'links':
        return <LinkManager authToken={authToken} />;
      case 'keyval':
        return <KeyVal authToken={authToken} />;
      case 'imgdrop':
        return <ImgDrop />;
      default:
        return <Dashboard setActiveTab={setActiveTab} progress={leetcodeProgress} authToken={authToken} />;
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
          <nav className="hidden md:flex items-center gap-1">
            {Object.entries(TAB_CONFIG).map(([tabKey, config]) => {
              if (config.requiresLogin && !authToken) return null;
              
              const Icon = config.icon;
              return (
                <button
                  key={tabKey}
                  onClick={() => setActiveTab(tabKey)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === tabKey
                      ? 'bg-slate-100 text-blue-600'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </button>
              );
            })}
          </nav>

          {/* Authentication Action Button */}
          <div className="flex items-center gap-2">
            {authToken ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-red-50 text-red-650 hover:bg-red-100 hover:text-red-700 text-xs font-bold transition"
                title="Log Out Manager"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('login')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold transition ${
                  activeTab === 'login' ? 'bg-slate-100 text-blue-600' : 'bg-slate-50/50 text-slate-650'
                }`}
                title="Sign in as Manager"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log In</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Main body viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-16 md:mb-0">
        {renderTabContent()}
      </main>

      {/* Mobile Sticky Tab bar (shows public + active authorized tabs) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 flex items-center justify-around py-2 px-1 backdrop-blur-md shadow-2xl overflow-x-auto scrollbar-none">
        {Object.entries(TAB_CONFIG).map(([tabKey, config]) => {
          if (config.requiresLogin && !authToken) return null;
          
          const Icon = config.icon;
          return (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`flex flex-col items-center gap-1 py-1 text-center shrink-0 w-1/8 px-2 ${
                activeTab === tabKey ? 'text-blue-600' : 'text-slate-450'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold truncate">{config.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 text-center py-6 text-xs text-slate-400 pb-24 md:pb-6">
        <div className="max-w-6xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Shudkara Hub. Serverless Web App designed for Azure SWA.</p>
          <p className="mt-1 font-medium text-slate-350">
            Powered by Firebase Auth, Speakeasy TOTP & MongoDB Atlas.
          </p>
        </div>
      </footer>

    </div>
  );
}

export default App;
