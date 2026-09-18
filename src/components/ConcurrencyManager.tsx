import React, { useState, useEffect, useCallback } from 'react';
import {
  Workflow, Plus, Search, Pin, Lock, Unlock,
  Trash2, Edit3, X, Sparkles,
  Play, Pause, Shield, ShieldOff, Activity, ArrowRight,
  CheckCircle2, Circle, ExternalLink, HelpCircle,
  Brain, FileText, CornerDownRight, Link as LinkIcon,
  BellRing, Layers, BarChart2
} from 'lucide-react';

export type WorkstreamState = 'ACTIVE' | 'PAUSED' | 'WAITING' | 'SUSPENDED';

export interface MicroTask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface ParkedThought {
  id: string;
  content: string;
  createdAt: string;
}

export interface ContextLink {
  label: string;
  url: string;
}

export interface TimeLog {
  id: string;
  startTime: string;
  endTime?: string | null;
  durationSeconds: number;
  taskName?: string;
}

export interface BackgroundAlarm {
  id: string;
  message: string;
  triggerTime: number; // Unix timestamp ms
  durationMinutes: number;
  active: boolean;
  triggered?: boolean;
}

export interface Workstream {
  id: string;
  title: string;
  description?: string;
  category?: string;
  color?: string; // indigo, emerald, rose, amber, purple, cyan, slate
  state: WorkstreamState;
  isPinned?: boolean;
  isPrivate?: boolean;
  order?: number;
  lastActiveTime?: string;
  totalActiveSeconds?: number;

  // Context preservation
  currentTask?: string;
  nextAction?: string;
  whereILeftOff?: string;
  filesOrLinks?: ContextLink[];

  // Lists & Granular Time Logs
  microTasks?: MicroTask[];
  parkingLot?: ParkedThought[];
  timeLogs?: TimeLog[];
  backgroundAlarms?: BackgroundAlarm[];

  createdAt?: string;
  updatedAt?: string;
}

export interface Sitting {
  id: string;
  title: string;
  workstreamIds: string[];
  active: boolean;
  createdAt?: string;
}

export interface ConcurrencyConfig {
  maxActiveWorkstreams: number; // 1 to 4
  focusModeEnabled: boolean;
  soundAlerts: boolean;
  isBoardPrivate: boolean;
}

export interface ConcurrencySession {
  id: string;
  status: 'ACTIVE' | 'COMPLETED';
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number;
  totalContextSwitches: number;
  switchesHistory: Array<{ fromId: string; toId: string; timestamp: string; reason?: string }>;
  attentionHealthScore?: number;
}

interface ConcurrencyManagerProps {
  authToken?: string | null;
}

const STATE_BADGES: Record<WorkstreamState, { label: string; bg: string; text: string; dotBg: string }> = {
  ACTIVE: { label: 'ACTIVE', bg: 'bg-emerald-100', text: 'text-emerald-800', dotBg: 'bg-emerald-500 animate-pulse' },
  PAUSED: { label: 'PAUSED', bg: 'bg-amber-100', text: 'text-amber-800', dotBg: 'bg-amber-500' },
  WAITING: { label: 'WAITING', bg: 'bg-cyan-100', text: 'text-cyan-800', dotBg: 'bg-cyan-500' },
  SUSPENDED: { label: 'SUSPENDED', bg: 'bg-slate-100', text: 'text-slate-700', dotBg: 'bg-slate-400' }
};

export const ConcurrencyManager: React.FC<ConcurrencyManagerProps> = ({ authToken }) => {
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [sittings, setSittings] = useState<Sitting[]>([]);
  const [activeSitting, setActiveSitting] = useState<Sitting | null>(null);

  const [config, setConfig] = useState<ConcurrencyConfig>({
    maxActiveWorkstreams: 3,
    focusModeEnabled: false,
    soundAlerts: true,
    isBoardPrivate: true
  });
  const [activeSession, setActiveSession] = useState<ConcurrencySession | null>(null);
  const [recentSessions, setRecentSessions] = useState<ConcurrencySession[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  // Modals & Panels
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showSittingModal, setShowSittingModal] = useState<boolean>(false);
  const [showTimeLogsModal, setShowTimeLogsModal] = useState<Workstream | null>(null);
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [editingWorkstream, setEditingWorkstream] = useState<Workstream | null>(null);
  const [resumingWorkstream, setResumingWorkstream] = useState<{ workstream: Workstream; previous?: Workstream } | null>(null);
  const [triggeredAlarm, setTriggeredAlarm] = useState<{ workstreamTitle: string; message: string } | null>(null);

  // Sitting Form State
  const [sittingTitle, setSittingTitle] = useState('');
  const [sittingSelectedIds, setSittingSelectedIds] = useState<string[]>([]);

  // Workstream Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formColor, setFormColor] = useState('indigo');
  const [formCurrentTask, setFormCurrentTask] = useState('');
  const [formNextAction, setFormNextAction] = useState('');
  const [formWhereILeftOff, setFormWhereILeftOff] = useState('');
  const [formIsPrivate, setFormIsPrivate] = useState(true);

  // Background Alarm Form State per Workstream
  const [alarmMinutes, setAlarmMinutes] = useState<Record<string, number>>({});
  const [alarmMessage, setAlarmMessage] = useState<Record<string, string>>({});
  const [showAddAlarm, setShowAddAlarm] = useState<Record<string, boolean>>({});

  // Inline Quick Inputs
  const [quickThought, setQuickThought] = useState<Record<string, string>>({});
  const [quickMicroTask, setQuickMicroTask] = useState<Record<string, string>>({});
  const [quickLinkName, setQuickLinkName] = useState<Record<string, string>>({});
  const [quickLinkUrl, setQuickLinkUrl] = useState<Record<string, string>>({});
  const [showAddLink, setShowAddLink] = useState<Record<string, boolean>>({});

  // Toast / Status Message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [switchReasonInput, setSwitchReasonInput] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Web Audio API Chime Synthesizer
  const playChimeSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.15); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.35); // D6

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.8);
    } catch {
      // Ignore audio autoplay restrictions
    }
  };

  // ── Fetch Concurrency State ────────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch('/api/concurrency', { headers });
      if (res.ok) {
        const data = await res.json();
        setWorkstreams(data.workstreams || []);
        if (data.sittings) setSittings(data.sittings);
        if (data.activeSitting !== undefined) setActiveSitting(data.activeSitting);
        if (data.config) setConfig(data.config);
        if (data.activeSession !== undefined) setActiveSession(data.activeSession);
        if (data.recentSessions) setRecentSessions(data.recentSessions);
      }
    } catch (err) {
      console.error('Failed to load concurrency data:', err);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // ── Timer Interval Tick (Stopwatch, Active Duration & Background Alarms) ──
  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();

      setWorkstreams(prev =>
        prev.map(ws => {
          let updatedActiveSeconds = ws.totalActiveSeconds || 0;
          if (ws.state === 'ACTIVE') {
            updatedActiveSeconds += 1;
          }

          // Check Background Alarms
          let alarmTriggered = false;
          const updatedAlarms = (ws.backgroundAlarms || []).map(alarm => {
            if (alarm.active && !alarm.triggered && nowMs >= alarm.triggerTime) {
              alarmTriggered = true;
              setTriggeredAlarm({
                workstreamTitle: ws.title,
                message: alarm.message || `Background alarm call triggered for ${ws.title}`
              });
              playChimeSound();
              return { ...alarm, active: false, triggered: true };
            }
            return alarm;
          });

          if (alarmTriggered) {
            showToast(`🔔 Alarm Callback Triggered for "${ws.title}"!`);
          }

          return {
            ...ws,
            totalActiveSeconds: updatedActiveSeconds,
            backgroundAlarms: updatedAlarms
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ── Keyboard Shortcuts (Ctrl+1..4, Ctrl+P, Ctrl+Space) ─────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          const slotIndex = parseInt(e.key) - 1;
          const sorted = [...workstreams].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
          if (sorted[slotIndex]) {
            handleSwitchWorkstream(sorted[slotIndex]);
          }
        } else if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          toggleFocusMode();
        } else if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          const activeWs = workstreams.find(w => w.state === 'ACTIVE');
          if (activeWs) {
            const el = document.getElementById(`parking-input-${activeWs.id}`);
            if (el) el.focus();
          } else {
            showToast('No active workstream to park thought.');
          }
        }
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workstreams]);

  // ── API Helpers ────────────────────────────────────────────────────────────
  const saveWorkstreamUpdate = async (id: string, payload: Partial<Workstream>) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch(`/api/concurrency/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || 'Failed to update workstream.');
        return false;
      }
      const updated = await res.json();
      setWorkstreams(prev => prev.map(w => (w.id === id ? { ...w, ...updated } : w)));
      return true;
    } catch (err) {
      console.error('Error updating workstream:', err);
      showToast('Network error updating workstream.');
      return false;
    }
  };

  const handleCreateWorkstream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      const payload = {
        title: formTitle,
        description: formDescription,
        category: formCategory,
        color: formColor,
        currentTask: formCurrentTask,
        nextAction: formNextAction,
        whereILeftOff: formWhereILeftOff,
        isPrivate: formIsPrivate,
        state: 'PAUSED'
      };

      const res = await fetch('/api/concurrency', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || 'Failed to create workstream.');
        return;
      }

      const created = await res.json();
      setWorkstreams(prev => [created, ...prev]);

      // If a sitting is active, automatically attach new workstream to sitting
      if (activeSitting) {
        const updatedIds = [...activeSitting.workstreamIds, created.id];
        await handleSaveSittingUpdate(activeSitting.id, activeSitting.title, updatedIds, true);
      }

      setShowCreateModal(false);
      resetForm();
      showToast(`Created workstream "${created.title}"`);
    } catch (err) {
      console.error('Error creating workstream:', err);
    }
  };

  const handleDeleteWorkstream = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete workstream "${title}"?`)) return;

    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch(`/api/concurrency/${id}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        setWorkstreams(prev => prev.filter(w => w.id !== id));
        showToast(`Deleted workstream "${title}"`);
      } else {
        showToast('Failed to delete workstream.');
      }
    } catch (err) {
      console.error('Error deleting workstream:', err);
    }
  };

  // ── Current Sitting (Sitting Session Management) ───────────────────────────
  const handleSaveSittingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sittingTitle.trim()) return;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch('/api/concurrency/sittings', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'create',
          title: sittingTitle.trim(),
          workstreamIds: sittingSelectedIds,
          active: true
        })
      });

      if (res.ok) {
        const createdSitting = await res.json();
        setSittings(prev => [createdSitting, ...prev.map(s => ({ ...s, active: false }))]);
        setActiveSitting(createdSitting);
        setShowSittingModal(false);
        setSittingTitle('');
        setSittingSelectedIds([]);
        showToast(`Switched sitting to "${createdSitting.title}" (${sittingSelectedIds.length} workstreams)`);
      }
    } catch (err) {
      console.error('Failed to create sitting:', err);
    }
  };

  const handleActivateSitting = async (sittingId: string | null) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      await fetch('/api/concurrency/sittings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'activate', id: sittingId })
      });

      if (sittingId === null) {
        setActiveSitting(null);
        setSittings(prev => prev.map(s => ({ ...s, active: false })));
        showToast('Showing all workstreams');
      } else {
        const target = sittings.find(s => s.id === sittingId);
        setActiveSitting(target || null);
        setSittings(prev => prev.map(s => ({ ...s, active: s.id === sittingId })));
        if (target) showToast(`Active sitting: "${target.title}"`);
      }
    } catch (err) {
      console.error('Failed to activate sitting:', err);
    }
  };

  const handleSaveSittingUpdate = async (id: string, title: string, workstreamIds: string[], active: boolean) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch('/api/concurrency/sittings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'update', id, title, workstreamIds, active })
      });
      if (res.ok) {
        const updated = await res.json();
        setSittings(prev => prev.map(s => (s.id === id ? updated : s)));
        if (active) setActiveSitting(updated);
      }
    } catch (err) {
      console.error('Failed to update sitting:', err);
    }
  };

  const toggleWorkstreamInCurrentSitting = async (wsId: string) => {
    if (!activeSitting) {
      // Create new active sitting on the fly
      const newTitle = `Current Sitting (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch('/api/concurrency/sittings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'create', title: newTitle, workstreamIds: [wsId], active: true })
      });
      if (res.ok) {
        const created = await res.json();
        setSittings(prev => [created, ...prev.map(s => ({ ...s, active: false }))]);
        setActiveSitting(created);
        showToast(`Created sitting "${newTitle}" with 1 workstream`);
      }
      return;
    }

    const exists = activeSitting.workstreamIds.includes(wsId);
    const updatedIds = exists
      ? activeSitting.workstreamIds.filter(id => id !== wsId)
      : [...activeSitting.workstreamIds, wsId];

    await handleSaveSittingUpdate(activeSitting.id, activeSitting.title, updatedIds, true);
    showToast(exists ? 'Removed from sitting' : 'Added to current sitting');
  };

  // ── Context Switch Flow ────────────────────────────────────────────────────
  const handleSwitchWorkstream = async (targetWs: Workstream) => {
    const currentActive = workstreams.find(w => w.state === 'ACTIVE' && w.id !== targetWs.id);

    const activeCount = workstreams.filter(w => w.state === 'ACTIVE' && w.id !== targetWs.id).length;
    if (activeCount >= config.maxActiveWorkstreams) {
      showToast(`Active limit reached (${config.maxActiveWorkstreams}). Pause or suspend another workstream first.`);
      return;
    }

    setResumingWorkstream({ workstream: targetWs, previous: currentActive });
  };

  const confirmSwitchWorkstream = async () => {
    if (!resumingWorkstream) return;
    const targetWs = resumingWorkstream.workstream;
    const prevWs = resumingWorkstream.previous;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      await fetch('/api/concurrency/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'switch',
          fromWorkstreamId: prevWs?.id || null,
          toWorkstreamId: targetWs.id,
          reason: switchReasonInput || 'Context Switch'
        })
      });

      showToast(`Switched focus to "${targetWs.title}"`);
      setResumingWorkstream(null);
      setSwitchReasonInput('');
      fetchState();
    } catch (err) {
      console.error('Error recording switch:', err);
    }
  };

  const handleSetState = async (ws: Workstream, newState: WorkstreamState) => {
    if (newState === 'ACTIVE') {
      handleSwitchWorkstream(ws);
      return;
    }

    // Add time log entry if turning off ACTIVE
    const nowIso = new Date().toISOString();
    let updatedTimeLogs = ws.timeLogs || [];
    if (ws.state === 'ACTIVE' && updatedTimeLogs.length > 0) {
      updatedTimeLogs = updatedTimeLogs.map(log => {
        if (!log.endTime) {
          const duration = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(log.startTime).getTime()) / 1000));
          return { ...log, endTime: nowIso, durationSeconds: duration };
        }
        return log;
      });
    }

    setWorkstreams(prev => prev.map(w => (w.id === ws.id ? { ...w, state: newState, timeLogs: updatedTimeLogs } : w)));
    await saveWorkstreamUpdate(ws.id, { state: newState, timeLogs: updatedTimeLogs });
    showToast(`Workstream "${ws.title}" is now ${newState}`);
  };

  // ── Background Alarm Callbacks ─────────────────────────────────────────────
  const handleAddAlarmCallback = async (wsId: string) => {
    const mins = alarmMinutes[wsId] || 3;
    const msg = (alarmMessage[wsId] || '').trim();

    const ws = workstreams.find(w => w.id === wsId);
    if (!ws) return;

    const triggerTime = Date.now() + mins * 60 * 1000;
    const newAlarm: BackgroundAlarm = {
      id: crypto.randomUUID(),
      message: msg || `Background timer callback for "${ws.title}"`,
      triggerTime,
      durationMinutes: mins,
      active: true
    };

    const updatedAlarms = [...(ws.backgroundAlarms || []), newAlarm];
    setWorkstreams(prev => prev.map(w => (w.id === wsId ? { ...w, backgroundAlarms: updatedAlarms } : w)));
    setShowAddAlarm(prev => ({ ...prev, [wsId]: false }));
    setAlarmMessage(prev => ({ ...prev, [wsId]: '' }));
    await saveWorkstreamUpdate(wsId, { backgroundAlarms: updatedAlarms });
    showToast(`🔔 Alarm callback set for ${mins} minute(s)`);
  };

  const handleCancelAlarm = async (wsId: string, alarmId: string) => {
    const ws = workstreams.find(w => w.id === wsId);
    if (!ws) return;

    const updatedAlarms = (ws.backgroundAlarms || []).filter(a => a.id !== alarmId);
    setWorkstreams(prev => prev.map(w => (w.id === wsId ? { ...w, backgroundAlarms: updatedAlarms } : w)));
    await saveWorkstreamUpdate(wsId, { backgroundAlarms: updatedAlarms });
  };

  // ── Concurrency Level Selector & Config ────────────────────────────────────
  const handleMaxActiveChange = async (newMax: number) => {
    const updatedConfig = { ...config, maxActiveWorkstreams: newMax };
    setConfig(updatedConfig);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      await fetch('/api/concurrency/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(updatedConfig)
      });
      showToast(`Concurrency limit updated to ${newMax} parallel workstreams`);
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  };

  const toggleFocusMode = async () => {
    const updatedConfig = { ...config, focusModeEnabled: !config.focusModeEnabled };
    setConfig(updatedConfig);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      await fetch('/api/concurrency/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(updatedConfig)
      });
      showToast(updatedConfig.focusModeEnabled ? '🛡️ Focus Shield ON (Notifications Queued)' : 'Focus Shield OFF');
    } catch (err) {
      console.error('Failed to toggle focus mode:', err);
    }
  };

  const toggleBoardPrivacy = async () => {
    const newPrivate = !config.isBoardPrivate;
    setConfig(prev => ({ ...prev, isBoardPrivate: newPrivate }));

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      await fetch('/api/concurrency/privacy', {
        method: 'POST',
        headers,
        body: JSON.stringify({ isBoardPrivate: newPrivate })
      });
      showToast(newPrivate ? 'Concurrency Board is now Private' : 'Concurrency Board is now Public');
    } catch (err) {
      console.error('Failed to toggle board privacy:', err);
    }
  };

  // ── Session Controls ──────────────────────────────────────────────────────
  const handleStartSession = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch('/api/concurrency/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'start', targetConcurrencyLevel: config.maxActiveWorkstreams })
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        showToast('🚀 Sitting session timer started!');
      }
    } catch (err) {
      console.error('Failed to start session:', err);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch('/api/concurrency/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'end' })
      });
      if (res.ok) {
        const endedSession = await res.json();
        setActiveSession(null);
        setRecentSessions(prev => [endedSession, ...prev]);
        setShowSessionModal(true);
        showToast('Sitting ended. Analytics summary generated.');
      }
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  };

  // ── Micro Tasks ───────────────────────────────────────────────────────────
  const handleAddMicroTask = async (wsId: string) => {
    const text = (quickMicroTask[wsId] || '').trim();
    if (!text) return;

    const ws = workstreams.find(w => w.id === wsId);
    if (!ws) return;

    const newTask: MicroTask = {
      id: crypto.randomUUID(),
      title: text,
      completed: false,
      createdAt: new Date().toISOString()
    };

    const updatedTasks = [...(ws.microTasks || []), newTask];
    setWorkstreams(prev => prev.map(w => (w.id === wsId ? { ...w, microTasks: updatedTasks } : w)));
    setQuickMicroTask(prev => ({ ...prev, [wsId]: '' }));
    await saveWorkstreamUpdate(wsId, { microTasks: updatedTasks });
  };

  const handleToggleMicroTask = async (wsId: string, taskId: string) => {
    const ws = workstreams.find(w => w.id === wsId);
    if (!ws) return;

    const updatedTasks = (ws.microTasks || []).map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    setWorkstreams(prev => prev.map(w => (w.id === wsId ? { ...w, microTasks: updatedTasks } : w)));
    await saveWorkstreamUpdate(wsId, { microTasks: updatedTasks });
  };

  const handleDeleteMicroTask = async (wsId: string, taskId: string) => {
    const ws = workstreams.find(w => w.id === wsId);
    if (!ws) return;

    const updatedTasks = (ws.microTasks || []).filter(t => t.id !== taskId);
    setWorkstreams(prev => prev.map(w => (w.id === wsId ? { ...w, microTasks: updatedTasks } : w)));
    await saveWorkstreamUpdate(wsId, { microTasks: updatedTasks });
  };

  // ── Parking Lot ───────────────────────────────────────────────────────────
  const handleAddParkedThought = async (wsId: string) => {
    const content = (quickThought[wsId] || '').trim();
    if (!content) return;

    const ws = workstreams.find(w => w.id === wsId);
    if (!ws) return;

    const newThought: ParkedThought = {
      id: crypto.randomUUID(),
      content,
      createdAt: new Date().toISOString()
    };

    const updatedLot = [...(ws.parkingLot || []), newThought];
    setWorkstreams(prev => prev.map(w => (w.id === wsId ? { ...w, parkingLot: updatedLot } : w)));
    setQuickThought(prev => ({ ...prev, [wsId]: '' }));
    await saveWorkstreamUpdate(wsId, { parkingLot: updatedLot });
    showToast('🧠 Idea parked safely without breaking flow');
  };

  const handleConvertParkedToTask = async (wsId: string, thought: ParkedThought) => {
    const ws = workstreams.find(w => w.id === wsId);
    if (!ws) return;

    const newTask: MicroTask = {
      id: crypto.randomUUID(),
      title: thought.content,
      completed: false,
      createdAt: new Date().toISOString()
    };

    const updatedTasks = [...(ws.microTasks || []), newTask];
    const updatedLot = (ws.parkingLot || []).filter(p => p.id !== thought.id);

    setWorkstreams(prev => prev.map(w => (w.id === wsId ? { ...w, microTasks: updatedTasks, parkingLot: updatedLot } : w)));
    await saveWorkstreamUpdate(wsId, { microTasks: updatedTasks, parkingLot: updatedLot });
    showToast('Converted parked thought to micro-task');
  };

  const handleDeleteParkedThought = async (wsId: string, thoughtId: string) => {
    const ws = workstreams.find(w => w.id === wsId);
    if (!ws) return;

    const updatedLot = (ws.parkingLot || []).filter(p => p.id !== thoughtId);
    setWorkstreams(prev => prev.map(w => (w.id === wsId ? { ...w, parkingLot: updatedLot } : w)));
    await saveWorkstreamUpdate(wsId, { parkingLot: updatedLot });
  };

  // ── Context Links ─────────────────────────────────────────────────────────
  const handleAddLink = async (wsId: string) => {
    const label = (quickLinkName[wsId] || '').trim();
    const url = (quickLinkUrl[wsId] || '').trim();
    if (!label || !url) return;

    const ws = workstreams.find(w => w.id === wsId);
    if (!ws) return;

    const updatedLinks = [...(ws.filesOrLinks || []), { label, url }];
    setWorkstreams(prev => prev.map(w => (w.id === wsId ? { ...w, filesOrLinks: updatedLinks } : w)));
    setQuickLinkName(prev => ({ ...prev, [wsId]: '' }));
    setQuickLinkUrl(prev => ({ ...prev, [wsId]: '' }));
    setShowAddLink(prev => ({ ...prev, [wsId]: false }));
    await saveWorkstreamUpdate(wsId, { filesOrLinks: updatedLinks });
  };

  const handleDeleteLink = async (wsId: string, urlToDelete: string) => {
    const ws = workstreams.find(w => w.id === wsId);
    if (!ws) return;

    const updatedLinks = (ws.filesOrLinks || []).filter(l => l.url !== urlToDelete);
    setWorkstreams(prev => prev.map(w => (w.id === wsId ? { ...w, filesOrLinks: updatedLinks } : w)));
    await saveWorkstreamUpdate(wsId, { filesOrLinks: updatedLinks });
  };

  // ── Edit Workstream Modal helpers ──────────────────────────────────────────
  const openEditModal = (ws: Workstream) => {
    setEditingWorkstream(ws);
    setFormTitle(ws.title);
    setFormDescription(ws.description || '');
    setFormCategory(ws.category || 'General');
    setFormColor(ws.color || 'indigo');
    setFormCurrentTask(ws.currentTask || '');
    setFormNextAction(ws.nextAction || '');
    setFormWhereILeftOff(ws.whereILeftOff || '');
    setFormIsPrivate(ws.isPrivate !== undefined ? ws.isPrivate : true);
    setShowEditModal(true);
  };

  const handleUpdateWorkstreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkstream || !formTitle.trim()) return;

    const payload = {
      title: formTitle,
      description: formDescription,
      category: formCategory,
      color: formColor,
      currentTask: formCurrentTask,
      nextAction: formNextAction,
      whereILeftOff: formWhereILeftOff,
      isPrivate: formIsPrivate
    };

    const success = await saveWorkstreamUpdate(editingWorkstream.id, payload);
    if (success) {
      setShowEditModal(false);
      setEditingWorkstream(null);
      resetForm();
      showToast('Workstream updated successfully.');
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategory('General');
    setFormColor('indigo');
    setFormCurrentTask('');
    setFormNextAction('');
    setFormWhereILeftOff('');
    setFormIsPrivate(true);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const categories = Array.from(new Set(workstreams.map(w => w.category || 'General')));
  const activeWorkstreamsCount = workstreams.filter(w => w.state === 'ACTIVE').length;

  // Filter workstreams based on Current Sitting + Search + Category + State
  const filteredWorkstreams = workstreams.filter(ws => {
    // If a sitting is active, enforce sitting inclusion
    if (activeSitting && !activeSitting.workstreamIds.includes(ws.id)) {
      return false;
    }

    const matchesSearch =
      ws.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ws.currentTask && ws.currentTask.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ws.nextAction && ws.nextAction.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = categoryFilter === 'all' || (ws.category || 'General') === categoryFilter;
    const matchesState = stateFilter === 'all' || ws.state === stateFilter;
    return matchesSearch && matchesCat && matchesState;
  });

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-6 pb-20 font-sans w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-slate-700 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-bounce">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Alarm Triggered Modal Call Popup */}
      {triggeredAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-800 border-2 border-indigo-500 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center space-y-4 animate-bounce">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mx-auto text-indigo-400">
              <BellRing className="w-8 h-8 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Background Callback Triggered</span>
              <h3 className="text-xl font-extrabold text-white mt-1">{triggeredAlarm.workstreamTitle}</h3>
              <p className="text-xs text-slate-300 mt-2 bg-slate-900 p-3 rounded-xl border border-slate-700">
                "{triggeredAlarm.message}"
              </p>
            </div>
            <button
              onClick={() => setTriggeredAlarm(null)}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30"
            >
              Acknowledge & Dismiss Call
            </button>
          </div>
        </div>
      )}

      {/* Header & Controls Bar */}
      <header className="w-full mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 backdrop-blur-md p-5 rounded-2xl border border-slate-700/80 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Workflow className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Concurrency Manager</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                  Parallel Workstreams
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Preserve context, manage sitting sessions & switch parallel workstreams without friction.
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Current Sitting Selector */}
            <div className="flex items-center bg-slate-900/90 rounded-xl px-2 py-1 border border-slate-700/80">
              <Layers className="w-4 h-4 text-indigo-400 mr-2" />
              <select
                value={activeSitting?.id || 'all'}
                onChange={e => handleActivateSitting(e.target.value === 'all' ? null : e.target.value)}
                className="bg-transparent text-xs font-semibold text-indigo-200 focus:outline-none pr-1"
              >
                <option value="all" className="bg-slate-900 text-white">All Workstreams</option>
                {sittings.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    Sitting: {s.title} ({s.workstreamIds.length})
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  setSittingTitle('');
                  setSittingSelectedIds(activeSitting ? [...activeSitting.workstreamIds] : []);
                  setShowSittingModal(true);
                }}
                className="ml-2 px-2 py-1 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 rounded-lg text-xs font-bold"
                title="Create or edit Sitting session"
              >
                + Sitting
              </button>
            </div>

            {/* Concurrency Level Limit Selector */}
            <div className="flex items-center bg-slate-900/90 rounded-xl p-1 border border-slate-700/80">
              <span className="text-xs text-slate-400 px-2 font-medium">Slots:</span>
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  onClick={() => handleMaxActiveChange(num)}
                  className={`w-7 h-7 text-xs font-semibold rounded-lg transition-all ${
                    config.maxActiveWorkstreams === num
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title={`Limit to ${num} active parallel workstream(s)`}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Focus Shield Toggle */}
            <button
              onClick={toggleFocusMode}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                config.focusModeEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              {config.focusModeEnabled ? <Shield className="w-4 h-4 text-emerald-400" /> : <ShieldOff className="w-4 h-4 text-slate-400" />}
              <span>{config.focusModeEnabled ? 'Focus Shield ON' : 'Focus Shield'}</span>
            </button>

            {/* Session Button */}
            {activeSession ? (
              <button
                onClick={handleEndSession}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-all shadow-md"
              >
                <Activity className="w-4 h-4 text-rose-400 animate-pulse" />
                <span>End Sitting Timer ({activeSession.totalContextSwitches} switches)</span>
              </button>
            ) : (
              <button
                onClick={handleStartSession}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 transition-all shadow-md"
              >
                <Play className="w-4 h-4 text-indigo-400" />
                <span>Start Sitting Timer</span>
              </button>
            )}

            {/* Privacy Toggle */}
            <button
              onClick={toggleBoardPrivacy}
              className="p-2 rounded-xl bg-slate-900/80 text-slate-300 border border-slate-700 hover:bg-slate-800 text-xs transition-all"
            >
              {config.isBoardPrivate ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Shortcuts Help */}
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="p-2 rounded-xl bg-slate-900/80 text-slate-300 border border-slate-700 hover:bg-slate-800 text-xs transition-all"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </button>

            {/* + New Workstream */}
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Workstream</span>
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 bg-slate-800/40 px-4 py-2.5 rounded-xl border border-slate-700/40">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${activeWorkstreamsCount > 0 ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              <strong className="text-slate-200">Active Workstreams:</strong> {activeWorkstreamsCount} / {config.maxActiveWorkstreams} limit
            </span>
            {activeSitting && (
              <span className="flex items-center space-x-1.5 text-indigo-300">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Showing Sitting: <strong className="text-white">{activeSitting.title}</strong> ({filteredWorkstreams.length} tasks)</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline text-slate-500">Shortcuts: <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+1..4</kbd> Switch | <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+P</kbd> Park</span>
          </div>
        </div>
      </header>

      {/* Main Full-Width Horizontal Board */}
      <main className="w-full">
        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search workstreams..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All States</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="WAITING">Waiting</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        {filteredWorkstreams.length === 0 && !loading && (
          <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700 max-w-xl mx-auto">
            <Workflow className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">
              {activeSitting ? `No workstreams in sitting "${activeSitting.title}"` : 'No workstreams found'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
              Add workstreams to your sitting session or create a new parallel workstream.
            </p>
            <button
              onClick={() => { resetForm(); setShowCreateModal(true); }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
            >
              + Create First Workstream
            </button>
          </div>
        )}

        {/* Full-Width Horizontal Kanban Board Track */}
        <div className="flex flex-row items-stretch gap-6 overflow-x-auto pb-6 pt-2 px-1 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-900/60 [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-indigo-500/80">
          {filteredWorkstreams.map((ws, idx) => {
            const stateInfo = STATE_BADGES[ws.state] || STATE_BADGES.PAUSED;
            const isSlotShortcut = idx < 4;
            const isMainFocus = ws.state === 'ACTIVE';

            const completedMicroCount = (ws.microTasks || []).filter(m => m.completed).length;
            const totalMicroCount = (ws.microTasks || []).length;
            const microProgressPct = totalMicroCount > 0 ? Math.round((completedMicroCount / totalMicroCount) * 100) : 0;
            const inSitting = activeSitting?.workstreamIds.includes(ws.id);

            return (
              <div
                key={ws.id}
                className={`relative flex flex-col rounded-3xl bg-slate-800/90 border transition-all duration-300 shadow-2xl overflow-hidden shrink-0 ${
                  isMainFocus
                    ? 'w-[440px] md:w-[480px] border-2 border-indigo-500/90 ring-4 ring-indigo-500/20 shadow-indigo-950/60 scale-[1.01]'
                    : 'w-[350px] md:w-[380px] border-slate-700/80 hover:border-slate-600 opacity-95 hover:opacity-100'
                }`}
              >
                {/* Header Banner */}
                <div className={`p-4 flex items-center justify-between border-b border-slate-700/60 ${ws.state === 'ACTIVE' ? 'bg-gradient-to-r from-indigo-900/60 via-slate-800 to-purple-900/60' : 'bg-slate-800/60'}`}>
                  <div className="flex items-center space-x-3">
                    {isSlotShortcut && (
                      <span className="w-6 h-6 rounded-lg bg-slate-900/90 border border-slate-700 flex items-center justify-center text-[11px] font-mono font-bold text-slate-300">
                        ^{idx + 1}
                      </span>
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-base font-bold text-white tracking-tight">{ws.title}</h2>
                        {ws.isPinned && <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                        {ws.isPrivate ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Unlock className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">{ws.category || 'General'}</span>
                    </div>
                  </div>

                  {/* State Badge & Sitting Toggle */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleWorkstreamInCurrentSitting(ws.id)}
                      className={`p-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                        inSitting
                          ? 'bg-indigo-500/30 text-indigo-300 border-indigo-500/40'
                          : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                      title={inSitting ? 'In current sitting (Click to remove)' : 'Add to current sitting'}
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </button>

                    <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${stateInfo.bg} ${stateInfo.text}`}>
                      <span className={`w-2 h-2 rounded-full ${stateInfo.dotBg}`} />
                      <span>{stateInfo.label}</span>
                    </div>

                    <button
                      onClick={() => openEditModal(ws)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteWorkstream(ws.id, ws.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700/60 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-1 space-y-4">
                  {/* Context Preservation Cards */}
                  <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-700/70 space-y-2.5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center space-x-1">
                        <FileText className="w-3 h-3 text-indigo-400" />
                        <span>Current Focus Task</span>
                      </span>
                      <p className="text-xs text-slate-200 font-medium mt-0.5">
                        {ws.currentTask || <span className="text-slate-500 italic">No current task specified...</span>}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center space-x-1">
                        <CornerDownRight className="w-3 h-3 text-emerald-400" />
                        <span>Immediate Next Action</span>
                      </span>
                      <p className="text-xs text-emerald-200 font-semibold mt-0.5">
                        {ws.nextAction || <span className="text-slate-500 italic font-normal">Define next immediate step...</span>}
                      </p>
                    </div>

                    {ws.whereILeftOff && (
                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center space-x-1">
                          <Brain className="w-3 h-3 text-amber-400" />
                          <span>Where I Left Off</span>
                        </span>
                        <p className="text-xs text-slate-300 mt-0.5 whitespace-pre-wrap leading-relaxed">
                          {ws.whereILeftOff}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Micro Tasks Section with Harmonic Custom Scrollbar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Micro-Tasks ({completedMicroCount}/{totalMicroCount})</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">{microProgressPct}%</span>
                    </div>

                    <div className="w-full bg-slate-900 rounded-full h-1.5 mb-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                        style={{ width: `${microProgressPct}%` }}
                      />
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-indigo-500/80">
                      {(ws.microTasks || []).map(task => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between group p-1.5 rounded-xl hover:bg-slate-700/40 text-xs transition-all"
                        >
                          <button
                            onClick={() => handleToggleMicroTask(ws.id, task.id)}
                            className="flex items-center space-x-2 text-left text-slate-300 hover:text-white flex-1 min-w-0"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            )}
                            <span className={`truncate ${task.completed ? 'line-through text-slate-500' : ''}`}>
                              {task.title}
                            </span>
                          </button>
                          <button
                            onClick={() => handleDeleteMicroTask(ws.id, task.id)}
                            className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 p-1 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="+ Add micro-task..."
                        value={quickMicroTask[ws.id] || ''}
                        onChange={e => setQuickMicroTask(prev => ({ ...prev, [ws.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleAddMicroTask(ws.id)}
                        className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={() => handleAddMicroTask(ws.id)}
                        className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-all"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Background Alarm Callbacks */}
                  <div className="bg-slate-900/60 rounded-2xl p-3 border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-300 flex items-center space-x-1.5">
                        <BellRing className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Background Call Alarms</span>
                      </span>
                      <button
                        onClick={() => setShowAddAlarm(prev => ({ ...prev, [ws.id]: !prev[ws.id] }))}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40"
                      >
                        {showAddAlarm[ws.id] ? 'Cancel' : '+ Call Me'}
                      </button>
                    </div>

                    {showAddAlarm[ws.id] && (
                      <div className="p-2.5 bg-slate-900 border border-slate-700 rounded-xl space-y-2">
                        <div className="flex items-center space-x-1.5">
                          {[1, 2, 3, 5, 10].map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setAlarmMinutes(prev => ({ ...prev, [ws.id]: m }))}
                              className={`px-2 py-1 text-[10px] font-bold rounded ${
                                (alarmMinutes[ws.id] || 3) === m
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {m}m
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Alarm message (e.g. Check CI build)"
                          value={alarmMessage[ws.id] || ''}
                          onChange={e => setAlarmMessage(prev => ({ ...prev, [ws.id]: e.target.value }))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500"
                        />
                        <button
                          onClick={() => handleAddAlarmCallback(ws.id)}
                          className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                        >
                          Set Call Alarm ({alarmMinutes[ws.id] || 3}m)
                        </button>
                      </div>
                    )}

                    {(ws.backgroundAlarms || []).filter(a => a.active).map(alarm => (
                      <div key={alarm.id} className="flex items-center justify-between bg-indigo-950/60 p-2 rounded-xl text-xs border border-indigo-800/60 text-indigo-200">
                        <div className="flex items-center space-x-2 truncate">
                          <BellRing className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />
                          <span className="truncate">{alarm.message}</span>
                        </div>
                        <button onClick={() => handleCancelAlarm(ws.id, alarm.id)} className="text-slate-400 hover:text-rose-400 ml-2">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Parking Lot (Thoughts) */}
                  <div className="bg-slate-900/50 rounded-2xl p-3 border border-slate-700/50">
                    <span className="text-[11px] font-bold text-amber-300 flex items-center space-x-1.5 mb-2">
                      <Brain className="w-3.5 h-3.5 text-amber-400" />
                      <span>Parking Lot (Thoughts)</span>
                    </span>

                    <div className="space-y-1.5 max-h-28 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                      {(ws.parkingLot || []).map(thought => (
                        <div key={thought.id} className="flex items-center justify-between bg-slate-800/80 p-2 rounded-xl text-xs border border-slate-700/60">
                          <span className="text-slate-300 truncate flex-1 mr-2">{thought.content}</span>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleConvertParkedToTask(ws.id, thought)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40 font-bold"
                            >
                              +Task
                            </button>
                            <button
                              onClick={() => handleDeleteParkedThought(ws.id, thought.id)}
                              className="text-slate-500 hover:text-rose-400 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 flex items-center space-x-2">
                      <input
                        id={`parking-input-${ws.id}`}
                        type="text"
                        placeholder="🧠 Park idea to preserve focus... (Ctrl+P)"
                        value={quickThought[ws.id] || ''}
                        onChange={e => setQuickThought(prev => ({ ...prev, [ws.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleAddParkedThought(ws.id)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={() => handleAddParkedThought(ws.id)}
                        className="px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 rounded-xl text-xs font-semibold"
                      >
                        Park
                      </button>
                    </div>
                  </div>

                  {/* Context Links */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Context Links ({(ws.filesOrLinks || []).length})</span>
                      </span>
                      <button
                        onClick={() => setShowAddLink(prev => ({ ...prev, [ws.id]: !prev[ws.id] }))}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        {showAddLink[ws.id] ? 'Cancel' : '+ Add Link'}
                      </button>
                    </div>

                    {showAddLink[ws.id] && (
                      <div className="p-2.5 bg-slate-900 border border-slate-700 rounded-xl space-y-2">
                        <input
                          type="text"
                          placeholder="Link Title (e.g. Jira PR)"
                          value={quickLinkName[ws.id] || ''}
                          onChange={e => setQuickLinkName(prev => ({ ...prev, [ws.id]: e.target.value }))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500"
                        />
                        <input
                          type="url"
                          placeholder="URL (https://...)"
                          value={quickLinkUrl[ws.id] || ''}
                          onChange={e => setQuickLinkUrl(prev => ({ ...prev, [ws.id]: e.target.value }))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500"
                        />
                        <button
                          onClick={() => handleAddLink(ws.id)}
                          className="w-full py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                        >
                          Save Link
                        </button>
                      </div>
                    )}

                    {(ws.filesOrLinks || []).length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {ws.filesOrLinks!.map((link, lIdx) => (
                          <div key={lIdx} className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700 text-xs text-indigo-300 hover:border-indigo-500/50">
                            <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center space-x-1 truncate max-w-[120px] hover:underline">
                              <ExternalLink className="w-3 h-3 text-indigo-400" />
                              <span className="truncate">{link.label}</span>
                            </a>
                            <button onClick={() => handleDeleteLink(ws.id, link.url)} className="text-slate-500 hover:text-rose-400 ml-1">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls & Time Log Details Trigger */}
                <div className="p-4 bg-slate-900/90 border-t border-slate-700/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setShowTimeLogsModal(ws)}
                    className="flex items-center space-x-1.5 text-xs text-indigo-300 hover:text-indigo-200 bg-indigo-950/60 border border-indigo-800/60 px-2.5 py-1 rounded-xl transition-all"
                    title="View detailed task time logs"
                  >
                    <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{formatSeconds(ws.totalActiveSeconds || 0)}</span>
                  </button>

                  <div className="flex items-center space-x-1.5">
                    {ws.state !== 'ACTIVE' ? (
                      <button
                        onClick={() => handleSetState(ws, 'ACTIVE')}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-950/40 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Resume Focus</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSetState(ws, 'PAUSED')}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md transition-all"
                      >
                        <Pause className="w-3.5 h-3.5 fill-white" />
                        <span>Pause Work</span>
                      </button>
                    )}

                    <select
                      value={ws.state}
                      onChange={e => handleSetState(ws, e.target.value as WorkstreamState)}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-1 text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PAUSED">PAUSED</option>
                      <option value="WAITING">WAITING</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ── Modal: Sitting Management (Current Sitting) ───────────────────── */}
      {showSittingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <span>Create / Select Sitting Session</span>
              </h3>
              <button
                onClick={() => setShowSittingModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSittingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Sitting Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Sprint Sitting"
                  value={sittingTitle}
                  onChange={e => setSittingTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Select Workstreams for this Sitting:</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {workstreams.map(ws => {
                    const isChecked = sittingSelectedIds.includes(ws.id);
                    return (
                      <label key={ws.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 cursor-pointer hover:bg-slate-800/80">
                        <span className="font-semibold">{ws.title} <span className="text-slate-500 text-[10px]">({ws.category})</span></span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) setSittingSelectedIds(prev => [...prev, ws.id]);
                            else setSittingSelectedIds(prev => prev.filter(id => id !== ws.id));
                          }}
                          className="rounded bg-slate-800 border-slate-600 text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSittingModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg"
                >
                  Start Sitting Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Detailed Time Logs Viewer ──────────────────────────────── */}
      {showTimeLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Detailed Time Log History</span>
                <h3 className="text-base font-bold text-white">{showTimeLogsModal.title}</h3>
              </div>
              <button
                onClick={() => setShowTimeLogsModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900 p-3 rounded-2xl border border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Active Recorded Duration:</span>
              <span className="text-emerald-400 font-extrabold text-sm">{formatSeconds(showTimeLogsModal.totalActiveSeconds || 0)}</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(!showTimeLogsModal.timeLogs || showTimeLogsModal.timeLogs.length === 0) ? (
                <div className="text-center py-6 text-xs text-slate-500">No time logs recorded yet for this workstream.</div>
              ) : (
                showTimeLogsModal.timeLogs.map((log, lIdx) => (
                  <div key={lIdx} className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between items-center text-slate-200">
                      <span className="font-bold text-white">{log.taskName || 'Focus Task'}</span>
                      <span className="font-mono text-indigo-300 font-bold">{formatSeconds(log.durationSeconds)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>Start: {new Date(log.startTime).toLocaleTimeString()}</span>
                      <span>{log.endTime ? `End: ${new Date(log.endTime).toLocaleTimeString()}` : 'Currently Active'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowTimeLogsModal(null)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
            >
              Close Time Logs
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Context Resume Snapshot ────────────────────────────────── */}
      {resumingWorkstream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-800 border border-indigo-500/50 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-left relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Workflow className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Context Resume Banner</span>
                  <h3 className="text-lg font-bold text-white">{resumingWorkstream.workstream.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setResumingWorkstream(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resumingWorkstream.previous && (
              <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60 flex items-center space-x-2">
                <span className="text-amber-400 font-bold">Pausing:</span>
                <span>{resumingWorkstream.previous.title}</span>
              </div>
            )}

            <div className="space-y-3 bg-slate-900/80 p-4 rounded-xl border border-slate-700">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Current Focus Task</span>
                <p className="text-xs text-white font-semibold mt-0.5">
                  {resumingWorkstream.workstream.currentTask || 'No main task specified.'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">⚡ Immediate Next Action</span>
                <p className="text-xs text-emerald-300 font-bold mt-0.5">
                  {resumingWorkstream.workstream.nextAction || 'Ready to start focus.'}
                </p>
              </div>

              {resumingWorkstream.workstream.whereILeftOff && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">📌 Where You Left Off</span>
                  <p className="text-xs text-slate-300 mt-0.5 whitespace-pre-wrap">
                    {resumingWorkstream.workstream.whereILeftOff}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Context Switch Trigger / Reason (Optional):</label>
              <input
                type="text"
                placeholder="e.g. Waiting on PR review, urgent priority..."
                value={switchReasonInput}
                onChange={e => setSwitchReasonInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setResumingWorkstream(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmSwitchWorkstream}
                className="flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40"
              >
                <span>Acknowledge & Start Focus</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create / Edit Workstream ───────────────────────────────── */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="text-base font-bold text-white">
                {showCreateModal ? 'Create New Workstream' : 'Edit Workstream'}
              </h3>
              <button
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={showCreateModal ? handleCreateWorkstream : handleUpdateWorkstreamSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Workstream Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Backend API Refactor"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Coding, DevOps, Research"
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Theme Color</label>
                  <select
                    value={formColor}
                    onChange={e => setFormColor(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="indigo">Indigo</option>
                    <option value="emerald">Emerald</option>
                    <option value="amber">Amber</option>
                    <option value="rose">Rose</option>
                    <option value="purple">Purple</option>
                    <option value="cyan">Cyan</option>
                    <option value="slate">Slate</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Current Focus Task</label>
                <input
                  type="text"
                  placeholder="What are you currently trying to accomplish?"
                  value={formCurrentTask}
                  onChange={e => setFormCurrentTask(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-400 mb-1">⚡ Immediate Next Action</label>
                <input
                  type="text"
                  placeholder="Single immediate action to resume without friction..."
                  value={formNextAction}
                  onChange={e => setFormNextAction(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-emerald-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-400 mb-1">📌 Where You Left Off (Context Notes)</label>
                <textarea
                  rows={3}
                  placeholder="Notes, branch name, terminal commands, context snapshot..."
                  value={formWhereILeftOff}
                  onChange={e => setFormWhereILeftOff(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPrivate}
                    onChange={e => setFormIsPrivate(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Private Workstream (Login required)</span>
                </label>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg"
                  >
                    {showCreateModal ? 'Create Workstream' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Keyboard Shortcuts Cheat Sheet ─────────────────────────── */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                <span>Keyboard Shortcuts</span>
              </h3>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-700">
                <span className="text-slate-300">Switch to Workstream Slot 1..4</span>
                <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600 font-mono text-indigo-300">Ctrl + 1..4</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-700">
                <span className="text-slate-300">Park Idea on Active Workstream</span>
                <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600 font-mono text-amber-300">Ctrl + P</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-700">
                <span className="text-slate-300">Toggle Focus Shield Mode</span>
                <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600 font-mono text-emerald-300">Ctrl + Space</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-700">
                <span className="text-slate-300">Toggle Shortcuts Dialog</span>
                <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600 font-mono text-slate-300">?</kbd>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Session Analytics Summary ──────────────────────────────── */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                <span>Sitting Session Summary & Behavioral Telemetry</span>
              </h3>
              <button
                onClick={() => setShowSessionModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {recentSessions.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total Context Switches</span>
                    <p className="text-xl font-bold text-indigo-400 mt-1">{recentSessions[0].totalContextSwitches}</p>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Attention Health Score</span>
                    <p className="text-xl font-bold text-emerald-400 mt-1">{recentSessions[0].attentionHealthScore || 100}%</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-2">Switch History Log</h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {(recentSessions[0].switchesHistory || []).map((sw, idx) => (
                      <div key={idx} className="bg-slate-900 p-2 rounded-lg text-xs flex justify-between items-center text-slate-300">
                        <span>Reason: <strong className="text-white">{sw.reason || 'Manual Switch'}</strong></span>
                        <span className="text-[10px] text-slate-500">{new Date(sw.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowSessionModal(false)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
            >
              Close Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
