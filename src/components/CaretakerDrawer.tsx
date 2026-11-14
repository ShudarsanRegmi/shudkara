import { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Sparkles,
  Send,
  RefreshCw,
  Mail,
  Sliders,
  Brain,
  CheckCircle2,
  AlertTriangle,
  X,
  Bot,
  User,
  Flame,
  Wallet,
  Hourglass,
  CheckSquare,
  Key,
  Database,
  ArrowRight
} from 'lucide-react';

export interface CaretakerDigest {
  status: 'all_clear' | 'attention_required' | 'critical_alert';
  headline: string;
  digestMarkdown: string;
  actionItems: Array<{
    id: string;
    subapp: 'finance' | 'streaks' | 'lifeodyssey' | 'todos' | 'general';
    label: string;
    urgency: 'low' | 'medium' | 'high';
  }>;
  timestamp: string;
}

export interface CoreMemoryData {
  human: string;
  persona: string;
  updatedAt: string;
}

export interface ChatMsg {
  sender: 'user' | 'caretaker';
  content: string;
  timestamp: string;
}

interface CaretakerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
}

export function CaretakerDrawer({ isOpen, onClose, setActiveTab }: CaretakerDrawerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'briefing' | 'chat' | 'memory' | 'settings'>('briefing');
  const [digest, setDigest] = useState<CaretakerDigest | null>(null);
  const [_coreMemory, setCoreMemory] = useState<CoreMemoryData | null>(null);
  const [archivalItems, setArchivalItems] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [_loading, setLoading] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // Settings State
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keySaveMsg, setKeySaveMsg] = useState<string | null>(null);

  // Core memory edit state
  const [humanMemoryInput, setHumanMemoryInput] = useState('');
  const [personaMemoryInput, setPersonaMemoryInput] = useState('');
  const [savingMemory, setSavingMemory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    if (activeSubTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeSubTab]);

  // Fetch initial data
  const loadCaretakerData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Digest
      const dRes = await fetch('/api/caretaker/digest');
      if (dRes.ok) {
        const dData = await dRes.json();
        setDigest(dData.digest);
        if (dData.coreMemory) {
          setCoreMemory(dData.coreMemory);
          setHumanMemoryInput(dData.coreMemory.human || '');
          setPersonaMemoryInput(dData.coreMemory.persona || '');
        }
      }

      // 2. Fetch Memory & Session
      const mRes = await fetch('/api/caretaker/memory');
      if (mRes.ok) {
        const mData = await mRes.json();
        if (mData.session?.messages) {
          setMessages(mData.session.messages);
        }
        if (Array.isArray(mData.archival)) {
          setArchivalItems(mData.archival);
        }
      }

      // 3. Fetch Settings
      const sRes = await fetch('/api/caretaker/settings');
      if (sRes.ok) {
        const sData = await sRes.json();
        setHasGeminiKey(Boolean(sData.hasGeminiKey));
      }
    } catch (err) {
      console.warn('Failed to load Caretaker data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCaretakerData();
    }
  }, [isOpen]);

  // Trigger Manual Audit
  const handleTriggerAudit = async () => {
    setAuditing(true);
    try {
      const res = await fetch('/api/caretaker/trigger', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDigest(data.digest);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuditing(false);
    }
  };

  // Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMsg.trim();
    if (!text || sendingMsg) return;

    setInputMsg('');
    const userMsg: ChatMsg = { sender: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setSendingMsg(true);

    try {
      const res = await fetch('/api/caretaker/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      if (res.ok) {
        const data = await res.json();
        const caretakerMsg: ChatMsg = {
          sender: 'caretaker',
          content: data.reply,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, caretakerMsg]);
        if (data.coreMemory) {
          setCoreMemory(data.coreMemory);
          setHumanMemoryInput(data.coreMemory.human);
          setPersonaMemoryInput(data.coreMemory.persona);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMsg(false);
    }
  };

  // Save Core Memory
  const handleSaveCoreMemory = async () => {
    setSavingMemory(true);
    try {
      const res = await fetch('/api/caretaker/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'core',
          human: humanMemoryInput,
          persona: personaMemoryInput
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCoreMemory(data.coreMemory);
        alert('Core Memory (Virtual RAM) updated successfully!');
      }
    } catch (err) {
      alert('Failed to update core memory');
    } finally {
      setSavingMemory(false);
    }
  };

  // Save API Key
  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      const res = await fetch('/api/caretaker/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: apiKeyInput.trim() })
      });
      if (res.ok) {
        setHasGeminiKey(true);
        setKeySaveMsg('Gemini API Key saved and activated!');
        setApiKeyInput('');
        setTimeout(() => setKeySaveMsg(null), 3000);
      }
    } catch (err) {
      setKeySaveMsg('Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  };

  // Dispatch Email Briefing
  const handleDispatchEmail = async () => {
    setEmailSending(true);
    setEmailStatus(null);
    try {
      const res = await fetch('/api/caretaker/trigger', { method: 'POST' });
      if (res.ok) {
        setEmailStatus('Briefing dispatched to your inbox!');
      } else {
        setEmailStatus('Email dispatch failed. Verify Gmail App Password in backend.');
      }
    } catch (e) {
      setEmailStatus('Network error while dispatching email.');
    } finally {
      setEmailSending(false);
      setTimeout(() => setEmailStatus(null), 4000);
    }
  };

  if (!isOpen) return null;

  const statusColor =
    digest?.status === 'critical_alert'
      ? 'bg-rose-500 text-white'
      : digest?.status === 'attention_required'
      ? 'bg-amber-400 text-slate-950'
      : 'bg-emerald-500 text-white';

  const statusBorder =
    digest?.status === 'critical_alert'
      ? 'border-rose-500/50 shadow-rose-500/10'
      : digest?.status === 'attention_required'
      ? 'border-amber-400/50 shadow-amber-500/10'
      : 'border-emerald-500/50 shadow-emerald-500/10';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl h-full bg-slate-900 text-slate-100 flex flex-col shadow-2xl border-l border-slate-800 animate-in slide-in-from-right duration-300">
        
        {/* ── Top Header ── */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">The Sentinel</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColor}`}>
                  {digest?.status ? digest.status.replace('_', ' ') : 'WATCHING'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Autonomous Caretaker & OS Memory Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleTriggerAudit}
              disabled={auditing}
              title="Run instant real-time audit"
              className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${auditing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-4 text-xs font-bold gap-1">
          <button
            onClick={() => setActiveSubTab('briefing')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'briefing'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Daily Briefing</span>
          </button>

          <button
            onClick={() => setActiveSubTab('chat')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'chat'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Live Chat</span>
            {messages.length > 0 && (
              <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded-full text-[10px]">
                {messages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('memory')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'memory'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Core Memory (RAM)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'settings'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
            {!hasGeminiKey && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
          </button>
        </div>

        {/* ── Subtab Body ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* TAB 1: BRIEFING */}
          {activeSubTab === 'briefing' && (
            <div className="space-y-4">
              {/* Headline Banner */}
              <div className={`p-4 rounded-2xl border bg-slate-950/80 ${statusBorder} space-y-1`}>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>EXECUTIVE ASSESSMENT</span>
                  <span>{digest?.timestamp ? new Date(digest.timestamp).toLocaleTimeString() : 'Live'}</span>
                </div>
                <h3 className="text-sm font-bold text-white">{digest?.headline || 'Audit in progress...'}</h3>
              </div>

              {/* Action items */}
              {digest?.actionItems && digest.actionItems.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    High-Priority Micro-Actions
                  </span>
                  <div className="space-y-1.5">
                    {digest.actionItems.map((act) => (
                      <div
                        key={act.id}
                        className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {act.subapp === 'finance' ? (
                            <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : act.subapp === 'streaks' ? (
                            <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : act.subapp === 'lifeodyssey' ? (
                            <Hourglass className="w-4 h-4 text-indigo-400 shrink-0" />
                          ) : (
                            <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-200">{act.label}</span>
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab(act.subapp === 'general' ? 'dashboard' : act.subapp);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          Jump <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Digest Markdown body */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 whitespace-pre-line font-sans">
                {digest?.digestMarkdown || 'No briefing generated yet. Click refresh to trigger the audit.'}
              </div>

              {/* Email dispatch trigger */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  {emailStatus ? (
                    <span className="text-amber-400 font-bold">{emailStatus}</span>
                  ) : (
                    'Scheduled automatic briefings: 08:00 AM & 08:00 PM'
                  )}
                </span>
                <button
                  onClick={handleDispatchEmail}
                  disabled={emailSending}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{emailSending ? 'Sending...' : 'Email Briefing Now'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE CHAT */}
          {activeSubTab === 'chat' && (
            <div className="h-full flex flex-col justify-between space-y-4">
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <div className="p-8 text-center space-y-2 text-slate-400">
                    <Bot className="w-10 h-10 text-indigo-400 mx-auto" />
                    <p className="text-xs">
                      The Sentinel is active. Ask anything about your financial debts, streak status, life milestones, or request advice.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                      <button
                        onClick={() => setInputMsg('What debts are currently overdue?')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs"
                      >
                        "What debts are overdue?"
                      </button>
                      <button
                        onClick={() => setInputMsg('What streaks do I need to complete today?')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs"
                      >
                        "What streaks are open?"
                      </button>
                      <button
                        onClick={() => setInputMsg('Give me a tough-love critique of my current progress.')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs"
                      >
                        "Tough-love critique"
                      </button>
                    </div>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isUser = m.sender === 'user';
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                            isUser ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-indigo-400 border border-slate-700'
                          }`}
                        >
                          {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>
                        <div
                          className={`p-3 rounded-2xl text-xs sm:text-sm max-w-[85%] leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : 'bg-slate-800/80 border border-slate-700/80 text-slate-200 rounded-tl-none'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="pt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder="Ask The Sentinel..."
                  disabled={sendingMsg}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sendingMsg || !inputMsg.trim()}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: CORE MEMORY (RAM) */}
          {activeSubTab === 'memory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-400" />
                    <span>MemGPT Core Memory (Virtual RAM)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    The living facts and directives kept permanently in active RAM across conversations.
                  </p>
                </div>
                <button
                  onClick={handleSaveCoreMemory}
                  disabled={savingMemory}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {savingMemory ? 'Saving...' : 'Save Core RAM'}
                </button>
              </div>

              {/* Human Core */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">HUMAN PROFILE (Who You Are & Enduring Facts)</label>
                <textarea
                  rows={6}
                  value={humanMemoryInput}
                  onChange={(e) => setHumanMemoryInput(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Persona Core */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">SENTINEL PERSONA (Directives & Operational Philosophy)</label>
                <textarea
                  rows={5}
                  value={personaMemoryInput}
                  onChange={(e) => setPersonaMemoryInput(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Archival Items List */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Archival Disk Storage ({archivalItems.length} records)</span>
                </div>
                {archivalItems.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No archival memory paged out yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {archivalItems.map((item) => (
                      <div key={item.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                        <p>{item.content}</p>
                        <span className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeSubTab === 'settings' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-400" />
                  <span>Gemini AI Engine Configuration</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Power The Sentinel with Google Gemini 2.5 Flash for natural language reasoning and tool execution.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">API Key Status</span>
                  {hasGeminiKey ? (
                    <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Key Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" /> Fallback Heuristic Mode
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveApiKey} className="space-y-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter your Gemini API Key..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={savingKey || !apiKeyInput.trim()}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    {savingKey ? 'Saving...' : 'Update Gemini API Key'}
                  </button>
                </form>

                {keySaveMsg && <p className="text-xs font-bold text-indigo-400">{keySaveMsg}</p>}
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300">Nodemailer Email Service</span>
                <p className="text-xs text-slate-400">
                  Sends critical alerts and daily briefings via Gmail SMTP. Configured via <code className="text-indigo-300 font-mono">GMAIL_APP_PASSWORD</code> in Azure environment settings.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
