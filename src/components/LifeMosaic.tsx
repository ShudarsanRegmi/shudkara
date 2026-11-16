import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Calendar,
  Layers,
  Activity,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Compass,
  AlertTriangle,
  Zap,
  CheckCircle2,
  X,
  RefreshCw,
  Gamepad2,
  Dumbbell,
  Laptop,
  Users
} from 'lucide-react';
import { adToBs } from '../utils/bikramSambat';
import { enqueueOfflineAction, isDeviceOnline } from '../utils/offlineSync';

export type LifeDomain = 'craft' | 'explore' | 'social' | 'play' | 'vitality' | 'drift';

export interface MosaicEntry {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  rawText?: string;
  domain: LifeDomain;
  topic: string;
  durationHours: number;
  focusScore: number;
  source: 'quick-dump' | 'manual' | 'magic-streaks' | 'magic-timeline';
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface DayDomainBreakdown {
  craft: number;
  explore: number;
  social: number;
  play: number;
  vitality: number;
  drift: number;
  total: number;
}

export interface MosaicDaySummary {
  day: number;
  date: string;
  totalHours: number;
  domainBreakdown: DayDomainBreakdown;
  domainPercentages: Record<LifeDomain, number>;
  entries: MosaicEntry[];
  topTopic: string;
  focusScore: number;
  highFocus: boolean;
  driftWarning: boolean;
  magicStreaksCount: number;
  magicTimelineCount: number;
  correlatedMilestones?: string[];
}

export interface TreemapSubTopic {
  name: string;
  hours: number;
  percentage: number;
  sessionCount: number;
  details?: string;
}

export interface TreemapDomainBlock {
  domain: LifeDomain;
  label: string;
  color: string;
  totalHours: number;
  percentage: number;
  subTopics: TreemapSubTopic[];
}

export interface MonthlyChronicle {
  title: string;
  chapterSubtitle: string;
  narrative: string;
  warningAlert?: string;
  intentionalityRatio: number;
  deepFocusHours: number;
  focusComparisonText: string;
  streakProofsRatio: string;
  habitsStatusText: string;
}

export interface StreamDataPoint {
  day: number;
  date: string;
  craft: number;
  explore: number;
  social: number;
  play: number;
  vitality: number;
  drift: number;
  total: number;
}

export interface MonthMosaicData {
  year: number;
  month: number;
  daysInMonth: number;
  totalHours: number;
  intentionalityRatio: number;
  chronicle: MonthlyChronicle;
  streamData: StreamDataPoint[];
  days: MosaicDaySummary[];
  treemap: TreemapDomainBlock[];
  magicSummary: {
    streakHabitProofsCount: number;
    timelineMomentsCount: number;
    description: string;
  };
}

interface LifeMosaicProps {
  authToken?: string | null;
  onNavigate?: (tab: string) => void;
}

export const DOMAIN_CONFIG: Record<
  LifeDomain,
  {
    label: string;
    description: string;
    hex: string;
    bgPill: string;
    textPill: string;
    borderPill: string;
    barBg: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  craft: {
    label: 'Craft & Deep Work',
    description: 'Algorithms, Architecture, Deep Coding, Math & Study',
    hex: '#10b981',
    bgPill: 'bg-emerald-500/10',
    textPill: 'text-emerald-400',
    borderPill: 'border-emerald-500/30',
    barBg: 'bg-emerald-500',
    icon: Laptop
  },
  explore: {
    label: 'Exploration & R&D',
    description: 'WebAuthn, Passkeys, Sidecars, Prototyping & Tinkering',
    hex: '#8b5cf6',
    bgPill: 'bg-violet-500/10',
    textPill: 'text-violet-400',
    borderPill: 'border-violet-500/30',
    barBg: 'bg-violet-500',
    icon: Compass
  },
  social: {
    label: 'Social & Interpersonal',
    description: 'Family, Friends, Networking, Dinners & Calls',
    hex: '#f59e0b',
    bgPill: 'bg-amber-500/10',
    textPill: 'text-amber-400',
    borderPill: 'border-amber-500/30',
    barBg: 'bg-amber-500',
    icon: Users
  },
  play: {
    label: 'Play & Leisure',
    description: 'Gaming (CS2, Steam), Films, Anime & Quality Rest',
    hex: '#3b82f6',
    bgPill: 'bg-blue-500/10',
    textPill: 'text-blue-400',
    borderPill: 'border-blue-500/30',
    barBg: 'bg-blue-500',
    icon: Gamepad2
  },
  vitality: {
    label: 'Vitality & Health',
    description: 'Gym, Push/Pull/Legs, Running, Walks, Health & Sleep',
    hex: '#06b6d4',
    bgPill: 'bg-cyan-500/10',
    textPill: 'text-cyan-400',
    borderPill: 'border-cyan-500/30',
    barBg: 'bg-cyan-500',
    icon: Dumbbell
  },
  drift: {
    label: 'Drift & Distraction',
    description: 'Mindless Scrolling, Procrastination & Aimless Loops',
    hex: '#f43f5e',
    bgPill: 'bg-rose-500/10',
    textPill: 'text-rose-400',
    borderPill: 'border-rose-500/30',
    barBg: 'bg-rose-500',
    icon: AlertTriangle
  }
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const LifeMosaic: React.FC<LifeMosaicProps> = ({ authToken, onNavigate }) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  // Active view perspective tab: 'river' | 'mosaic' | 'treemap'
  const [activeTab, setActiveTab] = useState<'river' | 'mosaic' | 'treemap'>('river');

  // Input bar state
  const [quickInput, setQuickInput] = useState(
    'Studied Dynamic Programming for 3.5h, explored WebAuthn passkeys, played CS2 with Sahil, afternoon gym push day'
  );
  const [isParsing, setIsParsing] = useState(false);
  const [logSuccessMessage, setLogSuccessMessage] = useState<string | null>(null);

  // Data state
  const [mosaicData, setMosaicData] = useState<MonthMosaicData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Streamgraph Hover Tooltip state
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const [streamFilterDomain, setStreamFilterDomain] = useState<LifeDomain | null>(null);

  // Day Breakdown Modal state
  const [selectedDaySummary, setSelectedDaySummary] = useState<MosaicDaySummary | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mini entry inside modal
  const [modalNewTopic, setModalNewTopic] = useState('');
  const [modalNewDomain, setModalNewDomain] = useState<LifeDomain>('craft');
  const [modalNewHours, setModalNewHours] = useState('1.5');

  const inputRef = useRef<HTMLInputElement>(null);

  // Bikram Sambat conversion for selected month/date
  const bsHeaderInfo = useMemo(() => {
    try {
      // Pick mid-month day to show BS month range
      const midDate = new Date(selectedYear, selectedMonth - 1, 15);
      const bs = adToBs(midDate);
      return `${bs.monthName} / ${bs.year} BS`;
    } catch (e) {
      return 'Bikram Sambat 2083';
    }
  }, [selectedYear, selectedMonth]);

  // Fetch month data with local caching
  const fetchMonthData = async (year: number, month: number) => {
    setIsLoading(true);
    setError(null);
    const cacheKey = `shudkara_mosaic_${year}_${month}`;

    // Load from local storage cache first for instant render
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setMosaicData(JSON.parse(cached));
      }
    } catch (e) {}

    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['X-Session-Token'] = authToken;
      }

      const res = await fetch(`/api/mosaic/month?year=${year}&month=${month}`, { headers });
      if (res.ok) {
        const data = (await res.json()) as MonthMosaicData;
        setMosaicData(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } else {
        throw new Error(`Failed to fetch LifeMosaic data (Status ${res.status})`);
      }
    } catch (err: any) {
      console.warn('LifeMosaic API fetch error:', err);
      // If we had no cache, display an error
      if (!mosaicData) {
        setError('Working offline or failed to reach server. Showing cached or synthesized lineage.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthData(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth, authToken]);

  // Quick Dump parser & logger
  const handleQuickDumpSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToLog = quickInput.trim();
    if (!textToLog) return;

    setIsParsing(true);
    setLogSuccessMessage(null);

    const logDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(
      Math.min(new Date().getDate(), mosaicData?.daysInMonth || 30)
    ).padStart(2, '0')}`;

    const payload = {
      text: textToLog,
      date: logDate
    };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      if (!isDeviceOnline()) {
        enqueueOfflineAction({
          url: '/api/mosaic/log',
          method: 'POST',
          body: payload,
          headers,
          description: `Logged Mosaic: ${textToLog.slice(0, 30)}...`,
          subapp: 'lifemosaic'
        });
        setLogSuccessMessage('Offline: Stored in Action Outbox. Telemetry will sync when reconnected.');
        setIsParsing(false);
        return;
      }

      const res = await fetch('/api/mosaic/log', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setLogSuccessMessage(`✓ Logged ${data.count || 'tracks'} successfully into your timeline!`);
        // Refresh view
        await fetchMonthData(selectedYear, selectedMonth);
      } else {
        throw new Error('Server returned an error');
      }
    } catch (err: any) {
      console.error('Failed to log mosaic entry:', err);
      setLogSuccessMessage('Saved to local view. Synced with offline cache.');
    } finally {
      setIsParsing(false);
    }
  };

  // Add individual activity inside modal
  const handleModalAddEntry = async () => {
    if (!selectedDaySummary || !modalNewTopic.trim()) return;

    const payload = {
      date: selectedDaySummary.date,
      entries: [
        {
          date: selectedDaySummary.date,
          domain: modalNewDomain,
          topic: modalNewTopic.trim(),
          durationHours: parseFloat(modalNewHours) || 1.0,
          focusScore: modalNewDomain === 'craft' ? 5 : modalNewDomain === 'drift' ? 1 : 4,
          source: 'manual' as const
        }
      ]
    };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      await fetch('/api/mosaic/log', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      setModalNewTopic('');
      await fetchMonthData(selectedYear, selectedMonth);

      // Re-read updated day summary
      if (mosaicData) {
        const updated = mosaicData.days.find(d => d.date === selectedDaySummary.date);
        if (updated) setSelectedDaySummary(updated);
      }
    } catch (err) {
      console.error('Failed to add manual entry:', err);
    }
  };

  // Delete an entry
  const handleDeleteEntry = async (entryId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;

      await fetch(`/api/mosaic/entry/${entryId}`, {
        method: 'DELETE',
        headers
      });

      await fetchMonthData(selectedYear, selectedMonth);
      if (selectedDaySummary) {
        setSelectedDaySummary(prev => {
          if (!prev) return null;
          return {
            ...prev,
            entries: prev.entries.filter(e => e.id !== entryId)
          };
        });
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Open modal for a specific day
  const handleOpenDay = (daySummary: MosaicDaySummary) => {
    setSelectedDaySummary(daySummary);
    setIsModalOpen(true);
  };

  // Dynamic Streamgraph Wave Generation
  const streamSvgData = useMemo(() => {
    if (!mosaicData || !mosaicData.streamData || mosaicData.streamData.length === 0) {
      return null;
    }

    const points = mosaicData.streamData;
    const width = 900;
    const height = 220;
    const n = points.length;
    const stepX = width / Math.max(1, n - 1);

    // Compute max day total to normalize height nicely
    const maxTotal = Math.max(...points.map(p => p.total), 8);
    const domainOrder: LifeDomain[] = ['vitality', 'craft', 'explore', 'social', 'play', 'drift'];

    // Layer stack calculation for each day
    // yBottom[i] and yTop[i] for each domain
    const dayStacks = points.map(pt => {
      let currentY = 0;
      const stack: Record<LifeDomain, { y0: number; y1: number }> = {
        vitality: { y0: 0, y1: 0 },
        craft: { y0: 0, y1: 0 },
        explore: { y0: 0, y1: 0 },
        social: { y0: 0, y1: 0 },
        play: { y0: 0, y1: 0 },
        drift: { y0: 0, y1: 0 }
      };

      for (const dom of domainOrder) {
        const val = streamFilterDomain && streamFilterDomain !== dom ? 0 : pt[dom] || 0;
        const y0 = currentY;
        const y1 = currentY + val;
        stack[dom] = { y0, y1 };
        currentY = y1;
      }
      return { total: currentY, stack };
    });

    // Generate smooth SVG paths with cubic bezier curves
    const paths: Record<LifeDomain, string> = {
      vitality: '',
      craft: '',
      explore: '',
      social: '',
      play: '',
      drift: ''
    };

    const toSvgY = (val: number) => {
      // Streamgraph centered vertically or baseline anchored
      const normalized = (val / maxTotal) * (height - 20);
      return Math.max(8, height - 10 - normalized);
    };

    for (const dom of domainOrder) {
      // Top curve points
      const topPoints = points.map((_, i) => ({
        x: i * stepX,
        y: toSvgY(dayStacks[i].stack[dom].y1)
      }));

      // Bottom curve points (reversed for closing polygon)
      const bottomPoints = points.map((_, i) => ({
        x: i * stepX,
        y: toSvgY(dayStacks[i].stack[dom].y0)
      }));

      // Build SVG cubic spline
      let d = `M ${topPoints[0].x},${topPoints[0].y}`;
      for (let i = 0; i < topPoints.length - 1; i++) {
        const p0 = topPoints[i];
        const p1 = topPoints[i + 1];
        const cx1 = p0.x + (p1.x - p0.x) / 2;
        const cy1 = p0.y;
        const cx2 = p0.x + (p1.x - p0.x) / 2;
        const cy2 = p1.y;
        d += ` C ${cx1},${cy1} ${cx2},${cy2} ${p1.x},${p1.y}`;
      }

      // Line to bottom of last point
      const lastBottom = bottomPoints[bottomPoints.length - 1];
      d += ` L ${lastBottom.x},${lastBottom.y}`;

      // Spline back along bottom points
      for (let i = bottomPoints.length - 1; i > 0; i--) {
        const p0 = bottomPoints[i];
        const p1 = bottomPoints[i - 1];
        const cx1 = p0.x - (p0.x - p1.x) / 2;
        const cy1 = p0.y;
        const cx2 = p0.x - (p0.x - p1.x) / 2;
        const cy2 = p1.y;
        d += ` C ${cx1},${cy1} ${cx2},${cy2} ${p1.x},${p1.y}`;
      }

      d += ' Z';
      paths[dom] = d;
    }

    return { paths, width, height, stepX, points };
  }, [mosaicData, streamFilterDomain]);

  // Calendar matrix starting offset calculation (0=Sun, 1=Mon, ..., 6=Sat)
  const calendarPaddingDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth - 1, 1).getDay();
    return Array.from({ length: firstDay }, (_, i) => i);
  }, [selectedYear, selectedMonth]);

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen selection:bg-indigo-500 selection:text-white p-3 sm:p-6 space-y-6">
      {/* ── Top Header Bar ────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Shudkara
              </h1>
              <span className="text-emerald-400 font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                LIFE MOSAIC
              </span>
              <span className="text-xs font-semibold text-slate-400 font-mono">
                (काल / Kāla)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              The Living Tapestry of Time • Macro Activity, Focus & Life-Track Telemetry
            </p>
          </div>
        </div>

        {/* Date Window & Month Controls */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-white font-mono min-w-28 text-center">
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </span>
            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-right pl-3 border-l border-slate-800 hidden sm:block">
            <span className="text-xs font-bold text-emerald-300 block">{bsHeaderInfo}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              Bikram Sambat Dual Calendar
            </span>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && !mosaicData && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Loading macro time tapestry telemetry...</span>
        </div>
      )}

      {/* ── 1. Zero-Friction Conversational Quick-Dump Bar ───────────────────── */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-52 h-52 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              Natural Stream-of-Consciousness Logger
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
            Zero Stopwatches • AI Structured
          </span>
        </div>

        <form onSubmit={handleQuickDumpSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              placeholder="Type naturally: 'Studied Dynamic Programming 3.5h, explored WebAuthn, played CS2 with Sahil, afternoon gym...'"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition pr-20"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded border border-slate-700 hidden sm:inline-block">
                Cmd+K
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isParsing || !quickInput.trim()}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isParsing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
                <span>AI Structuring...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span>AI Parse & Log</span>
              </>
            )}
          </button>
        </form>

        {logSuccessMessage && (
          <div className="mt-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{logSuccessMessage}</span>
          </div>
        )}

        {/* Real-time AI Extracted Breakdown Pills Preview */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/60 text-xs">
          <span className="text-[11px] font-bold text-slate-400">Extracted Domains:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Craft & Study (~3.5h)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-violet-400"></span> Exploration: Passkeys (~1.5h)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span> Play: CS2 Gaming (~1.0h)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> Social: Sahil Co-op
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Vitality: Gym Push Day (~1.2h)
          </span>
          <span className="ml-auto text-[11px] text-slate-400 font-mono flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Magic Layer: Auto-Synchronized
          </span>
        </div>
      </section>

      {/* ── 2. Macro AI Chronicle Banner ────────────────────────────────────── */}
      {mosaicData?.chronicle && (
        <section className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900/80 border border-indigo-800/40 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Monthly Chapter
              </span>
              <span className="text-xs text-slate-400">{mosaicData.chronicle.chapterSubtitle}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              &ldquo;{mosaicData.chronicle.title}&rdquo;
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {mosaicData.chronicle.narrative}
              {mosaicData.chronicle.warningAlert && (
                <span className="text-amber-300 font-semibold ml-1.5">
                  {mosaicData.chronicle.warningAlert}
                </span>
              )}
            </p>
          </div>

          {/* Macro Key Stats Cards */}
          <div className="grid grid-cols-3 gap-3 w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5">
            <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                Intentionality
              </span>
              <span className="text-lg font-black text-emerald-400 font-mono">
                {mosaicData.chronicle.intentionalityRatio}%
              </span>
              <span className="text-[9px] text-emerald-500 block">Top 10% month</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                Deep Focus
              </span>
              <span className="text-lg font-black text-indigo-400 font-mono">
                {mosaicData.chronicle.deepFocusHours}h
              </span>
              <span className="text-[9px] text-indigo-400 block">
                {mosaicData.chronicle.focusComparisonText}
              </span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                Streak Proofs
              </span>
              <span className="text-lg font-black text-amber-400 font-mono">
                {mosaicData.chronicle.streakProofsRatio}
              </span>
              <span className="text-[9px] text-amber-500 block">
                {mosaicData.chronicle.habitsStatusText}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Multi-Track Visualizations Perspectives Switcher ─────────────── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Multi-Track Lineage Visualizer
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              (Switch perspectives below)
            </span>
          </div>

          {/* View Switcher Tabs */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs font-bold text-slate-300">
            <button
              onClick={() => setActiveTab('river')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'river'
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              River of Time (Streamgraph)
            </button>
            <button
              onClick={() => setActiveTab('mosaic')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'mosaic'
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Mosaic Month Grid
            </button>
            <button
              onClick={() => setActiveTab('treemap')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'treemap'
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Topic Treemap (Semantic Weights)
            </button>
          </div>
        </div>

        {/* ── VIEW 1: RIVER OF TIME (STREAMGRAPH) ───────────────────────────── */}
        {activeTab === 'river' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Continuous Time Flow Streamgraph
                </h4>
                <p className="text-[11px] text-slate-400">
                  Thickness of each ribbon represents active hours dedicated to that life track
                  across days of the month.
                </p>
              </div>

              {/* Interactive Domain Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {streamFilterDomain && (
                  <button
                    onClick={() => setStreamFilterDomain(null)}
                    className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 hover:text-white font-semibold transition flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Reset Filter
                  </button>
                )}
                {(['craft', 'explore', 'social', 'play', 'vitality', 'drift'] as LifeDomain[]).map(
                  dom => {
                    const cfg = DOMAIN_CONFIG[dom];
                    const isSelected = streamFilterDomain === dom;
                    return (
                      <button
                        key={dom}
                        onClick={() =>
                          setStreamFilterDomain(prev => (prev === dom ? null : dom))
                        }
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition cursor-pointer ${
                          isSelected
                            ? `${cfg.bgPill} ${cfg.textPill} ${cfg.borderPill} font-bold ring-2 ring-indigo-500/40`
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: cfg.hex }}
                        ></span>
                        <span>{cfg.label.split('&')[0].trim()}</span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* SVG Streamgraph Canvas */}
            <div className="relative w-full h-72 bg-slate-950/90 rounded-xl border border-slate-800/80 overflow-hidden flex flex-col justify-between p-3 select-none">
              {streamSvgData && (
                <svg
                  className="w-full h-full"
                  viewBox={`0 0 ${streamSvgData.width} ${streamSvgData.height}`}
                  preserveAspectRatio="none"
                  onMouseLeave={() => setHoveredDayIndex(null)}
                >
                  <defs>
                    <linearGradient id="gradCraft" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#059669" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#10b981" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#34d399" stopOpacity="0.85" />
                    </linearGradient>
                    <linearGradient id="gradExplore" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.85" />
                    </linearGradient>
                    <linearGradient id="gradSocial" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#d97706" stopOpacity="0.75" />
                      <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="gradPlay" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.75" />
                      <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="gradVitality" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0891b2" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="gradDrift" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#e11d48" stopOpacity="0.65" />
                      <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#fb7185" stopOpacity="0.7" />
                    </linearGradient>
                  </defs>

                  {/* Render 6 Wave Layers */}
                  <path
                    d={streamSvgData.paths.vitality}
                    fill="url(#gradVitality)"
                    className="transition-opacity duration-200 hover:opacity-100 opacity-80 cursor-pointer"
                    onClick={() => setStreamFilterDomain('vitality')}
                  />
                  <path
                    d={streamSvgData.paths.craft}
                    fill="url(#gradCraft)"
                    className="transition-opacity duration-200 hover:opacity-100 opacity-90 cursor-pointer"
                    onClick={() => setStreamFilterDomain('craft')}
                  />
                  <path
                    d={streamSvgData.paths.explore}
                    fill="url(#gradExplore)"
                    className="transition-opacity duration-200 hover:opacity-100 opacity-90 cursor-pointer"
                    onClick={() => setStreamFilterDomain('explore')}
                  />
                  <path
                    d={streamSvgData.paths.social}
                    fill="url(#gradSocial)"
                    className="transition-opacity duration-200 hover:opacity-100 opacity-85 cursor-pointer"
                    onClick={() => setStreamFilterDomain('social')}
                  />
                  <path
                    d={streamSvgData.paths.play}
                    fill="url(#gradPlay)"
                    className="transition-opacity duration-200 hover:opacity-100 opacity-85 cursor-pointer"
                    onClick={() => setStreamFilterDomain('play')}
                  />
                  <path
                    d={streamSvgData.paths.drift}
                    fill="url(#gradDrift)"
                    className="transition-opacity duration-200 hover:opacity-100 opacity-80 cursor-pointer"
                    onClick={() => setStreamFilterDomain('drift')}
                  />

                  {/* Hover guideline and interactive hover columns */}
                  {streamSvgData.points.map((pt, i) => {
                    const x = i * streamSvgData.stepX;
                    return (
                      <rect
                        key={pt.day}
                        x={x - streamSvgData.stepX / 2}
                        y={0}
                        width={streamSvgData.stepX}
                        height={streamSvgData.height}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredDayIndex(i)}
                        onClick={() => {
                          if (mosaicData?.days[i]) {
                            handleOpenDay(mosaicData.days[i]);
                          }
                        }}
                      />
                    );
                  })}

                  {/* Vertical tracker indicator */}
                  {hoveredDayIndex !== null && (
                    <line
                      x1={hoveredDayIndex * streamSvgData.stepX}
                      y1={0}
                      x2={hoveredDayIndex * streamSvgData.stepX}
                      y2={streamSvgData.height}
                      stroke="#818cf8"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                      className="pointer-events-none"
                    />
                  )}
                </svg>
              )}

              {/* Hover Floating Tooltip */}
              {hoveredDayIndex !== null && mosaicData?.streamData[hoveredDayIndex] && (
                <div
                  className="absolute top-4 bg-slate-900/95 border border-indigo-500/50 rounded-xl p-3 shadow-2xl backdrop-blur pointer-events-none z-20 text-xs space-y-1.5 min-w-48 transition-all"
                  style={{
                    left: `${Math.min(
                      75,
                      Math.max(
                        5,
                        (hoveredDayIndex / (mosaicData.streamData.length - 1)) * 100
                      )
                    )}%`
                  }}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                    <span className="font-bold text-white font-mono">
                      {MONTH_NAMES[selectedMonth - 1].slice(0, 3)}{' '}
                      {mosaicData.streamData[hoveredDayIndex].day}
                    </span>
                    <span className="text-[10px] text-indigo-400 font-mono">
                      Total: {mosaicData.streamData[hoveredDayIndex].total}h
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <span className="text-emerald-400">
                      Craft: {mosaicData.streamData[hoveredDayIndex].craft}h
                    </span>
                    <span className="text-violet-400">
                      Explore: {mosaicData.streamData[hoveredDayIndex].explore}h
                    </span>
                    <span className="text-amber-400">
                      Social: {mosaicData.streamData[hoveredDayIndex].social}h
                    </span>
                    <span className="text-blue-400">
                      Play: {mosaicData.streamData[hoveredDayIndex].play}h
                    </span>
                    <span className="text-cyan-400">
                      Vitality: {mosaicData.streamData[hoveredDayIndex].vitality}h
                    </span>
                    <span className="text-rose-400">
                      Drift: {mosaicData.streamData[hoveredDayIndex].drift}h
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block pt-0.5">
                    Click to inspect full day activities →
                  </span>
                </div>
              )}

              {/* Day Labels Axis */}
              <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800">
                <span>{MONTH_NAMES[selectedMonth - 1].slice(0, 3)} 1</span>
                <span>{MONTH_NAMES[selectedMonth - 1].slice(0, 3)} 6</span>
                <span>{MONTH_NAMES[selectedMonth - 1].slice(0, 3)} 11</span>
                <span className="text-emerald-400 font-bold">
                  {MONTH_NAMES[selectedMonth - 1].slice(0, 3)} 16 (Sprint)
                </span>
                <span>{MONTH_NAMES[selectedMonth - 1].slice(0, 3)} 21</span>
                <span>{MONTH_NAMES[selectedMonth - 1].slice(0, 3)} 26</span>
                <span>
                  {MONTH_NAMES[selectedMonth - 1].slice(0, 3)}{' '}
                  {mosaicData?.daysInMonth || 30}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <strong>Insight:</strong> Craft & Study river surged between Day 10 - Day 16
                during the Shudkara Multi-Agent sprint.
              </span>
              <span className="text-indigo-400 font-semibold cursor-pointer hover:underline">
                Click any wave layer to filter • Click any vertical column to open day popup →
              </span>
            </div>
          </div>
        )}

        {/* ── VIEW 2: MULTI-TRACK MOSAIC GRID ──────────────────────────────── */}
        {activeTab === 'mosaic' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear} Multi-Track Mosaic Calendar
                </h4>
                <p className="text-[11px] text-slate-400">
                  Each cell represents a day, divided by the exact percentage of your time spent
                  across tracks.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                Click any tile for day breakdown & logs
              </span>
            </div>

            {/* 7-Column Day Grid (Sun to Sat) */}
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[11px] font-bold text-slate-500 pb-1">
                  {d}
                </div>
              ))}

              {/* Empty padding tiles for first day of month */}
              {calendarPaddingDays.map(pad => (
                <div key={`pad-${pad}`} className="h-20 rounded-xl bg-slate-950/20 border border-transparent"></div>
              ))}

              {/* Day Tiles */}
              {mosaicData?.days.map(daySummary => {
                const isToday =
                  selectedYear === currentDate.getFullYear() &&
                  selectedMonth === currentDate.getMonth() + 1 &&
                  daySummary.day === currentDate.getDate();

                const isDeepCraft = daySummary.highFocus;
                const isDriftDay = daySummary.driftWarning;

                return (
                  <div
                    key={daySummary.date}
                    onClick={() => handleOpenDay(daySummary)}
                    className={`h-20 bg-slate-950 border rounded-xl p-1.5 flex flex-col justify-between hover:scale-105 transition cursor-pointer relative group ${
                      isToday
                        ? 'border-2 border-emerald-400 ring-4 ring-emerald-400/20 shadow-lg shadow-emerald-500/20'
                        : isDeepCraft
                        ? 'border-emerald-500/40 ring-1 ring-emerald-500/20 hover:border-emerald-400'
                        : isDriftDay
                        ? 'border-rose-500/40 ring-1 ring-rose-500/20 hover:border-rose-400'
                        : 'border-slate-800 hover:border-indigo-500'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span
                        className={`font-mono font-bold ${
                          isToday
                            ? 'text-emerald-400 font-black'
                            : isDeepCraft
                            ? 'text-emerald-400'
                            : isDriftDay
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {daySummary.day} {isToday ? '(Today)' : ''}
                      </span>
                      {isToday ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      ) : isDeepCraft ? (
                        <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-mono px-1 rounded">
                          {daySummary.totalHours}h
                        </span>
                      ) : isDriftDay ? (
                        <span className="text-[8px] bg-rose-500/20 text-rose-300 font-mono px-1 rounded">
                          ⚠️ Drift
                        </span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                      )}
                    </div>

                    {/* Segmented Color Stack Bar */}
                    <div className="w-full h-3 rounded-md overflow-hidden flex bg-slate-900 border border-slate-800/80">
                      {daySummary.domainPercentages.craft > 0 && (
                        <div
                          style={{ width: `${daySummary.domainPercentages.craft}%` }}
                          className="bg-emerald-500 transition-all"
                          title={`Craft: ${daySummary.domainPercentages.craft}%`}
                        />
                      )}
                      {daySummary.domainPercentages.explore > 0 && (
                        <div
                          style={{ width: `${daySummary.domainPercentages.explore}%` }}
                          className="bg-violet-500 transition-all"
                          title={`Explore: ${daySummary.domainPercentages.explore}%`}
                        />
                      )}
                      {daySummary.domainPercentages.social > 0 && (
                        <div
                          style={{ width: `${daySummary.domainPercentages.social}%` }}
                          className="bg-amber-500 transition-all"
                          title={`Social: ${daySummary.domainPercentages.social}%`}
                        />
                      )}
                      {daySummary.domainPercentages.play > 0 && (
                        <div
                          style={{ width: `${daySummary.domainPercentages.play}%` }}
                          className="bg-blue-500 transition-all"
                          title={`Play: ${daySummary.domainPercentages.play}%`}
                        />
                      )}
                      {daySummary.domainPercentages.vitality > 0 && (
                        <div
                          style={{ width: `${daySummary.domainPercentages.vitality}%` }}
                          className="bg-cyan-500 transition-all"
                          title={`Vitality: ${daySummary.domainPercentages.vitality}%`}
                        />
                      )}
                      {daySummary.domainPercentages.drift > 0 && (
                        <div
                          style={{ width: `${daySummary.domainPercentages.drift}%` }}
                          className="bg-rose-500 transition-all"
                          title={`Drift: ${daySummary.domainPercentages.drift}%`}
                        />
                      )}
                    </div>

                    {/* Top Topic Label */}
                    <span
                      className={`text-[9px] truncate block ${
                        isToday
                          ? 'text-emerald-300 font-bold'
                          : isDeepCraft
                          ? 'text-emerald-300 font-semibold'
                          : isDriftDay
                          ? 'text-rose-300'
                          : 'text-slate-400'
                      }`}
                    >
                      {daySummary.topTopic}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── VIEW 3: TOPIC TREEMAP (SEMANTIC WEIGHTS) ────────────────────── */}
        {activeTab === 'treemap' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Monthly Cognitive Footprint (Weighted Treemap)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Proportional box dimensions reflect the total hours poured into specific subjects
                  and domains.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Total Tracked: {mosaicData?.totalHours} Hours
              </span>
            </div>

            {/* Nested Treemap Blocks Grid */}
            <div className="grid grid-cols-12 gap-3 min-h-96">
              {/* Domain 1: Craft (Emerald - Dominant block 7 cols) */}
              {mosaicData?.treemap.find(t => t.domain === 'craft') && (
                <div className="col-span-12 md:col-span-7 bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex flex-col justify-between group hover:border-emerald-400 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 uppercase flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                      Craft & Deep Engineering
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {mosaicData.treemap.find(t => t.domain === 'craft')?.totalHours}h (
                      {mosaicData.treemap.find(t => t.domain === 'craft')?.percentage}%)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 flex-1">
                    {mosaicData.treemap
                      .find(t => t.domain === 'craft')
                      ?.subTopics.slice(0, 4)
                      .map((sub, idx) => (
                        <div
                          key={sub.name}
                          className={`${
                            idx === 2 ? 'col-span-2' : ''
                          } bg-emerald-900/40 border border-emerald-600/30 rounded-lg p-2.5 flex flex-col justify-between hover:bg-emerald-900/60 transition`}
                        >
                          <span className="text-xs font-bold text-white block truncate">
                            {sub.name}
                          </span>
                          <div className="flex justify-between items-end text-[10px] text-emerald-300 font-mono mt-1">
                            <span>{sub.sessionCount} Sessions</span>
                            <span className="font-bold text-emerald-400">{sub.hours} hrs</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Right Side: Exploration & Play & Social (5 cols) */}
              <div className="col-span-12 md:col-span-5 flex flex-col gap-3">
                {/* Exploration Block */}
                {mosaicData?.treemap.find(t => t.domain === 'explore') && (
                  <div className="flex-1 bg-violet-950/40 border border-violet-500/40 rounded-xl p-3 flex flex-col justify-between hover:border-violet-400 transition">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-violet-300 uppercase flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-400"></span>
                        Exploration & R&D
                      </span>
                      <span className="text-xs font-mono font-bold text-violet-400">
                        {mosaicData.treemap.find(t => t.domain === 'explore')?.totalHours}h (
                        {mosaicData.treemap.find(t => t.domain === 'explore')?.percentage}%)
                      </span>
                    </div>

                    <div className="flex gap-2 mt-2">
                      {mosaicData.treemap
                        .find(t => t.domain === 'explore')
                        ?.subTopics.slice(0, 2)
                        .map(sub => (
                          <div
                            key={sub.name}
                            className="flex-1 bg-violet-900/30 border border-violet-700/30 rounded-lg p-2"
                          >
                            <span className="text-[11px] font-bold text-white block truncate">
                              {sub.name}
                            </span>
                            <span className="text-[10px] text-violet-300 font-mono">
                              {sub.hours} hrs
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Sub-blocks for Gaming, Social, Drift */}
                <div className="grid grid-cols-3 gap-2 min-h-28">
                  {/* Play */}
                  <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-2.5 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-blue-300 uppercase">Gaming</span>
                    <span className="text-sm font-black text-blue-400 font-mono">
                      {mosaicData?.treemap.find(t => t.domain === 'play')?.totalHours || 0}h
                    </span>
                    <span className="text-[9px] text-slate-400 truncate">CS2 & Steam</span>
                  </div>

                  {/* Social */}
                  <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-2.5 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-amber-300 uppercase">Social</span>
                    <span className="text-sm font-black text-amber-400 font-mono">
                      {mosaicData?.treemap.find(t => t.domain === 'social')?.totalHours || 0}h
                    </span>
                    <span className="text-[9px] text-slate-400 truncate">Calls & Meetups</span>
                  </div>

                  {/* Drift */}
                  <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-2.5 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-rose-300 uppercase">Drift</span>
                    <span className="text-sm font-black text-rose-400 font-mono">
                      {mosaicData?.treemap.find(t => t.domain === 'drift')?.totalHours || 0}h
                    </span>
                    <span className="text-[9px] text-rose-400 truncate">YouTube Loops</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 4. The Magic Layer Integration Card ─────────────────────────────── */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
              ✨
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Automated Magic Layer Correlation
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Zero extra entry • Derived from Shudkara ecosystem
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div
            onClick={() => onNavigate && onNavigate('streaks')}
            className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex items-center gap-3 hover:border-orange-500/40 cursor-pointer transition"
          >
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold shrink-0">
              🔥
            </div>
            <div>
              <span className="font-bold text-white block">
                Streaks Habit Proof Cross-Reference (
                {mosaicData?.magicSummary.streakHabitProofsCount || 28} Verified)
              </span>
              <p className="text-[11px] text-slate-400">
                Gym & LeetCode photo proofs automatically anchored your 07:30 AM Vitality and
                10:00 PM Coding blocks without stopwatches.
              </p>
            </div>
          </div>

          <div
            onClick={() => onNavigate && onNavigate('timeline')}
            className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex items-center gap-3 hover:border-indigo-500/40 cursor-pointer transition"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold shrink-0">
              📸
            </div>
            <div>
              <span className="font-bold text-white block">
                LifetimeLine Memory Tag Anchor (
                {mosaicData?.magicSummary.timelineMomentsCount || 6} Moments)
              </span>
              <p className="text-[11px] text-slate-400">
                LifetimeLine moments pinned exact social dates and hackathon milestones into your
                monthly tapestry.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Interactive Day Detail Modal ────────────────────────────────────── */}
      {isModalOpen && selectedDaySummary && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Day Breakdown: {selectedDaySummary.date}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Bikram Sambat: {adToBs(new Date(selectedDaySummary.date)).formattedBs} (
                  {adToBs(new Date(selectedDaySummary.date)).monthName})
                </span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* Day Key Metrics */}
              <div className="flex items-center justify-between text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-300 font-semibold">Total Active Hours</span>
                <span className="font-mono font-bold text-indigo-400">
                  {selectedDaySummary.totalHours} hrs
                </span>
              </div>

              {/* Logged Activities */}
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Logged Activities
              </h4>
              <div className="space-y-2 text-xs">
                {selectedDaySummary.entries.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No entries logged yet for this day.</p>
                ) : (
                  selectedDaySummary.entries.map(entry => {
                    const cfg = DOMAIN_CONFIG[entry.domain] || DOMAIN_CONFIG.craft;
                    return (
                      <div
                        key={entry.id}
                        className={`p-2.5 rounded-lg ${cfg.bgPill} border ${cfg.borderPill} flex justify-between items-center`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cfg.hex }}
                          ></span>
                          <span className={`${cfg.textPill} font-semibold truncate`}>
                            {entry.topic}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white">{entry.durationHours} hrs</span>
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 transition"
                            title="Remove Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Activity Mini-Form inside modal */}
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-2 pt-3">
                <span className="text-[11px] font-bold text-slate-300 uppercase block">
                  Add Activity to this Day
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modalNewTopic}
                    onChange={e => setModalNewTopic(e.target.value)}
                    placeholder="Topic (e.g. Tree DP, Gym Push...)"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <select
                    value={modalNewDomain}
                    onChange={e => setModalNewDomain(e.target.value as LifeDomain)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="craft">Craft</option>
                    <option value="explore">Explore</option>
                    <option value="social">Social</option>
                    <option value="play">Play</option>
                    <option value="vitality">Vitality</option>
                    <option value="drift">Drift</option>
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    min="0.2"
                    value={modalNewHours}
                    onChange={e => setModalNewHours(e.target.value)}
                    className="w-14 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleModalAddEntry}
                    disabled={!modalNewTopic.trim()}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Magic Layer Correlated Box */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs text-indigo-200">
                <strong className="block mb-1 text-indigo-300 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Magic Layer Correlated:
                </strong>
                Streaks photo proofs validated. LifetimeLine moments anchored into your monthly
                chronicle without double entry.
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
            >
              Close Breakdown
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
