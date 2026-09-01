import { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, BookOpen, Share2, FileText, Terminal, Bookmark,
  Link as LinkIcon, Key as KeyIcon, Image as ImageIcon, LogIn, LogOut, Sparkles,
  ChevronDown, Wrench, Layers, Menu, X
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
import { LifetimeLine } from './components/LifetimeLine';
import { SharedPromptViewer } from './components/SharedPromptViewer';

const GLOBAL_SYNC_KEY = 'global_user';

// Categorized Navigation Architecture for Scalable Tool Integration
const NAV_GROUPS = [
  {
    category: 'Tools & Utilities',
    icon: Wrench,
    items: [
      { key: 'airdrop', label: 'Airdrop', description: 'Direct P2P file sharing', icon: Share2, requiresLogin: false },
      { key: 'textroom', label: 'Rooms', description: 'Live collaborative text room', icon: FileText, requiresLogin: false },
      { key: 'keyval', label: 'KeyVal', description: 'Secret key-value runbox', icon: KeyIcon, requiresLogin: false },
      { key: 'imgdrop', label: 'ImgDrop', description: 'Temp image sharing', icon: ImageIcon, requiresLogin: false },
    ]
  },
  {
    category: 'Knowledge & Vaults',
    icon: Layers,
    items: [
      { key: 'prompts', label: 'PromptVault', description: 'AI prompt library & links', icon: Bookmark, requiresLogin: false },
      { key: 'links', label: 'LinkManager', description: 'Tree bookmark manager', icon: LinkIcon, requiresLogin: false },
      { key: 'timeline', label: 'Timeline', description: 'Lifetime Line personal feed', icon: Sparkles, requiresLogin: true },
      { key: 'leetcode', label: 'LeetCode 75', description: 'Study tracker & notes', icon: BookOpen, requiresLogin: true },
    ]
  }
];

// Flat tab config for route checks
const TAB_CONFIG: Record<string, { requiresLogin: boolean; label: string; icon: any }> = {
  dashboard: { requiresLogin: false, label: 'Dashboard', icon: LayoutDashboard },
  leetcode: { requiresLogin: true, label: 'LeetCode 75', icon: BookOpen },
  airdrop: { requiresLogin: false, label: 'Airdrop', icon: Share2 },
  textroom: { requiresLogin: false, label: 'Rooms', icon: FileText },
  prompts: { requiresLogin: false, label: 'PromptVault', icon: Bookmark },
  timeline: { requiresLogin: true, label: 'Timeline', icon: Sparkles },
  links: { requiresLogin: false, label: 'LinkManager', icon: LinkIcon },
  keyval: { requiresLogin: false, label: 'KeyVal', icon: KeyIcon },
  imgdrop: { requiresLogin: false, label: 'ImgDrop', icon: ImageIcon }
};

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [urlRoomId, setUrlRoomId] = useState<string | null>(null);

  // Standalone Prompt Share URL handling
  const [sharedPromptId, setSharedPromptId] = useState<string | null>(null);
  const [sharedPrompt, setSharedPrompt] = useState<any | null>(null);

  // Authentication State
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Database Sync States (silent background sync)
  const [leetcodeProgress, setLeetcodeProgress] = useState<Record<string, any>>({});
  const [prompts, setPrompts] = useState<any[]>([]);
  const isInitializedRef = useRef(false);

  // Active Dropdown state for Desktop Navbar
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setUrlRoomId(room);
      setActiveTab('textroom');
    }

    const promptId = params.get('promptId');
    if (promptId) {
      setSharedPromptId(promptId);
    }
  }, []);

  // Ensure dark mode class is never present on document element
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
        setAuthToken(token);
      });
    }
  }, []);

  // Sync prompts and leetcode progress
  useEffect(() => {
    loadCloudData();
  }, []);

  // Debounced auto-save for cloud state
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

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
      }
    } catch (err) {
      console.error('Failed to load cloud data:', err);
    }
  };

  // Find shared prompt when sharedPromptId or prompts change
  useEffect(() => {
    if (sharedPromptId && prompts.length > 0) {
      const found = prompts.find((p: any) => p.id === sharedPromptId);
      if (found) {
        // If private, only show if logged in
        if (found.isPrivate && !authToken) {
          setSharedPrompt(null);
        } else {
          setSharedPrompt(found);
        }
      }
    }
  }, [sharedPromptId, prompts, authToken]);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem('shudkara_auth_token', token);
    setAuthToken(token);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    if (authToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-Session-Token': authToken }
      }).catch(() => {});
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

  // ── Standalone Share View Mode ──
  // If viewing a shared prompt link, render ONLY the prompt card with NO website UI/header/footer
  if (sharedPromptId) {
    if (sharedPrompt) {
      return <SharedPromptViewer prompt={sharedPrompt} />;
    } else {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center max-w-sm space-y-3">
            <h2 className="text-xl font-bold text-white">Prompt Not Available</h2>
            <p className="text-xs text-slate-400">
              This prompt may have been set to private or deleted by its author.
            </p>
          </div>
        </div>
      );
    }
  }

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
        return <PromptVault prompts={prompts} onPromptsChange={setPrompts} authToken={authToken} />;
      case 'timeline':
        return <LifetimeLine authToken={authToken} />;
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 transition-colors duration-150" onClick={() => setOpenDropdown(null)}>
      
      {/* Navbar Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo brand */}
          <div 
            onClick={() => { setActiveTab('dashboard'); setOpenDropdown(null); }} 
            className="flex items-center gap-2 cursor-pointer select-none group"
          >
            <span className="p-2 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <Terminal className="w-5 h-5" />
            </span>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              shudkara
            </span>
          </div>

          {/* Categorized Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            {/* Dashboard Button */}
            <button
              onClick={() => { setActiveTab('dashboard'); setOpenDropdown(null); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-slate-100 text-blue-600 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </button>

            {/* Categorized Dropdown Groups */}
            {NAV_GROUPS.map((group) => {
              const GroupIcon = group.icon;
              const isGroupActive = group.items.some(item => item.key === activeTab);
              const isOpen = openDropdown === group.category;

              return (
                <div key={group.category} className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenDropdown(isOpen ? null : group.category)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                      isGroupActive
                        ? 'bg-blue-50 text-blue-600 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <GroupIcon className="w-3.5 h-3.5" />
                    {group.category}
                    <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {isOpen && (
                    <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                      {group.items.map((item) => {
                        if (item.requiresLogin && !authToken) return null;
                        const ItemIcon = item.icon;
                        const isSelected = activeTab === item.key;

                        return (
                          <div
                            key={item.key}
                            onClick={() => {
                              setActiveTab(item.key);
                              setOpenDropdown(null);
                            }}
                            className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition ${
                              isSelected 
                                ? 'bg-blue-50/80 text-blue-700 font-bold' 
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <ItemIcon className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-xs font-bold tracking-tight">{item.label}</p>
                              <p className="text-[10px] text-slate-400 truncate">{item.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Authentication Action & Mobile Menu Toggle */}
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
                onClick={() => { setActiveTab('login'); setOpenDropdown(null); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold transition ${
                  activeTab === 'login' ? 'bg-slate-100 text-blue-600' : 'bg-slate-50/50 text-slate-650'
                }`}
                title="Sign in as Manager"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log In</span>
              </button>
            )}

            {/* Mobile Menu Trigger */}
            <button
              onClick={(e) => { e.stopPropagation(); setMobileMenuOpen(!mobileMenuOpen); }}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Accordion Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white p-4 space-y-4 shadow-xl">
            <button
              onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl ${
                activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>

            {NAV_GROUPS.map((group) => (
              <div key={group.category} className="space-y-1">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-2">{group.category}</p>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    if (item.requiresLogin && !authToken) return null;
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => { setActiveTab(item.key); setMobileMenuOpen(false); }}
                        className={`flex items-center gap-2 p-2.5 rounded-xl text-left text-xs font-semibold transition ${
                          activeTab === item.key ? 'bg-blue-50 text-blue-600 font-bold border border-blue-200' : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        <ItemIcon className="w-4 h-4 shrink-0 text-blue-500" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Main body viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-16 md:mb-0">
        {renderTabContent()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 text-center py-6 text-xs text-slate-400 pb-24 md:pb-6">
        <div className="max-w-6xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Shudkara Hub. Serverless Web App designed for Azure SWA.</p>
          <p className="mt-1 font-medium text-slate-350">
            Powered by TOTP Auth & MongoDB Atlas.
          </p>
        </div>
      </footer>

    </div>
  );
}

export default App;
