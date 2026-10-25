import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  LayoutDashboard,
  Flame,
  Bookmark,
  Workflow,
  FileCode,
  Clock,
  Package,
  CheckSquare,
  ListOrdered,
  BookOpen,
  Share2,
  FileText,
  Terminal,
  Sparkles,
  Link as LinkIcon,
  Key as KeyIcon,
  Image as ImageIcon,
  ArrowRight,
  Plus,
  Shield,
  X
} from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Applications' | 'Quick Actions' | 'Settings';
  icon: React.ComponentType<{ className?: string }>;
  colorBg: string;
  colorText: string;
  badge?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  authToken?: string | null;
  onOpenNewStreak?: () => void;
  onOpenCheckIn?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  authToken: _authToken,
  onOpenNewStreak,
  onOpenCheckIn
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input whenever palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Master command registry
  const allCommands: CommandItem[] = [
    // ── Primary Applications ──
    {
      id: 'app-notes',
      title: 'Notes & Categories',
      subtitle: 'Categorized markdown notebook, tags, cards & organization',
      category: 'Applications',
      icon: FileText,
      colorBg: 'bg-indigo-50',
      colorText: 'text-indigo-600',
      badge: 'New',
      action: () => {
        setActiveTab('notes');
        onClose();
      }
    },
    {
      id: 'app-streaks',
      title: 'Streaks Challenge',
      subtitle: 'Daily photo proof habit tracker with aggressive Duolingo-style reminders',
      category: 'Applications',
      icon: Flame,
      colorBg: 'bg-orange-50',
      colorText: 'text-orange-600',
      badge: 'New',
      action: () => {
        setActiveTab('streaks');
        onClose();
      }
    },
    {
      id: 'app-dashboard',
      title: 'Dashboard',
      subtitle: 'Main hub, quick launcher & LeetCode prep stats',
      category: 'Applications',
      icon: LayoutDashboard,
      colorBg: 'bg-blue-50',
      colorText: 'text-blue-600',
      action: () => {
        setActiveTab('dashboard');
        onClose();
      }
    },
    {
      id: 'app-savepost',
      title: 'SavePost Vault',
      subtitle: 'Organized social bookmarking with auto-platform detection & tags',
      category: 'Applications',
      icon: Bookmark,
      colorBg: 'bg-amber-50',
      colorText: 'text-amber-600',
      action: () => {
        setActiveTab('savepost');
        onClose();
      }
    },
    {
      id: 'app-concurrency',
      title: 'Concurrency Manager',
      subtitle: 'Parallel task contexts, sittings & workstreams',
      category: 'Applications',
      icon: Workflow,
      colorBg: 'bg-indigo-50',
      colorText: 'text-indigo-600',
      action: () => {
        setActiveTab('concurrency');
        onClose();
      }
    },
    {
      id: 'app-pastebin',
      title: 'Pastebin',
      subtitle: 'Ephemeral & persistent code, image, and document pastes',
      category: 'Applications',
      icon: FileCode,
      colorBg: 'bg-sky-50',
      colorText: 'text-sky-600',
      action: () => {
        setActiveTab('pastebin');
        onClose();
      }
    },
    {
      id: 'app-timeline',
      title: 'Timeline (Lifetime Line)',
      subtitle: 'Personal daily feed, memories & life events',
      category: 'Applications',
      icon: Sparkles,
      colorBg: 'bg-pink-50',
      colorText: 'text-pink-600',
      badge: 'Protected',
      action: () => {
        setActiveTab('timeline');
        onClose();
      }
    },
    {
      id: 'app-timers',
      title: 'Timers & Canvas',
      subtitle: 'Multi-stream countdown timers & whiteboard scratchpad',
      category: 'Applications',
      icon: Clock,
      colorBg: 'bg-emerald-50',
      colorText: 'text-emerald-600',
      action: () => {
        setActiveTab('timers');
        onClose();
      }
    },
    {
      id: 'app-inventory',
      title: 'Inventory Vault',
      subtitle: 'Private personal belongings & asset catalog',
      category: 'Applications',
      icon: Package,
      colorBg: 'bg-purple-50',
      colorText: 'text-purple-600',
      badge: 'Protected',
      action: () => {
        setActiveTab('inventory');
        onClose();
      }
    },
    {
      id: 'app-todos',
      title: 'Todos & Tasks',
      subtitle: 'Minimalist flat whiteboard & prioritized checklist',
      category: 'Applications',
      icon: CheckSquare,
      colorBg: 'bg-teal-50',
      colorText: 'text-teal-600',
      action: () => {
        setActiveTab('todos');
        onClose();
      }
    },
    {
      id: 'app-lists',
      title: 'Lists & Notes',
      subtitle: 'Static references, cheat sheets & quick notebooks',
      category: 'Applications',
      icon: ListOrdered,
      colorBg: 'bg-cyan-50',
      colorText: 'text-cyan-600',
      action: () => {
        setActiveTab('lists');
        onClose();
      }
    },
    {
      id: 'app-leetcode',
      title: 'Blind 75 Tracker',
      subtitle: 'DSA practice notes, solution snippets & revision status',
      category: 'Applications',
      icon: BookOpen,
      colorBg: 'bg-orange-50',
      colorText: 'text-orange-600',
      action: () => {
        setActiveTab('leetcode');
        onClose();
      }
    },
    {
      id: 'app-airdrop',
      title: 'P2P WebRTC Airdrop',
      subtitle: 'Direct browser-to-browser encrypted file sharing',
      category: 'Applications',
      icon: Share2,
      colorBg: 'bg-blue-50',
      colorText: 'text-blue-600',
      action: () => {
        setActiveTab('airdrop');
        onClose();
      }
    },
    {
      id: 'app-textroom',
      title: 'Rooms',
      subtitle: 'Passcode-protected collaborative real-time notepad',
      category: 'Applications',
      icon: FileText,
      colorBg: 'bg-slate-100',
      colorText: 'text-slate-700',
      action: () => {
        setActiveTab('textroom');
        onClose();
      }
    },
    {
      id: 'app-prompts',
      title: 'PromptVault',
      subtitle: 'Curated LLM prompts & one-click link sharing',
      category: 'Applications',
      icon: Terminal,
      colorBg: 'bg-violet-50',
      colorText: 'text-violet-600',
      action: () => {
        setActiveTab('prompts');
        onClose();
      }
    },
    {
      id: 'app-links',
      title: 'LinkManager',
      subtitle: 'Recursive folder trees for developer bookmarks',
      category: 'Applications',
      icon: LinkIcon,
      colorBg: 'bg-rose-50',
      colorText: 'text-rose-600',
      action: () => {
        setActiveTab('links');
        onClose();
      }
    },
    {
      id: 'app-keyval',
      title: 'KeyVal Runbox',
      subtitle: 'Encrypted secret key-value runner',
      category: 'Applications',
      icon: KeyIcon,
      colorBg: 'bg-amber-50',
      colorText: 'text-amber-700',
      action: () => {
        setActiveTab('keyval');
        onClose();
      }
    },
    {
      id: 'app-imgdrop',
      title: 'ImgDrop',
      subtitle: 'Temporary fast image hosting',
      category: 'Applications',
      icon: ImageIcon,
      colorBg: 'bg-emerald-50',
      colorText: 'text-emerald-700',
      action: () => {
        setActiveTab('imgdrop');
        onClose();
      }
    },

    // ── Quick Actions ──
    {
      id: 'action-checkin',
      title: 'Check-In Today’s Streak',
      subtitle: 'Quickly upload your daily photo proof to save your streak',
      category: 'Quick Actions',
      icon: Flame,
      colorBg: 'bg-orange-100',
      colorText: 'text-orange-700',
      action: () => {
        setActiveTab('streaks');
        onClose();
        if (onOpenCheckIn) onOpenCheckIn();
      }
    },
    {
      id: 'action-new-streak',
      title: 'Create New Streak Challenge',
      subtitle: 'Set up a new photo streak with target daily deadline',
      category: 'Quick Actions',
      icon: Plus,
      colorBg: 'bg-blue-100',
      colorText: 'text-blue-700',
      action: () => {
        setActiveTab('streaks');
        onClose();
        if (onOpenNewStreak) onOpenNewStreak();
      }
    },
    {
      id: 'action-new-paste',
      title: 'Create New Paste',
      subtitle: 'Paste code snippet or attach file to share',
      category: 'Quick Actions',
      icon: FileCode,
      colorBg: 'bg-sky-100',
      colorText: 'text-sky-700',
      action: () => {
        setActiveTab('pastebin');
        onClose();
      }
    },
    {
      id: 'action-drop-file',
      title: 'Send File via Airdrop',
      subtitle: 'Instantly connect and stream file to nearby device',
      category: 'Quick Actions',
      icon: Share2,
      colorBg: 'bg-indigo-100',
      colorText: 'text-indigo-700',
      action: () => {
        setActiveTab('airdrop');
        onClose();
      }
    },
    {
      id: 'action-mfa-settings',
      title: 'Authenticator Settings',
      subtitle: 'Manage TOTP and MFA security configuration',
      category: 'Settings',
      icon: Shield,
      colorBg: 'bg-purple-100',
      colorText: 'text-purple-700',
      action: () => {
        setActiveTab('dashboard');
        onClose();
      }
    }
  ];

  // Real-time filtering
  const filteredCommands = allCommands.filter(cmd => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.subtitle.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  // Clamp selected index when list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard controls inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = filteredCommands[selectedIndex];
      if (current) {
        current.action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selectedEl = list.children[selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl bg-white border border-slate-200/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-150 animate-scale-up"
        onKeyDown={handleKeyDown}
      >
        {/* Top Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search apps, jump anywhere, or type a command..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full px-3 py-1.5 bg-transparent text-slate-900 text-sm font-medium placeholder-slate-400 focus:outline-none"
          />
          <div className="flex items-center gap-1.5 shrink-0 pr-1">
            <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 rounded-md shadow-xs">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 space-y-1 divide-y divide-slate-50"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No matching apps or commands found for "{query}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition ${
                    isSelected
                      ? 'bg-blue-50/80 border border-blue-200/80 shadow-xs'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-xl shrink-0 border border-slate-200/60 ${cmd.colorBg} ${cmd.colorText}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {cmd.title}
                        </span>
                        {cmd.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-orange-100 text-orange-700">
                            {cmd.badge}
                          </span>
                        )}
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold ml-auto hidden sm:inline">
                          {cmd.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{cmd.subtitle}</p>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isSelected ? 'text-blue-600 translate-x-0.5' : 'text-slate-300 opacity-0'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span className="hidden sm:inline text-slate-400">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-semibold text-slate-600">/</kbd> anywhere to open
          </span>
        </div>
      </div>
    </div>
  );
};
