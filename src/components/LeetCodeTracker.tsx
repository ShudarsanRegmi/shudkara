import React, { useState } from 'react';
import { BLIND75_QUESTIONS } from '../data/blind75';
import { 
  Search, Star, BookOpen, ExternalLink, Calendar, Plus, Minus, 
  ChevronDown, ChevronUp, Trash2, Download, Upload, AlertTriangle, Check
} from 'lucide-react';

interface QuestionProgress {
  status: 'Not Started' | 'In Progress' | 'Solved' | 'Needs Review';
  notes: string;
  revisedCount: number;
  lastRevised: string | null;
  isFavorite: boolean;
}

type TrackerState = Record<string, QuestionProgress>;

const DEFAULT_PROGRESS: QuestionProgress = {
  status: 'Not Started',
  notes: '',
  revisedCount: 0,
  lastRevised: null,
  isFavorite: false,
};

interface LeetCodeTrackerProps {
  progress: TrackerState;
  onProgressChange: (updated: TrackerState) => void;
}

export const LeetCodeTracker: React.FC<LeetCodeTrackerProps> = ({ progress, onProgressChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  
  // Notification banner state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Save progress helper
  const saveProgress = (updated: TrackerState) => {
    onProgressChange(updated);
  };

  const getQuestionProgress = (id: string): QuestionProgress => {
    return progress[id] || { ...DEFAULT_PROGRESS };
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
    const updated = {
      ...progress,
      [id]: {
        ...current,
        revisedCount: newCount,
        lastRevised: delta > 0 ? new Date().toISOString().split('T')[0] : current.lastRevised
      }
    };
    saveProgress(updated);
  };

  const toggleNotesExpand = (id: string) => {
    setExpandedNotes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Export JSON backup
  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(progress, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `blind75_revision_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast('Backup exported successfully!', 'success');
  };

  // Import JSON backup
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          
          // Basic structural validation
          if (typeof parsed === 'object' && parsed !== null) {
            saveProgress(parsed);
            triggerToast('Backup imported successfully!', 'success');
          } else {
            triggerToast('Invalid file format.', 'error');
          }
        } catch {
          triggerToast('Error reading backup file.', 'error');
        }
      };
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you absolutely sure you want to reset all LeetCode tracker progress? This cannot be undone.')) {
      onProgressChange({});
      triggerToast('Progress successfully reset.', 'info');
    }
  };

  // Filter and group questions
  const filteredQuestions = BLIND75_QUESTIONS.filter((q) => {
    const p = getQuestionProgress(q.id);
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) || q.id.includes(searchQuery);
    const matchesDifficulty = selectedDifficulty === 'All' || q.difficulty === selectedDifficulty;
    const matchesStatus = selectedStatus === 'All' || p.status === selectedStatus;
    const matchesFavorite = !showOnlyFavorites || p.isFavorite;

    return matchesSearch && matchesDifficulty && matchesStatus && matchesFavorite;
  });

  // Grouped by Category
  const categories = Array.from(new Set(BLIND75_QUESTIONS.map(q => q.category)));

  // Global counts for dashboard
  const totalQuestions = BLIND75_QUESTIONS.length;
  const solvedCount = BLIND75_QUESTIONS.filter(q => getQuestionProgress(q.id).status === 'Solved').length;
  const reviewCount = BLIND75_QUESTIONS.filter(q => getQuestionProgress(q.id).status === 'Needs Review').length;
  const learningCount = BLIND75_QUESTIONS.filter(q => getQuestionProgress(q.id).status === 'In Progress').length;
  const starredCount = BLIND75_QUESTIONS.filter(q => getQuestionProgress(q.id).isFavorite).length;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-white transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' :
          toast.type === 'error' ? 'bg-rose-600 border-rose-500' :
          'bg-blue-600 border-blue-500'
        }`}>
          <Check className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Blind 75 Revision Tracker
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Keep track of your interview prep, save notes on approaches, and manage revisions.
          </p>
        </div>

        {/* Sync Tools */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={handleExport}
            title="Export Backup JSON"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700/80 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Data
          </button>
          
          <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700/80 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            Import Backup
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport} 
              className="hidden" 
            />
          </label>

          <button
            onClick={handleReset}
            title="Reset All Tracker Progress"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 rounded-lg border border-rose-100 dark:border-rose-900/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset All
          </button>
        </div>
      </div>

      {/* Stat Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-center shadow-sm">
          <span className="block text-2xl font-bold text-slate-800 dark:text-white">{solvedCount} / {totalQuestions}</span>
          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Total Solved</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-center shadow-sm">
          <span className="block text-2xl font-bold text-amber-500">{learningCount}</span>
          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">In Progress</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-center shadow-sm">
          <span className="block text-2xl font-bold text-rose-500">{reviewCount}</span>
          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Needs Review</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-center shadow-sm">
          <span className="block text-2xl font-bold text-slate-400">{totalQuestions - solvedCount - learningCount - reviewCount}</span>
          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Not Started</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-center shadow-sm col-span-2 md:col-span-1">
          <span className="block text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1">
            <Star className="w-5 h-5 fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400" />
            {starredCount}
          </span>
          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Favorites</span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col md:flex-row flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search question name or number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-850 dark:bg-slate-950 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Difficulty */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Difficulty:</span>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
            >
              <option value="All">All</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
            >
              <option value="All">All</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Solved">Solved</option>
              <option value="Needs Review">Needs Review</option>
            </select>
          </div>

          {/* Favorites filter */}
          <button
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              showOnlyFavorites
                ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${showOnlyFavorites ? 'fill-blue-600 dark:fill-blue-400' : ''}`} />
            Favorites Only
          </button>
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-8">
        {categories.map((category) => {
          // Filter questions in this category
          const categoryQuestions = filteredQuestions.filter(q => q.category === category);
          
          if (categoryQuestions.length === 0) return null;

          return (
            <div key={category} className="space-y-3">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-350 border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center justify-between">
                <span>{category}</span>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                  {categoryQuestions.length} questions
                </span>
              </h3>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
                {categoryQuestions.map((question) => {
                  const qProgress = getQuestionProgress(question.id);
                  const isExpanded = !!expandedNotes[question.id];

                  return (
                    <div key={question.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      {/* Grid Row */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Title & difficulty */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            onClick={() => toggleFavorite(question.id)}
                            className="text-slate-300 hover:text-amber-400 dark:text-slate-700 dark:hover:text-amber-500 transition-colors shrink-0"
                          >
                            <Star className={`w-5 h-5 ${qProgress.isFavorite ? 'fill-amber-400 text-amber-400 dark:fill-amber-500 dark:text-amber-500' : ''}`} />
                          </button>
                          
                          <div className="min-w-0">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="text-slate-400 font-semibold text-sm">#{question.id}</span>
                              <a
                                href={question.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline inline-flex items-center gap-1"
                              >
                                {question.title}
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </a>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1">
                              {/* Difficulty tag */}
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                question.difficulty === 'Easy' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' :
                                question.difficulty === 'Medium' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' :
                                'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
                              }`}>
                                {question.difficulty}
                              </span>

                              {/* Last revised date */}
                              {qProgress.lastRevised && (
                                <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                                  <Calendar className="w-3 h-3" />
                                  Rev: {qProgress.lastRevised}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center flex-wrap gap-3 shrink-0">
                          {/* Revision Counter */}
                          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-0.5 bg-slate-50 dark:bg-slate-950">
                            <button
                              onClick={() => adjustRevisionCount(question.id, -1)}
                              disabled={qProgress.revisedCount <= 0}
                              className="p-1 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-inherit text-slate-500"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold px-2 text-slate-700 dark:text-slate-350 min-w-[2.5rem] text-center">
                              {qProgress.revisedCount} {qProgress.revisedCount === 1 ? 'run' : 'runs'}
                            </span>
                            <button
                              onClick={() => adjustRevisionCount(question.id, 1)}
                              className="p-1 hover:text-emerald-500 text-slate-500"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Status dropdown */}
                          <select
                            value={qProgress.status}
                            onChange={(e) => updateStatus(question.id, e.target.value as QuestionProgress['status'])}
                            className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              qProgress.status === 'Solved' ? 'bg-emerald-100/70 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400' :
                              qProgress.status === 'In Progress' ? 'bg-blue-100/70 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-400' :
                              qProgress.status === 'Needs Review' ? 'bg-rose-100/70 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400' :
                              'bg-slate-100/70 border-slate-200 text-slate-600 dark:bg-slate-800/70 dark:border-slate-750 dark:text-slate-400'
                            }`}
                          >
                            <option value="Not Started">Not Started</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Solved">Solved</option>
                            <option value="Needs Review">Needs Review</option>
                          </select>

                          {/* Notes expander */}
                          <button
                            onClick={() => toggleNotesExpand(question.id)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                              isExpanded
                                ? 'bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-850 dark:border-slate-700 dark:text-slate-200'
                                : qProgress.notes.trim() !== ''
                                  ? 'bg-blue-50/50 border-blue-100 hover:bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 dark:hover:bg-blue-950/40'
                                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>Notes</span>
                            {qProgress.notes.trim() !== '' && (
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                            )}
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        </div>
                      </div>

                      {/* Notes Section (Collapsible) */}
                      {isExpanded && (
                        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 animate-slide-down">
                          <textarea
                            placeholder="Add your solution approach, time/space complexity notes, or code links..."
                            value={qProgress.notes}
                            onChange={(e) => updateNotes(question.id, e.target.value)}
                            rows={4}
                            className="w-full text-sm font-mono bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 p-3 rounded-xl border border-slate-200 dark:border-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] text-slate-400 font-medium">Notes auto-save on typing.</span>
                          </div>
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
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <AlertTriangle className="w-10 h-10 text-slate-400 mx-auto" />
            <h4 className="text-lg font-bold text-slate-700 dark:text-slate-350">No questions found</h4>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              No questions matched your search query or filters. Try adjusting your query or filter criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
