import React from 'react';
import { 
  Search, Calendar, FolderOpen, Tag, Layers, List, 
  RotateCcw, Clock, Loader2, X, SlidersHorizontal, HardDrive, Flame
} from 'lucide-react';
import { BS_MONTHS, getAvailableBsYears, toNepaliDigits } from '../utils/bikramSambat';

interface TimelineSidebarProps {
  // Search & Filter States
  search: string;
  onSearchChange: (val: string) => void;
  selectedCategory: string;
  onCategoryChange: (val: string) => void;
  selectedTag: string;
  onTagChange: (val: string) => void;
  categories: string[];
  tags: string[];

  // Bikram Sambat BS Filters
  selectedBsYear: string;
  onBsYearChange: (val: string) => void;
  selectedBsMonth: string;
  onBsMonthChange: (val: string) => void;

  // Deck View Setting
  globalDeckMode: boolean;
  onToggleGlobalDeckMode: () => void;

  // Streaks Integration Toggle
  showStreaksMoments: boolean;
  onToggleShowStreaksMoments: () => void;

  // GDrive Sync
  onSyncDrive: () => void;
  syncing: boolean;

  // Stats
  totalMoments: number;

  // Drawer Controls (mobile / collapsible)
  isOpen: boolean;
  onClose: () => void;
  activeFilterCount: number;
  onResetFilters: () => void;
}

export const TimelineSidebar: React.FC<TimelineSidebarProps> = ({
  search,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedTag,
  onTagChange,
  categories,
  tags,
  selectedBsYear,
  onBsYearChange,
  selectedBsMonth,
  onBsMonthChange,
  globalDeckMode,
  onToggleGlobalDeckMode,
  showStreaksMoments,
  onToggleShowStreaksMoments,
  onSyncDrive,
  syncing,
  totalMoments,
  isOpen,
  onClose,
  activeFilterCount,
  onResetFilters
}) => {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Panel: Responsive (Drawer on mobile, Collapsible/Sticky on desktop) */}
      <aside className={`
        fixed lg:sticky top-0 lg:top-20 right-0 lg:right-auto z-40 lg:z-10
        h-full lg:h-[calc(100vh-6rem)] w-80 shrink-0
        bg-white border-l lg:border-l-0 lg:border border-slate-200/90 lg:rounded-3xl
        shadow-2xl lg:shadow-xs p-5 flex flex-col justify-between overflow-y-auto
        transition-transform duration-200 ease-in-out select-none
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <div className="space-y-6">
          
          {/* Sidebar Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              <span className="font-extrabold text-sm text-slate-900">Filters & Config</span>
              {activeFilterCount > 0 && (
                <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {activeFilterCount} Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="text-[11px] font-bold text-slate-500 hover:text-blue-600 transition flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-slate-100"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg lg:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Search className="w-3 h-3" />
              <span>Search Moments</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Keywords, captions, titles..."
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* View Deck Stacking Setting */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>Day Feed Display</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={onToggleGlobalDeckMode}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  globalDeckMode
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Stacked Book</span>
              </button>
              <button
                type="button"
                onClick={onToggleGlobalDeckMode}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  !globalDeckMode
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Expanded</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Stacked mode organizes same-day snaps horizontally so you can turn them like pages.
            </p>
          </div>

          {/* Streaks Timeline Photo Feed Toggle */}
          <div className="space-y-1.5 p-3 rounded-2xl bg-orange-50/70 border border-orange-200/80">
            <div className="flex items-center justify-between">
              <label
                className="text-xs font-bold text-orange-950 flex items-center gap-1.5 cursor-pointer"
                htmlFor="toggle-streaks-timeline"
              >
                <Flame className="w-3.5 h-3.5 text-orange-600" />
                <span>View Streaks Timeline</span>
              </label>
              <input
                id="toggle-streaks-timeline"
                type="checkbox"
                checked={showStreaksMoments}
                onChange={onToggleShowStreaksMoments}
                className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-orange-800/80 leading-tight">
              Include daily photo challenge proofs as moments in your timeline.
            </p>
          </div>

          {/* Bikram Sambat (BS) Nepali Calendar Filters */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold text-amber-700 uppercase tracking-widest flex items-center gap-1">
              <Calendar className="w-3 h-3 text-amber-600" />
              <span>Bikram Sambat (BS) Date</span>
            </label>
            
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedBsYear}
                onChange={e => onBsYearChange(e.target.value)}
                className="w-full px-2 py-2 border border-amber-200 rounded-xl text-xs bg-amber-50/60 text-amber-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All BS Years</option>
                {getAvailableBsYears().map(y => (
                  <option key={y} value={y}>{y} BS ({toNepaliDigits(y)})</option>
                ))}
              </select>

              <select
                value={selectedBsMonth}
                onChange={e => onBsMonthChange(e.target.value)}
                className="w-full px-2 py-2 border border-amber-200 rounded-xl text-xs bg-amber-50/60 text-amber-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Months</option>
                {BS_MONTHS.map(m => (
                  <option key={m.id} value={m.id}>{m.np} ({m.en})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <FolderOpen className="w-3 h-3" />
              <span>Category</span>
            </label>
            <select
              value={selectedCategory}
              onChange={e => onCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Tags Cloud */}
          {tags.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span>Tags ({tags.length})</span>
                </label>
                {selectedTag && (
                  <button
                    type="button"
                    onClick={() => onTagChange('')}
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    Clear Tag
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
                {tags.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onTagChange(selectedTag === t ? '' : t)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition ${
                      selectedTag === t
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Sidebar Footer: GDrive Sync & Chronicle Stats */}
        <div className="pt-4 mt-6 border-t border-slate-100 space-y-3 shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Vault Memories:</span>
            </span>
            <span className="font-extrabold text-slate-800">{totalMoments} Total</span>
          </div>

          <button
            type="button"
            onClick={onSyncDrive}
            disabled={syncing}
            className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 border border-slate-200"
            title="Scan Google Drive for offline additions"
          >
            {syncing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Syncing GDrive...</span>
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5 text-slate-600" />
                <span>Sync Google Drive</span>
              </>
            )}
          </button>
        </div>

      </aside>
    </>
  );
};
