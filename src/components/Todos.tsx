import React, { useState } from 'react';
import { 
  CheckSquare, Square, Plus, Trash2, Edit2, Lock, Unlock, 
  LayoutGrid, List, Sparkles
} from 'lucide-react';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  isPrivate?: boolean;
  color?: 'yellow' | 'blue' | 'emerald' | 'purple' | 'rose';
  x?: number; // for whiteboard positioning
  y?: number;
  createdAt: string;
}

interface TodosProps {
  authToken?: string | null;
  todos: TodoItem[];
  onTodosChange: (updated: TodoItem[]) => void;
  isBoardPrivate?: boolean;
  onBoardPrivacyChange?: (isPrivate: boolean) => void;
}

const PASTEL_COLORS = {
  yellow:  'bg-amber-100/90 border-amber-300 text-amber-950 shadow-amber-200/50',
  blue:    'bg-sky-100/90 border-sky-300 text-sky-950 shadow-sky-200/50',
  emerald: 'bg-emerald-100/90 border-emerald-300 text-emerald-950 shadow-emerald-200/50',
  purple:  'bg-purple-100/90 border-purple-300 text-purple-950 shadow-purple-200/50',
  rose:    'bg-rose-100/90 border-rose-300 text-rose-950 shadow-rose-200/50',
};

export const Todos: React.FC<TodosProps> = ({ 
  authToken, 
  todos, 
  onTodosChange,
  isBoardPrivate = false,
  onBoardPrivacyChange
}) => {
  const [viewMode, setViewMode] = useState<'whiteboard' | 'list'>('whiteboard');
  const [newText, setNewText] = useState('');
  const [newColor, setNewColor] = useState<TodoItem['color']>('yellow');
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const isLoggedIn = !!authToken;

  // Filter visible items: non-logged-in visitors only see public items (!isPrivate)
  const visibleTodos = todos.filter(item => {
    if (!isLoggedIn && (isBoardPrivate || item.isPrivate)) return false;
    return true;
  });

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    // Randomize initial whiteboard position offset
    const randomX = Math.floor(Math.random() * 40) + 10;
    const randomY = Math.floor(Math.random() * 40) + 10;

    const newItem: TodoItem = {
      id: Date.now().toString(),
      text: newText.trim(),
      completed: false,
      isPrivate: newIsPrivate,
      color: newColor,
      x: randomX,
      y: randomY,
      createdAt: new Date().toLocaleDateString()
    };

    onTodosChange([newItem, ...todos]);
    setNewText('');
    setNewIsPrivate(false);
  };

  const handleToggleComplete = (id: string) => {
    const updated = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    onTodosChange(updated);
  };

  const handleToggleItemPrivacy = (id: string) => {
    if (!isLoggedIn) return;
    const updated = todos.map(t => t.id === id ? { ...t, isPrivate: !t.isPrivate } : t);
    onTodosChange(updated);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this task?')) {
      onTodosChange(todos.filter(t => t.id !== id));
    }
  };

  const handleSaveEdit = (id: string) => {
    if (!editText.trim()) return;
    const updated = todos.map(t => t.id === id ? { ...t, text: editText.trim() } : t);
    onTodosChange(updated);
    setEditingId(null);
  };

  // Lockpad banner if board is set private and visitor is nologin
  if (!isLoggedIn && isBoardPrivate) {
    return (
      <div className="max-w-md mx-auto my-20 bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Private Todo Board</h3>
        <p className="text-xs text-slate-500">This board has been locked as private by the owner.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none animate-fade-in">
      
      {/* Top Header & Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 text-xs font-extrabold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            Task Management
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Todos
            {isBoardPrivate && (
              <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md border border-amber-200 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Private Board
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setViewMode('whiteboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'whiteboard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Whiteboard
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Flat List
            </button>
          </div>

          {/* Board-level Privacy Lockpad Toggle (Logged-in only) */}
          {isLoggedIn && onBoardPrivacyChange && (
            <button
              onClick={() => onBoardPrivacyChange(!isBoardPrivate)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                isBoardPrivate 
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title={isBoardPrivate ? 'Make Board Public' : 'Make Board Private'}
            >
              {isBoardPrivate ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
              {isBoardPrivate ? 'Board Private' : 'Board Public'}
            </button>
          )}
        </div>
      </div>

      {/* Quick Add Form (Logged-in only) */}
      {isLoggedIn && (
        <form onSubmit={handleAddTodo} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Add a new task or sticky note..."
            value={newText}
            onChange={e => setNewText(e.target.value)}
            className="flex-1 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            {/* Color selector for Whiteboard */}
            {viewMode === 'whiteboard' && (
              <div className="flex gap-1">
                {(['yellow', 'blue', 'emerald', 'purple', 'rose'] as const).map(color => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition ${
                      newColor === color ? 'border-slate-800 scale-110' : 'border-transparent'
                    } ${
                      color === 'yellow' ? 'bg-amber-300' :
                      color === 'blue' ? 'bg-sky-300' :
                      color === 'emerald' ? 'bg-emerald-300' :
                      color === 'purple' ? 'bg-purple-300' : 'bg-rose-300'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Privacy toggle for new item */}
            <button
              type="button"
              onClick={() => setNewIsPrivate(!newIsPrivate)}
              className={`p-2 rounded-xl border transition ${
                newIsPrivate ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
              title={newIsPrivate ? 'Private Task' : 'Public Task'}
            >
              {newIsPrivate ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4" />}
            </button>

            <button
              type="submit"
              disabled={!newText.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition shadow-md shrink-0 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>
        </form>
      )}

      {/* ── View Mode 1: Aesthetic Whiteboard ── */}
      {viewMode === 'whiteboard' && (
        <div className="relative min-h-[500px] bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-hidden shadow-xl bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px]">
          
          <div className="absolute top-4 right-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest pointer-events-none">
            Aesthetic Whiteboard Canvas
          </div>

          {visibleTodos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {visibleTodos.map((t) => {
                const colorClass = PASTEL_COLORS[t.color || 'yellow'];
                const isEditing = editingId === t.id;

                return (
                  <div
                    key={t.id}
                    className={`relative p-5 rounded-2xl border-2 ${colorClass} transition-all duration-200 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between min-h-[160px] group`}
                  >
                    {/* Top bar icons */}
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <button
                        onClick={() => handleToggleComplete(t.id)}
                        className="text-slate-700 hover:opacity-80 transition"
                      >
                        {t.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        {isLoggedIn && (
                          <button
                            onClick={() => handleToggleItemPrivacy(t.id)}
                            className="p-1 rounded hover:bg-black/10 transition"
                            title={t.isPrivate ? 'Private' : 'Public'}
                          >
                            {t.isPrivate ? <Lock className="w-3.5 h-3.5 text-amber-700" /> : <Unlock className="w-3.5 h-3.5 text-slate-500" />}
                          </button>
                        )}
                        {isLoggedIn && (
                          <button
                            onClick={() => { setEditingId(t.id); setEditText(t.text); }}
                            className="p-1 rounded hover:bg-black/10 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-700" />
                          </button>
                        )}
                        {isLoggedIn && (
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="p-1 rounded hover:bg-black/10 transition text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={3}
                          className="w-full p-2 text-xs font-semibold bg-white/80 rounded-lg border border-slate-300 focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveEdit(t.id)}
                          className="w-full py-1 bg-slate-900 text-white rounded text-[10px] font-bold"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <p className={`text-sm font-semibold leading-relaxed break-words ${t.completed ? 'line-through opacity-60' : ''}`}>
                        {t.text}
                      </p>
                    )}

                    {/* Footer Date & Privacy Tag */}
                    <div className="flex items-center justify-between text-[9px] font-mono font-bold opacity-60 pt-3">
                      <span>{t.createdAt}</span>
                      {t.isPrivate && <span className="uppercase text-amber-800">Private</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Sparkles className="w-8 h-8 opacity-40" />
              <p className="text-xs font-semibold">Whiteboard is clean</p>
            </div>
          )}
        </div>
      )}

      {/* ── View Mode 2: Flat List ── */}
      {viewMode === 'list' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
          {visibleTodos.length > 0 ? (
            visibleTodos.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl transition group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleComplete(t.id)}
                    className="text-blue-600 hover:text-blue-700 transition shrink-0"
                  >
                    {t.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-400" />}
                  </button>

                  <span className={`text-sm font-medium text-slate-800 truncate ${t.completed ? 'line-through text-slate-400' : ''}`}>
                    {t.text}
                  </span>

                  {t.isPrivate && (
                    <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold rounded flex items-center gap-1 shrink-0">
                      <Lock className="w-3 h-3" /> Private
                    </span>
                  )}
                </div>

                {isLoggedIn && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleToggleItemPrivacy(t.id)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-white"
                      title={t.isPrivate ? 'Private' : 'Public'}
                    >
                      {t.isPrivate ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              No tasks found in flat list.
            </div>
          )}
        </div>
      )}

    </div>
  );
};
