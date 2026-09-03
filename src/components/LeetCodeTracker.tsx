import React, { useState } from 'react';
import { BLIND75_QUESTIONS } from '../data/blind75';
import { 
  Search, Star, BookOpen, ExternalLink, Calendar, Plus, 
  ChevronDown, ChevronUp, Download, Upload, AlertTriangle, Check,
  Compass, Eye, Flame, Award, ShieldCheck, Clock, Zap,
  AlertCircle, FileText, Sparkles, Trash2, X
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

// ── Sanskrit Mastery Tier Definition with Color Gamification ──
export interface SanskritTier {
  name: string;
  script: string;
  meaning: string;
  icon: any;
  bg: string;
  border: string;
  text: string;
  rowBg?: string;
  glow?: string;
}

export function getSanskritTier(runs: number): SanskritTier {
  if (runs === 0) {
    return {
      name: 'Arambha',
      script: 'आरम्भ',
      meaning: 'Unstudied',
      icon: Compass,
      bg: 'bg-slate-100',
      border: 'border-slate-200',
      text: 'text-slate-600',
      rowBg: 'bg-white'
    };
  }
  if (runs === 1) {
    return {
      name: 'Bodha',
      script: 'बोध',
      meaning: 'Perceived',
      icon: Eye,
      bg: 'bg-emerald-100',
      border: 'border-emerald-300',
      text: 'text-emerald-800',
      rowBg: 'bg-emerald-50/20'
    };
  }
  if (runs === 2) {
    return {
      name: 'Abhyasa',
      script: 'अभ्यास',
      meaning: 'Practiced',
      icon: Flame,
      bg: 'bg-sky-100',
      border: 'border-sky-300',
      text: 'text-sky-800',
      rowBg: 'bg-sky-50/30'
    };
  }
  if (runs >= 3 && runs < 5) {
    return {
      name: 'Praveenya',
      script: 'प्रवीनता',
      meaning: 'Expert',
      icon: Award,
      bg: 'bg-indigo-100',
      border: 'border-indigo-300',
      text: 'text-indigo-800',
      rowBg: 'bg-indigo-50/30'
    };
  }
  // 5+ runs (Siddhi Mastery)
  return {
    name: 'Siddhi',
    script: 'सिद्धि',
    meaning: 'Mastered',
    icon: ShieldCheck,
    bg: 'bg-gradient-to-r from-amber-200 via-amber-100 to-emerald-100',
    border: 'border-amber-300',
    text: 'text-amber-950 font-black',
    rowBg: 'bg-amber-50/40 border-amber-200',
    glow: 'shadow-md shadow-amber-300/40 ring-2 ring-amber-400/50 animate-pulse'
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
  
  // Independent expander states for Notes vs Logs
  const [openNotesPanel, setOpenNotesPanel] = useState<Record<string, boolean>>({});
  const [openLogsPanel, setOpenLogsPanel] = useState<Record<string, boolean>>({});
  const [notesEditMode, setNotesEditMode] = useState<Record<string, boolean>>({});

  // Active Run Log Modal state
  const [activeModalQuestionId, setActiveModalQuestionId] = useState<string | null>(null);
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

  // Open the Run Log modal when (+) button is clicked
  const handleOpenRunLogModal = (questionId: string) => {
    setActiveModalQuestionId(questionId);
    setLogDate(new Date().toISOString().split('T')[0]);
    setLogTime('15');
    setLogTC('O(N)');
    setLogSC('O(1)');
    setLogRating('Smooth');
    setLogNotes('');
  };

  // Submit modal form -> saves log entry AND increases revision count (+1)
  const handleSubmitRunLogModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalQuestionId) return;

    if (!logNotes.trim()) {
      triggerToast('Please write your solution approach & thoughts.', 'error');
      return;
    }

    const current = getQuestionProgress(activeModalQuestionId);
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
    const oldTier = getSanskritTier(current.revisedCount);
    const newCount = current.revisedCount + 1;
    const newTier = getSanskritTier(newCount);

    const updated = {
      ...progress,
      [activeModalQuestionId]: {
        ...current,
        revisedCount: newCount,
        lastRevised: newEntry.date,
        status: (current.status === 'Not Started' ? 'Solved' : current.status) as QuestionProgress['status'],
        runLogs: newLogs
      }
    };

    saveProgress(updated);
    setActiveModalQuestionId(null);
    setLogNotes('');

    if (newTier.name !== oldTier.name) {
      triggerToast(`Mastery Level Up! Ascended to ${newTier.name} (${newTier.script})!`, 'success');
    } else {
      triggerToast(`Logged run & increased revision count to ${newCount}!`, 'success');
    }
  };

  // Delete run log entry (optionally decrease count if confirmed)
  const handleDeleteRunLog = (questionId: string, logId: string) => {
    const current = getQuestionProgress(questionId);
    const updatedLogs = (current.runLogs || []).filter(l => l.id !== logId);
    
    let shouldDecrease = false;
    if (current.revisedCount > 0) {
      shouldDecrease = window.confirm('Do you also want to decrease the revision count by 1?');
    }

    const updated = {
      ...progress,
      [questionId]: {
        ...current,
        revisedCount: shouldDecrease ? Math.max(0, current.revisedCount - 1) : current.revisedCount,
        runLogs: updatedLogs
      }
    };

    saveProgress(updated);
    triggerToast('Run log entry deleted.', 'info');
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
            Track solution approaches, log run histories, and ascend through the 5 Sanskrit Mastery Tiers.
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
          <div className="p-3 bg-amber-100 text-amber-700 rounded-xl border border-amber-300 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Siddhi (Mastered)</p>
            <p className="text-lg font-extrabold text-amber-800">{siddhiCount} Problems</p>
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
                  const isSiddhiMastered = qProgress.revisedCount >= 5;
                  const tier = getSanskritTier(qProgress.revisedCount);
                  const TierIcon = tier.icon;

                  const isNotesOpen = !!openNotesPanel[question.id];
                  const isLogsOpen = !!openLogsPanel[question.id];
                  const isNotesEditing = !!notesEditMode[question.id];

                  return (
                    <div 
                      key={question.id} 
                      className={`p-4 transition-colors space-y-3 ${tier.rowBg || 'bg-white'} ${isSiddhiMastered ? 'opacity-90' : ''}`}
                    >
                      
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
                              
                              {/* Strikethrough when Siddhi (5+ runs) reached */}
                              <a
                                href={question.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`font-extrabold text-sm hover:underline inline-flex items-center gap-1 ${
                                  isSiddhiMastered 
                                    ? 'line-through text-slate-400 font-semibold' 
                                    : 'text-slate-900 hover:text-blue-600'
                                }`}
                              >
                                {question.title}
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </a>

                              {/* Siddhi Mastered Stamp */}
                              {isSiddhiMastered && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black tracking-wide shadow-sm">
                                  <Check className="w-3 h-3 text-amber-700" />
                                  Siddhi Mastered
                                </span>
                              )}

                              {/* Sanskrit Tier Badge with level-based color gamification */}
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
                          
                          {/* (+) Button: Opens Run Log Modal & Increases Runs */}
                          <button
                            onClick={() => handleOpenRunLogModal(question.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition shadow-sm"
                            title="Log a new solution attempt and increase revision (+1)"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{qProgress.revisedCount} {qProgress.revisedCount === 1 ? 'run' : 'runs'}</span>
                          </button>

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

                          {/* Separate Notes Expander Button */}
                          <button
                            onClick={() => setOpenNotesPanel(prev => ({ ...prev, [question.id]: !prev[question.id] }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition ${
                              isNotesOpen
                                ? 'bg-blue-600 text-white border-blue-600'
                                : qProgress.notes.trim() !== ''
                                  ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Notes</span>
                            {isNotesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {/* Separate Logs Expander Button */}
                          <button
                            onClick={() => setOpenLogsPanel(prev => ({ ...prev, [question.id]: !prev[question.id] }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition ${
                              isLogsOpen
                                ? 'bg-slate-900 text-white border-slate-900'
                                : qProgress.runLogs && qProgress.runLogs.length > 0
                                  ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Logs</span>
                            {qProgress.runLogs && qProgress.runLogs.length > 0 && (
                              <span className="px-1.5 py-0.2 bg-amber-600 text-white rounded-full text-[9px] font-bold">
                                {qProgress.runLogs.length}
                              </span>
                            )}
                            {isLogsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* ── Separate Panel 1: General Solution Notes ── */}
                      {isNotesOpen && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 text-blue-600" /> Solution Approach & Notes
                            </span>
                            <button
                              onClick={() => setNotesEditMode(prev => ({ ...prev, [question.id]: !isNotesEditing }))}
                              className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                            >
                              {isNotesEditing ? '👁️ Preview' : '✏️ Edit Notes'}
                            </button>
                          </div>

                          {isNotesEditing ? (
                            <div className="space-y-2">
                              {/* Formatting Toolbar */}
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
                                placeholder="Write your solution approach, time/space complexity notes, or code snippet..."
                                value={qProgress.notes}
                                onChange={(e) => updateNotes(question.id, e.target.value)}
                                rows={4}
                                className="w-full text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                              />
                            </div>
                          ) : (
                            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl min-h-[70px]">
                              {qProgress.notes.trim() ? (
                                <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                                  {qProgress.notes}
                                </pre>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No general notes added yet. Click "Edit Notes" to write your solution notes.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Separate Panel 2: Abhyasa Run Log Timeline ── */}
                      {isLogsOpen && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600" /> Abhyasa Run History Journal
                            </span>
                            <button
                              onClick={() => handleOpenRunLogModal(question.id)}
                              className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Log New Run
                            </button>
                          </div>

                          {/* History timeline entries */}
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
                                        title="Delete Run Log entry"
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
                            <p className="text-xs text-slate-400 italic text-center py-3">No run log entries recorded yet. Click "Log New Run" or "+" to document your solution attempt.</p>
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

      {/* ── Run Log Creation Pop-up Modal (Triggered by + Click) ── */}
      {activeModalQuestionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 relative">
            
            <button 
              onClick={() => setActiveModalQuestionId(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-600 uppercase tracking-wider">
                <Zap className="w-4 h-4 text-amber-500" />
                Log Solution Run
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                #{activeModalQuestionId} - {BLIND75_QUESTIONS.find(q => q.id === activeModalQuestionId)?.title}
              </h3>
            </div>

            <form onSubmit={handleSubmitRunLogModal} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Attempt Date</label>
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Time Taken (mins)</label>
                  <input
                    type="number"
                    value={logTime}
                    onChange={e => setLogTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Time Complexity</label>
                  <input
                    type="text"
                    placeholder="e.g. O(N log N)"
                    value={logTC}
                    onChange={e => setLogTC(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Space Complexity</label>
                  <input
                    type="text"
                    placeholder="e.g. O(1)"
                    value={logSC}
                    onChange={e => setLogSC(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Attempt Feeling / Rating</label>
                <div className="flex gap-2">
                  {(['Smooth', 'Struggled', 'Stuck'] as const).map(r => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setLogRating(r)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                        logRating === r 
                          ? r === 'Smooth' ? 'bg-emerald-600 text-white border-emerald-600' : r === 'Struggled' ? 'bg-amber-600 text-white border-amber-600' : 'bg-rose-600 text-white border-rose-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r === 'Smooth' ? '🟢 Smooth' : r === 'Struggled' ? '🟡 Struggled' : '🔴 Stuck'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Approach & Thoughts *</label>
                <textarea
                  required
                  placeholder="Document your algorithm approach, key insights, or edge cases encountered during this run..."
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModalQuestionId(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  Submit Run & Increase Revision (+1)
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
