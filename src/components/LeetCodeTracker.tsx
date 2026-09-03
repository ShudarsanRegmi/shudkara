import React, { useState } from 'react';
import { BLIND75_QUESTIONS } from '../data/blind75';
import { 
  Search, Star, BookOpen, ExternalLink, Calendar, Plus, Minus, 
  ChevronDown, ChevronUp, Download, Upload, AlertTriangle, Check,
  Compass, Eye, Flame, Award, ShieldCheck, Clock, Zap,
  AlertCircle, FileText, Sparkles, PlusCircle, Trash2
} from 'lucide-react';

export interface RunLogEntry {
  id: string;
  date: string;
  timeTakenMinutes?: number;
  timeComplexity?: string;
  spaceComplexity?: string;
  approachNotes: string;
  rating?: 'Smooth' | 'Struggled' | 'Stuck';
}

export interface QuestionProgress {
  status: 'Not Started' | 'In Progress' | 'Solved' | 'Needs Review';
  notes: string;
  revisedCount: number;
  lastRevised: string | null;
  isFavorite: boolean;
  runLogs?: RunLogEntry[];
}

export type TrackerState = Record<string, QuestionProgress>;

const DEFAULT_PROGRESS: QuestionProgress = {
  status: 'Not Started',
  notes: '',
  revisedCount: 0,
  lastRevised: null,
  isFavorite: false,
  runLogs: []
};

// ── Sanskrit Mastery Tier Definition (Option 3) ──
export interface SanskritTier {
  name: string;
  script: string;
  meaning: string;
  icon: any;
  bg: string;
  border: string;
  text: string;
  glow?: string;
}

export function getSanskritTier(runs: number): SanskritTier {
  if (runs === 0) {
    return {
      name: 'Arambha',
      script: 'आरम्भ',
      meaning: 'Unstudied',
      icon: Compass,
      bg: 'bg-slate-100 dark:bg-slate-800',
      border: 'border-slate-200 dark:border-slate-700',
      text: 'text-slate-600 dark:text-slate-400',
    };
  }
  if (runs === 1) {
    return {
      name: 'Bodha',
      script: 'बोध',
      meaning: 'Perceived',
      icon: Eye,
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-900/40',
      text: 'text-amber-700 dark:text-amber-400',
    };
  }
  if (runs === 2) {
    return {
      name: 'Abhyasa',
      script: 'अभ्यास',
      meaning: 'Practiced',
      icon: Flame,
      bg: 'bg-sky-50 dark:bg-sky-950/30',
      border: 'border-sky-200 dark:border-sky-900/40',
      text: 'text-sky-700 dark:text-sky-400',
    };
  }
  if (runs >= 3 && runs < 5) {
    return {
      name: 'Praveenya',
      script: 'प्रवीनता',
      meaning: 'Expert',
      icon: Award,
      bg: 'bg-indigo-50 dark:bg-indigo-950/30',
      border: 'border-indigo-200 dark:border-indigo-900/40',
      text: 'text-indigo-700 dark:text-indigo-400',
    };
  }
  // 5+ runs
  return {
    name: 'Siddhi',
    script: 'सिद्धि',
    meaning: 'Mastered',
    icon: ShieldCheck,
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    border: 'border-emerald-300 dark:border-emerald-800',
    text: 'text-emerald-800 dark:text-emerald-300',
    glow: 'shadow-sm shadow-emerald-300/50 ring-2 ring-emerald-400/40'
  };
}

interface LeetCodeTrackerProps {
  progress: TrackerState;
  onProgressChange: (updated: TrackerState) => void;
}

export const LeetCodeTracker: React.FC<LeetCodeTrackerProps> = ({ progress, onProgressChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedTier, setSelectedTier] = useState<string>('All');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  
  // Expanded card state & active tabs
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [activeCardTab, setActiveCardTab] = useState<Record<string, 'notes' | 'log'>>({});
  const [notesEditMode, setNotesEditMode] = useState<Record<string, boolean>>({});

  // New Run Log Form State per question
  const [logFormOpen, setLogFormOpen] = useState<Record<string, boolean>>({});
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logTime, setLogTime] = useState<string>('15');
  const [logTC, setLogTC] = useState<string>('O(N)');
  const [logSC, setLogSC] = useState<string>('O(1)');
  const [logRating, setLogRating] = useState<'Smooth' | 'Struggled' | 'Stuck'>('Smooth');
  const [logNotes, setLogNotes] = useState<string>('');

  // Notification banner state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveProgress = (updated: TrackerState) => {
    onProgressChange(updated);
  };

  const getQuestionProgress = (id: string): QuestionProgress => {
    const existing = progress[id];
    if (!existing) return { ...DEFAULT_PROGRESS, runLogs: [] };
    return {
      ...DEFAULT_PROGRESS,
      ...existing,
      runLogs: existing.runLogs || []
    };
  };

  const updateStatus = (id: string, status: QuestionProgress['status']) => {
    const current = getQuestionProgress(id);
    const updated = {
      ...progress,
      [id]: {
        ...current,
        status,
        lastRevised: status === 'Solved' ? new Date().toISOString().split('T')[0] : current.lastRevised,
        revisedCount: status === 'Solved' && current.revisedCount === 0 ? 1 : current.revisedCount
      }
    };
    saveProgress(updated);
  };

  const updateNotes = (id: string, notes: string) => {
    const current = getQuestionProgress(id);
    const updated = {
      ...progress,
      [id]: {
        ...current,
        notes
      }
    };
    saveProgress(updated);
  };

  const toggleFavorite = (id: string) => {
    const current = getQuestionProgress(id);
    const updated = {
      ...progress,
      [id]: {
        ...current,
        isFavorite: !current.isFavorite
      }
    };
    saveProgress(updated);
    triggerToast(
      !current.isFavorite ? 'Added to favorites' : 'Removed from favorites', 
      'info'
    );
  };

  const adjustRevisionCount = (id: string, delta: number) => {
    const current = getQuestionProgress(id);
    const newCount = Math.max(0, current.revisedCount + delta);
    const oldTier = getSanskritTier(current.revisedCount);
    const newTier = getSanskritTier(newCount);

    const updated = {
      ...progress,
      [id]: {
        ...current,
        revisedCount: newCount,
        lastRevised: delta > 0 ? new Date().toISOString().split('T')[0] : current.lastRevised
      }
    };
    saveProgress(updated);

    if (delta > 0 && newTier.name !== oldTier.name) {
      triggerToast(`Mastery Tier Level Up! Reached ${newTier.name} (${newTier.script})`, 'success');
    }
  };

  // ── Log New Run / Sadhana Entry ──
  const handleAddRunLog = (questionId: string) => {
    if (!logNotes.trim()) {
      triggerToast('Please write a brief approach note for this run log.', 'error');
      return;
    }

    const current = getQuestionProgress(questionId);
    const newEntry: RunLogEntry = {
      id: Date.now().toString(),
      date: logDate || new Date().toISOString().split('T')[0],
      timeTakenMinutes: parseInt(logTime || '0', 10),
      timeComplexity: logTC.trim(),
      spaceComplexity: logSC.trim(),
      approachNotes: logNotes.trim(),
      rating: logRating
    };

    const newLogs = [newEntry, ...(current.runLogs || [])];
    const newCount = current.revisedCount + 1;
    const newTier = getSanskritTier(newCount);

    const updated = {
      ...progress,
      [questionId]: {
        ...current,
        revisedCount: newCount,
        lastRevised: newEntry.date,
        status: current.status === 'Not Started' ? 'Solved' : current.status,
        runLogs: newLogs
      }
    };

    saveProgress(updated);
    setLogFormOpen(prev => ({ ...prev, [questionId]: false }));
    setLogNotes('');
    triggerToast(`Recorded run log & updated to ${newTier.name} (${newTier.script})!`, 'success');
  };

  const handleDeleteRunLog = (questionId: string, logId: string) => {
    const current = getQuestionProgress(questionId);
    const updatedLogs = (current.runLogs || []).filter(l => l.id !== logId);
    const updated = {
      ...progress,
      [questionId]: {
        ...current,
        runLogs: updatedLogs
      }
    };
    saveProgress(updated);
    triggerToast('Run log entry removed.', 'info');
  };

  const toggleNotesExpand = (id: string) => {
    setExpandedNotes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(progress, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `blind75_leetcode_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast('Backup JSON exported successfully.');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (typeof parsed === 'object') {
            saveProgress(parsed);
            triggerToast('Imported tracker progress successfully!');
          }
        } catch (err) {
          triggerToast('Failed to parse backup file. Invalid JSON.', 'error');
        }
      };
    }
  };

  const handleReset = () => {
    const input = window.prompt('Type "RESET" (in capital letters) to confirm wiping all LeetCode progress:');
    if (input === 'RESET') {
      onProgressChange({});
      triggerToast('Progress successfully reset.', 'info');
    }
  };

  // Quick formatting helper for notes
  const insertFormat = (id: string, prefix: string, suffix: string = '') => {
    const current = getQuestionProgress(id);
    const formatted = `${current.notes}\n${prefix}${suffix}`;
    updateNotes(id, formatted);
  };

  // Filter questions
  const filteredQuestions = BLIND75_QUESTIONS.filter((q) => {
    const p = getQuestionProgress(q.id);
    const tier = getSanskritTier(p.revisedCount);
    
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) || q.id.includes(searchQuery);
    const matchesDifficulty = selectedDifficulty === 'All' || q.difficulty === selectedDifficulty;
    const matchesStatus = selectedStatus === 'All' || p.status === selectedStatus;
    const matchesTier = selectedTier === 'All' || tier.name === selectedTier;
    const matchesFavorite = !showOnlyFavorites || p.isFavorite;

    return matchesSearch && matchesDifficulty && matchesStatus && matchesTier && matchesFavorite;
  });

  const categories = Array.from(new Set(BLIND75_QUESTIONS.map(q => q.category)));

  // Statistics Calculation
  const totalQuestions = BLIND75_QUESTIONS.length;
  const solvedCount = BLIND75_QUESTIONS.filter(q => getQuestionProgress(q.id).status === 'Solved').length;
  const reviewCount = BLIND75_QUESTIONS.filter(q => getQuestionProgress(q.id).status === 'Needs Review').length;
  const siddhiCount = BLIND75_QUESTIONS.filter(q => getQuestionProgress(q.id).revisedCount >= 5).length;

  return (
    <div className="space-y-6 animate-fade-in pb-16 select-none">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border text-white transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' :
          toast.type === 'error' ? 'bg-rose-600 border-rose-500' :
          'bg-blue-600 border-blue-500'
        }`}>
          <Check className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-blue-600 text-xs font-extrabold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Sanskrit Abhyasa Tracker
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Blind 75 Mastery & Abhyasa Journal
          </h2>
          <p className="text-xs text-slate-500 max-w-xl">
            Track solution approaches, log run histories (Sadhana), and ascend through the 5 Sanskrit Mastery Tiers.
          </p>
        </div>

        {/* Export / Import Controls */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={handleExport}
            title="Export Backup JSON"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export Data
          </button>
          
          <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-sm">
            <Upload className="w-3.5 h-3.5" />
            Import Backup
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport} 
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {/* Stat Bar with Sanskrit Siddhi Counter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solved</p>
            <p className="text-lg font-extrabold text-slate-900">{solvedCount} / {totalQuestions}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Siddhi (Mastered)</p>
            <p className="text-lg font-extrabold text-emerald-700">{siddhiCount} Problems</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Needs Review</p>
            <p className="text-lg font-extrabold text-slate-900">{reviewCount}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Favorites</p>
            <p className="text-lg font-extrabold text-slate-900">
              {BLIND75_QUESTIONS.filter(q => getQuestionProgress(q.id).isFavorite).length}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search question name or number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Sanskrit Tier Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-semibold">Sanskrit Tier:</span>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="text-xs font-bold px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 cursor-pointer"
            >
              <option value="All">All Tiers</option>
              <option value="Arambha">Arambha (Unstudied)</option>
              <option value="Bodha">Bodha (Perceived)</option>
              <option value="Abhyasa">Abhyasa (Practiced)</option>
              <option value="Praveenya">Praveenya (Expert)</option>
              <option value="Siddhi">Siddhi (Mastered)</option>
            </select>
          </div>

          {/* Difficulty */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-semibold">Difficulty:</span>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="text-xs font-bold px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 cursor-pointer"
            >
              <option value="All">All</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-semibold">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-bold px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Solved">Solved</option>
              <option value="Needs Review">Needs Review</option>
            </select>
          </div>

          {/* Favorites filter */}
          <button
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
              showOnlyFavorites
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${showOnlyFavorites ? 'fill-white' : ''}`} />
            Favorites
          </button>
        </div>
      </div>

      {/* Questions list by Category */}
      <div className="space-y-8">
        {categories.map((category) => {
          const categoryQuestions = filteredQuestions.filter(q => q.category === category);
          if (categoryQuestions.length === 0) return null;

          return (
            <div key={category} className="space-y-3">
              <h3 className="text-base font-extrabold text-slate-800 border-b border-slate-200 pb-2 flex items-center justify-between">
                <span>{category}</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2.5 py-0.5 rounded-full">
                  {categoryQuestions.length} questions
                </span>
              </h3>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
                {categoryQuestions.map((question) => {
                  const qProgress = getQuestionProgress(question.id);
                  const isExpanded = !!expandedNotes[question.id];
                  const tier = getSanskritTier(qProgress.revisedCount);
                  const TierIcon = tier.icon;
                  const activeTab = activeCardTab[question.id] || 'notes';
                  const isNotesEditing = !!notesEditMode[question.id];
                  const isLogOpen = !!logFormOpen[question.id];

                  return (
                    <div key={question.id} className="p-4 hover:bg-slate-50/60 transition-colors space-y-3">
                      
                      {/* Top Row: Title, Sanskrit Tier, Controls */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Title & difficulty */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            onClick={() => toggleFavorite(question.id)}
                            className="text-slate-300 hover:text-amber-400 transition-colors shrink-0"
                          >
                            <Star className={`w-5 h-5 ${qProgress.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                          
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="text-slate-400 font-bold text-xs">#{question.id}</span>
                              <a
                                href={question.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-extrabold text-sm text-slate-900 hover:text-blue-600 hover:underline inline-flex items-center gap-1"
                              >
                                {question.title}
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </a>

                              {/* Sanskrit Tier Badge */}
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] font-bold transition-all duration-300 ${tier.bg} ${tier.border} ${tier.text} ${tier.glow || ''}`}>
                                <TierIcon className="w-3.5 h-3.5 shrink-0" />
                                <span>{tier.name}</span>
                                <span className="opacity-70 text-[9px] font-mono">({tier.script})</span>
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {/* Difficulty tag */}
                              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                question.difficulty === 'Easy' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                question.difficulty === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {question.difficulty}
                              </span>

                              {/* Last revised date */}
                              {qProgress.lastRevised && (
                                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                                  <Calendar className="w-3 h-3" />
                                  Last Run: {qProgress.lastRevised}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center flex-wrap gap-3 shrink-0">
                          {/* Revision Counter */}
                          <div className="flex items-center border border-slate-200 rounded-xl px-1.5 py-1 bg-slate-50">
                            <button
                              onClick={() => adjustRevisionCount(question.id, -1)}
                              disabled={qProgress.revisedCount <= 0}
                              className="p-1 hover:text-rose-600 disabled:opacity-30 text-slate-500 transition"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-extrabold px-2 text-slate-800 min-w-[3rem] text-center">
                              {qProgress.revisedCount} {qProgress.revisedCount === 1 ? 'run' : 'runs'}
                            </span>
                            <button
                              onClick={() => adjustRevisionCount(question.id, 1)}
                              className="p-1 hover:text-emerald-600 text-slate-500 transition"
                              title="Add +1 Revision Run"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Status dropdown */}
                          <select
                            value={qProgress.status}
                            onChange={(e) => updateStatus(question.id, e.target.value as QuestionProgress['status'])}
                            className={`text-xs font-extrabold rounded-xl px-2.5 py-1.5 border focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                              qProgress.status === 'Solved' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                              qProgress.status === 'In Progress' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                              qProgress.status === 'Needs Review' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                              'bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            <option value="Not Started">Not Started</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Solved">Solved</option>
                            <option value="Needs Review">Needs Review</option>
                          </select>

                          {/* Notes & Run Log expander */}
                          <button
                            onClick={() => toggleNotesExpand(question.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition ${
                              isExpanded
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Notes & Logs</span>
                            {qProgress.runLogs && qProgress.runLogs.length > 0 && (
                              <span className="px-1.5 py-0.2 bg-blue-500 text-white rounded-full text-[9px]">
                                {qProgress.runLogs.length}
                              </span>
                            )}
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* ── Collapsible Notes & Run Log Panel ── */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 animate-in fade-in duration-150">
                          
                          {/* Inner Tabs: Notes vs Abhyasa Run Log */}
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setActiveCardTab(prev => ({ ...prev, [question.id]: 'notes' }))}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                  activeTab === 'notes'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                }`}
                              >
                                📝 General Notes
                              </button>
                              <button
                                onClick={() => setActiveCardTab(prev => ({ ...prev, [question.id]: 'log' }))}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                                  activeTab === 'log'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                }`}
                              >
                                📜 Abhyasa Log ({qProgress.runLogs?.length || 0})
                              </button>
                            </div>

                            {activeTab === 'notes' && (
                              <button
                                onClick={() => setNotesEditMode(prev => ({ ...prev, [question.id]: !isNotesEditing }))}
                                className="px-3 py-1 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                              >
                                {isNotesEditing ? '👁️ Preview' : '✏️ Edit Notes'}
                              </button>
                            )}

                            {activeTab === 'log' && (
                              <button
                                onClick={() => setLogFormOpen(prev => ({ ...prev, [question.id]: !isLogOpen }))}
                                className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                Log New Run
                              </button>
                            )}
                          </div>

                          {/* ── Tab 1: Enhanced Notes (Formatted Preview vs Edit Toolbar) ── */}
                          {activeTab === 'notes' && (
                            <div className="space-y-2">
                              {isNotesEditing ? (
                                <div className="space-y-2">
                                  {/* Toolbar */}
                                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                                    <button 
                                      onClick={() => insertFormat(question.id, '**Bold Text**')}
                                      className="px-2 py-1 font-bold bg-white rounded border border-slate-200 hover:bg-slate-50"
                                    >
                                      B
                                    </button>
                                    <button 
                                      onClick={() => insertFormat(question.id, '`code`')}
                                      className="px-2 py-1 font-mono bg-white rounded border border-slate-200 hover:bg-slate-50"
                                    >
                                      `code`
                                    </button>
                                    <button 
                                      onClick={() => insertFormat(question.id, '```\n// Code block here\n```')}
                                      className="px-2 py-1 font-mono bg-white rounded border border-slate-200 hover:bg-slate-50"
                                    >
                                      ``` block
                                    </button>
                                    <button 
                                      onClick={() => insertFormat(question.id, '- ')}
                                      className="px-2 py-1 bg-white rounded border border-slate-200 hover:bg-slate-50"
                                    >
                                      • List
                                    </button>
                                  </div>

                                  <textarea
                                    placeholder="Write your approach notes, key insights, or solution code snippet..."
                                    value={qProgress.notes}
                                    onChange={(e) => updateNotes(question.id, e.target.value)}
                                    rows={5}
                                    className="w-full text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                                  />
                                </div>
                              ) : (
                                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl min-h-[80px]">
                                  {qProgress.notes.trim() ? (
                                    <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                                      {qProgress.notes}
                                    </pre>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic">No notes written yet. Click "Edit Notes" to write your solution notes.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── Tab 2: Abhyasa Run Log (Journal of previous attempts) ── */}
                          {activeTab === 'log' && (
                            <div className="space-y-4">
                              
                              {/* New Run Log Form */}
                              {isLogOpen && (
                                <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl space-y-3 border border-slate-800 animate-in fade-in duration-150">
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <span className="text-xs font-extrabold text-amber-400 flex items-center gap-1">
                                      <Zap className="w-3.5 h-3.5" /> Log Solution Run
                                    </span>
                                    <button onClick={() => setLogFormOpen(prev => ({ ...prev, [question.id]: false }))}>
                                      <ChevronUp className="w-4 h-4 text-slate-400" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div>
                                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Date</label>
                                      <input
                                        type="date"
                                        value={logDate}
                                        onChange={e => setLogDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Time (mins)</label>
                                      <input
                                        type="number"
                                        value={logTime}
                                        onChange={e => setLogTime(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Time Complexity</label>
                                      <input
                                        type="text"
                                        value={logTC}
                                        onChange={e => setLogTC(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Space Complexity</label>
                                      <input
                                        type="text"
                                        value={logSC}
                                        onChange={e => setLogSC(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-[10px] text-slate-400 font-bold block mb-1">Run Feeling / Rating</label>
                                    <div className="flex gap-2">
                                      {(['Smooth', 'Struggled', 'Stuck'] as const).map(r => (
                                        <button
                                          type="button"
                                          key={r}
                                          onClick={() => setLogRating(r)}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                            logRating === r 
                                              ? r === 'Smooth' ? 'bg-emerald-600 text-white' : r === 'Struggled' ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white'
                                              : 'bg-slate-950 text-slate-400 border border-slate-800'
                                          }`}
                                        >
                                          {r === 'Smooth' ? '🟢 Smooth' : r === 'Struggled' ? '🟡 Struggled' : '🔴 Stuck'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-[10px] text-slate-400 font-bold block mb-1">Approach & Thoughts</label>
                                    <textarea
                                      placeholder="What approach did you take? What edge cases caught you?"
                                      value={logNotes}
                                      onChange={e => setLogNotes(e.target.value)}
                                      rows={3}
                                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleAddRunLog(question.id)}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition"
                                  >
                                    Save Run Log & Increment Revision (+1)
                                  </button>
                                </div>
                              )}

                              {/* Run History Timeline */}
                              {qProgress.runLogs && qProgress.runLogs.length > 0 ? (
                                <div className="space-y-3">
                                  {qProgress.runLogs.map((log) => (
                                    <div 
                                      key={log.id} 
                                      className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2 relative group"
                                    >
                                      <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-slate-800 flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                            {log.date}
                                          </span>
                                          {log.rating && (
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                              log.rating === 'Smooth' ? 'bg-emerald-100 text-emerald-800' :
                                              log.rating === 'Struggled' ? 'bg-amber-100 text-amber-800' :
                                              'bg-rose-100 text-rose-800'
                                            }`}>
                                              {log.rating}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          {log.timeTakenMinutes && (
                                            <span className="text-[10px] font-mono font-bold text-slate-500 flex items-center gap-1">
                                              <Clock className="w-3 h-3" /> {log.timeTakenMinutes}m
                                            </span>
                                          )}
                                          {log.timeComplexity && (
                                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-200 rounded text-slate-700">
                                              TC: {log.timeComplexity}
                                            </span>
                                          )}
                                          {log.spaceComplexity && (
                                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-200 rounded text-slate-700">
                                              SC: {log.spaceComplexity}
                                            </span>
                                          )}
                                          <button
                                            onClick={() => handleDeleteRunLog(question.id, log.id)}
                                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition p-1"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                                        {log.approachNotes}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic text-center py-4">No run log entries recorded yet. Click "Log New Run" to document your solution attempt.</p>
                              )}

                            </div>
                          )}

                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {filteredQuestions.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <AlertTriangle className="w-10 h-10 text-slate-400 mx-auto" />
            <h4 className="text-lg font-bold text-slate-700">No questions found</h4>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              No questions matched your search query or filters. Try adjusting your query or filter criteria.
            </p>
          </div>
        )}
      </div>

      {/* Discrete Bottom Reset */}
      <div className="pt-8 text-center">
        <button
          onClick={handleReset}
          className="text-xs text-slate-400 hover:text-red-500 transition underline underline-offset-4"
        >
          Reset All Progress
        </button>
      </div>

    </div>
  );
};
