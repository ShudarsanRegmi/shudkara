import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  CheckSquare, Square, Plus, Trash2, Edit2, Lock, Unlock, 
  LayoutGrid, List, Sparkles, Shield, Award, Clock, Calendar, 
  User, CheckCircle2, RefreshCw, FolderPlus, MoveRight, Layers, 
  SlidersHorizontal, Briefcase, BookOpen, Code, Home, Bookmark, 
  Folder, Check, AlertCircle, X
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
export interface WhiteboardNote {
  id: string;
  text: string;
  completed: boolean;
  isPrivate?: boolean;
  color?: 'yellow' | 'blue' | 'emerald' | 'purple' | 'rose';
  x?: number;
  y?: number;
  createdAt: string;
}

export type TodoItem = WhiteboardNote;

export interface TaskWorkset {
  id: string;
  title: string;
  icon?: string;
  color?: string;
  order?: number;
  createdAt?: string;
}

export type TaskPriority = 'p1' | 'p2' | 'p3';

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface KaryaTask {
  id: string;
  worksetId: string;
  title: string;
  notes?: string;
  dueDate?: string | null;
  priority: TaskPriority;
  subtasks: SubTask[];
  tags: string[];
  completed: boolean;
  completedAt?: string | null;
  order?: number;
  createdAt: string;
  isPrivate?: boolean;
}

export type CommitmentUrgency = 'sacred' | 'high' | 'standard' | 'flexible';
export type CommitmentStatus = 'active' | 'honored' | 'renegotiated' | 'breached';

export interface RenegotiationRecord {
  previousDeadline: string;
  newDeadline: string;
  reason: string;
  timestamp: string;
}

export interface AlertLogRecord {
  alertKey: string;
  sentAt: string;
  type: string;
}

export interface PratigyaCommitment {
  id: string;
  title: string;
  description?: string;
  recipientName: string;
  recipientContact?: string;
  deadline: string;
  urgency: CommitmentUrgency;
  status: CommitmentStatus;
  fulfilledAt?: string | null;
  renegotiationHistory?: RenegotiationRecord[];
  proofNotes?: string;
  alertHistory?: AlertLogRecord[];
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
  yellow:  'bg-amber-100/95 border-amber-300 text-amber-950 shadow-amber-200/50',
  blue:    'bg-sky-100/95 border-sky-300 text-sky-950 shadow-sky-200/50',
  emerald: 'bg-emerald-100/95 border-emerald-300 text-emerald-950 shadow-emerald-200/50',
  purple:  'bg-purple-100/95 border-purple-300 text-purple-950 shadow-purple-200/50',
  rose:    'bg-rose-100/95 border-rose-300 text-rose-950 shadow-rose-200/50',
};

// ── Standard Lucide Icon Renderer for Worksets (No Emojis) ────────────────────
const renderWorksetIcon = (iconName?: string, className = 'w-3.5 h-3.5') => {
  switch (iconName) {
    case 'Briefcase': return <Briefcase className={className} />;
    case 'BookOpen': return <BookOpen className={className} />;
    case 'Code': return <Code className={className} />;
    case 'Home': return <Home className={className} />;
    case 'Bookmark': return <Bookmark className={className} />;
    case 'Sparkles': return <Sparkles className={className} />;
    case 'Layers': return <Layers className={className} />;
    default: return <Folder className={className} />;
  }
};

const AVAILABLE_WORKSET_ICONS = [
  'Folder', 'Briefcase', 'BookOpen', 'Code', 'Home', 'Bookmark', 'Sparkles', 'Layers'
];

export const Todos: React.FC<TodosProps> = ({ 
  authToken, 
  todos, 
  onTodosChange,
  isBoardPrivate = false,
  onBoardPrivacyChange
}) => {
  // ── Pillar Tab Navigation ──────────────────────────────────────────────────
  const getInitialPillar = (): 'whiteboard' | 'karya' | 'pratigya' => {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('pillar');
      if (p === 'karya' || p === 'pratigya' || p === 'whiteboard') return p;
    } catch {}
    return 'whiteboard';
  };

  const [activePillar, setActivePillar] = useState<'whiteboard' | 'karya' | 'pratigya'>(getInitialPillar);

  const switchPillar = (pillar: 'whiteboard' | 'karya' | 'pratigya') => {
    setActivePillar(pillar);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('pillar', pillar);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const isLoggedIn = !!authToken;

  // ── Ecosystem State ────────────────────────────────────────────────────────
  const [worksets, setWorksets] = useState<TaskWorkset[]>([]);
  const [tasks, setTasks] = useState<KaryaTask[]>([]);
  const [commitments, setCommitments] = useState<PratigyaCommitment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // ── Fetch Full Ecosystem ───────────────────────────────────────────────────
  const loadEcosystemData = useCallback(async () => {
    try {
      setIsLoading(true);
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;

      const res = await fetch('/api/todos', { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        if (Array.isArray(data.whiteboard || data.todos)) {
          onTodosChange(data.whiteboard || data.todos);
        }
        if (Array.isArray(data.worksets)) setWorksets(data.worksets);
        if (Array.isArray(data.tasks)) setTasks(data.tasks);
        if (Array.isArray(data.commitments)) setCommitments(data.commitments);
      }
    } catch (err) {
      console.error('Failed to load ecosystem data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authToken, onTodosChange]);

  useEffect(() => {
    loadEcosystemData();
  }, [loadEcosystemData]);

  // ───────────────────────────────────────────────────────────────────────────
  // ── PILLAR 1: WHITEBOARD (CHITRA-PATRA) ───────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  // Restores original top-level viewMode: 'whiteboard' (pastel cards) vs 'list' (flat list)
  const [whiteboardViewMode, setWhiteboardViewMode] = useState<'whiteboard' | 'list'>('whiteboard');
  const [canvasLayout, setCanvasLayout] = useState<'canvas' | 'grid'>('canvas');
  const [newWhiteboardText, setNewWhiteboardText] = useState('');
  const [newWhiteboardColor, setNewWhiteboardColor] = useState<WhiteboardNote['color']>('yellow');
  const [newWhiteboardPrivate, setNewWhiteboardPrivate] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  // Canvas dragging
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Promote Modal
  const [promotingNote, setPromotingNote] = useState<WhiteboardNote | null>(null);
  const [promoteMode, setPromoteMode] = useState<'task' | 'pratigya' | null>(null);
  const [promoteWorksetId, setPromoteWorksetId] = useState('work');
  const [promotePriority, setPromotePriority] = useState<TaskPriority>('p2');
  const [promoteDueDate, setPromoteDueDate] = useState('');
  const [promoteRecipient, setPromoteRecipient] = useState('');
  const [promoteDeadline, setPromoteDeadline] = useState('');
  const [promoteUrgency, setPromoteUrgency] = useState<CommitmentUrgency>('standard');

  const visibleWhiteboardNotes = useMemo(() => {
    return todos.filter(item => {
      if (!isLoggedIn && (isBoardPrivate || item.isPrivate)) return false;
      return true;
    });
  }, [todos, isLoggedIn, isBoardPrivate]);

  const handleAddWhiteboardNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhiteboardText.trim()) return;

    const randomX = Math.floor(Math.random() * 260) + 20;
    const randomY = Math.floor(Math.random() * 200) + 20;

    const newItem: WhiteboardNote = {
      id: Date.now().toString(),
      text: newWhiteboardText.trim(),
      completed: false,
      isPrivate: newWhiteboardPrivate,
      color: newWhiteboardColor,
      x: randomX,
      y: randomY,
      createdAt: new Date().toLocaleDateString()
    };

    onTodosChange([newItem, ...todos]);
    setNewWhiteboardText('');
    setNewWhiteboardPrivate(false);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch('/api/todos/whiteboard', {
      method: 'POST',
      headers,
      body: JSON.stringify(newItem)
    }).catch(console.error);
  };

  const handleToggleWhiteboardComplete = (id: string) => {
    const target = todos.find(t => t.id === id);
    if (!target) return;
    const updatedCompleted = !target.completed;
    const updated = todos.map(t => t.id === id ? { ...t, completed: updatedCompleted } : t);
    onTodosChange(updated);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch(`/api/todos/whiteboard/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ completed: updatedCompleted })
    }).catch(console.error);
  };

  const handleToggleWhiteboardPrivacy = (id: string) => {
    if (!isLoggedIn) return;
    const target = todos.find(t => t.id === id);
    if (!target) return;
    const updatedPrivate = !target.isPrivate;
    const updated = todos.map(t => t.id === id ? { ...t, isPrivate: updatedPrivate } : t);
    onTodosChange(updated);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch(`/api/todos/whiteboard/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ isPrivate: updatedPrivate })
    }).catch(console.error);
  };

  const handleDeleteWhiteboardNote = (id: string) => {
    if (window.confirm('Delete this task?')) {
      onTodosChange(todos.filter(t => t.id !== id));
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;
      fetch(`/api/todos/whiteboard/${id}`, { method: 'DELETE', headers }).catch(console.error);
    }
  };

  const handleSaveWhiteboardEdit = (id: string) => {
    if (!editNoteText.trim()) return;
    const updated = todos.map(t => t.id === id ? { ...t, text: editNoteText.trim() } : t);
    onTodosChange(updated);
    setEditingNoteId(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch(`/api/todos/whiteboard/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ text: editNoteText.trim() })
    }).catch(console.error);
  };

  // Canvas Mouse Dragging
  const handleMouseDownOnNote = (e: React.MouseEvent, note: WhiteboardNote) => {
    if (canvasLayout !== 'canvas' || !isLoggedIn) return;
    const cardEl = (e.target as HTMLElement).closest('.draggable-sticky');
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    setDraggingNoteId(note.id);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingNoteId || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(10, Math.min(canvasRect.width - 240, e.clientX - canvasRect.left - dragOffset.x));
    const newY = Math.max(10, Math.min(canvasRect.height - 180, e.clientY - canvasRect.top - dragOffset.y));

    onTodosChange(todos.map(t => t.id === draggingNoteId ? { ...t, x: Math.round(newX), y: Math.round(newY) } : t));
  };

  const handleCanvasMouseUp = () => {
    if (!draggingNoteId) return;
    const target = todos.find(t => t.id === draggingNoteId);
    if (target) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;
      fetch(`/api/todos/whiteboard/${target.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ x: target.x, y: target.y })
      }).catch(console.error);
    }
    setDraggingNoteId(null);
  };

  // Promotion
  const executePromoteToTask = async () => {
    if (!promotingNote) return;
    const newTaskPayload: KaryaTask = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      worksetId: promoteWorksetId,
      title: promotingNote.text,
      notes: `Promoted from Whiteboard note on ${new Date().toLocaleDateString()}`,
      dueDate: promoteDueDate || null,
      priority: promotePriority,
      subtasks: [],
      tags: ['promoted'],
      completed: false,
      createdAt: new Date().toISOString()
    };

    setTasks(prev => [newTaskPayload, ...prev]);
    showToast('Promoted sticky note to Task');
    setPromotingNote(null);
    setPromoteMode(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch('/api/todos/tasks', {
      method: 'POST',
      headers,
      body: JSON.stringify(newTaskPayload)
    }).catch(console.error);
  };

  const executePromoteToPratigya = async () => {
    if (!promotingNote || !promoteRecipient.trim() || !promoteDeadline) {
      alert('Recipient name and deadline are required.');
      return;
    }
    const newCommitmentPayload: PratigyaCommitment = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      title: promotingNote.text,
      recipientName: promoteRecipient.trim(),
      deadline: new Date(promoteDeadline).toISOString(),
      urgency: promoteUrgency,
      description: `Promoted from Whiteboard note: "${promotingNote.text}"`,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setCommitments(prev => [newCommitmentPayload, ...prev]);
    showToast('Recorded as Pratigya covenant');
    setPromotingNote(null);
    setPromoteMode(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch('/api/todos/commitments', {
      method: 'POST',
      headers,
      body: JSON.stringify(newCommitmentPayload)
    }).catch(console.error);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ── PILLAR 2: TASKS & WORKSETS (KĀRYA) ────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  const [selectedWorksetId, setSelectedWorksetId] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'all' | 'p1' | 'p2' | 'p3'>('all');
  const [taskSearch, setTaskSearch] = useState('');

  // Simple, Responsive, Idempotent Task Creation State
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [extraTaskWorkset, setExtraTaskWorkset] = useState('work');
  const [extraTaskPriority, setExtraTaskPriority] = useState<TaskPriority>('p3');
  const [extraTaskDueDate, setExtraTaskDueDate] = useState('');
  const [extraTaskNotes, setExtraTaskNotes] = useState('');
  const [extraSubtasks, setExtraSubtasks] = useState<string[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Worksets Management Modal
  const [isWorksetsModalOpen, setIsWorksetsModalOpen] = useState(false);
  const [newWorksetTitle, setNewWorksetTitle] = useState('');
  const [newWorksetIcon, setNewWorksetIcon] = useState('Folder');
  const [newWorksetColor, setNewWorksetColor] = useState('blue');

  const currentWorksetName = useMemo(() => {
    if (selectedWorksetId === 'all') return 'All Tasks';
    const found = worksets.find(w => w.id === selectedWorksetId);
    return found ? found.title : 'Workset';
  }, [selectedWorksetId, worksets]);

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return tasks.filter(t => {
      if (selectedWorksetId !== 'all' && t.worksetId !== selectedWorksetId) return false;
      if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) return false;
      if (taskSearch.trim() && !t.title.toLowerCase().includes(taskSearch.toLowerCase())) return false;

      if (taskFilter === 'completed') return t.completed;
      if (taskFilter === 'all') return true;
      if (t.completed) return false;

      const taskDate = t.dueDate ? t.dueDate.slice(0, 10) : null;
      if (taskFilter === 'today') return taskDate === todayStr;
      if (taskFilter === 'upcoming') return taskDate && taskDate >= todayStr && taskDate <= sevenDaysLater;
      if (taskFilter === 'overdue') return taskDate && taskDate < todayStr;
      return true;
    });
  }, [tasks, selectedWorksetId, taskPriorityFilter, taskSearch, taskFilter]);

  // Idempotent & Instant Task Creation Handler
  const handleQuickCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = quickTaskTitle.trim();
    if (!trimmedTitle || isSubmittingTask) return;

    setIsSubmittingTask(true);

    const clientTaskId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    const targetWorkset = selectedWorksetId === 'all' 
      ? (isTaskDetailsOpen ? extraTaskWorkset : (worksets[0]?.id || 'work'))
      : selectedWorksetId;

    const subtasksPayload: SubTask[] = extraSubtasks.map(s => ({
      id: Math.random().toString(36).substring(2, 9),
      text: s,
      completed: false
    }));

    const newTask: KaryaTask = {
      id: clientTaskId,
      worksetId: targetWorkset,
      title: trimmedTitle,
      notes: isTaskDetailsOpen ? extraTaskNotes.trim() : '',
      dueDate: (isTaskDetailsOpen && extraTaskDueDate) ? extraTaskDueDate : null,
      priority: isTaskDetailsOpen ? extraTaskPriority : 'p3',
      subtasks: subtasksPayload,
      tags: [],
      completed: false,
      createdAt: new Date().toISOString()
    };

    // 0ms Optimistic UI Update: immediately clears input and adds task to list
    setTasks(prev => [newTask, ...prev]);
    setQuickTaskTitle('');
    if (isTaskDetailsOpen) {
      setIsTaskDetailsOpen(false);
      setExtraTaskNotes('');
      setExtraTaskDueDate('');
      setExtraSubtasks([]);
      setExtraTaskPriority('p3');
    }
    showToast('Task added');

    // Async persistence in background
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['X-Session-Token'] = authToken;

      await fetch('/api/todos/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(newTask)
      });
    } catch (err) {
      console.error('Task persistence error:', err);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleToggleTaskComplete = (id: string) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;
    const nextCompleted = !target.completed;
    const updated = tasks.map(t => t.id === id ? { 
      ...t, 
      completed: nextCompleted, 
      completedAt: nextCompleted ? new Date().toISOString() : null 
    } : t);
    setTasks(updated);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch(`/api/todos/tasks/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ completed: nextCompleted })
    }).catch(console.error);
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;
    const updatedSubtasks = targetTask.subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
    const updated = tasks.map(t => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t);
    setTasks(updated);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch(`/api/todos/tasks/${taskId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ subtasks: updatedSubtasks })
    }).catch(console.error);
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    const headers: Record<string, string> = {};
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch(`/api/todos/tasks/${id}`, { method: 'DELETE', headers }).catch(console.error);
  };

  const handleClearCompletedTasks = () => {
    if (!window.confirm('Clear all completed tasks?')) return;
    setTasks(prev => prev.filter(t => !t.completed));
    const headers: Record<string, string> = {};
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch('/api/todos/tasks/completed', { method: 'DELETE', headers }).catch(console.error);
    showToast('Completed tasks cleared');
  };

  // Worksets CRUD & Deletion
  const handleCreateWorkset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorksetTitle.trim()) return;

    const payload = {
      title: newWorksetTitle.trim(),
      icon: newWorksetIcon || 'Folder',
      color: newWorksetColor || 'blue'
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    try {
      const res = await fetch('/api/todos/worksets', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setWorksets(prev => [...prev, data.workset]);
        setSelectedWorksetId(data.workset.id);
        setNewWorksetTitle('');
        showToast(`Workset "${data.workset.title}" created`);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to create workset', 'error');
    }
  };

  const handleDeleteWorkset = async (worksetId: string) => {
    const target = worksets.find(w => w.id === worksetId);
    if (!target) return;
    if (!window.confirm(`Delete workset "${target.title}"? Tasks will be moved to the default workset.`)) return;

    const headers: Record<string, string> = {};
    if (authToken) headers['X-Session-Token'] = authToken;

    try {
      const res = await fetch(`/api/todos/worksets/${worksetId}`, { method: 'DELETE', headers });
      if (res.ok) {
        setWorksets(prev => prev.filter(w => w.id !== worksetId));
        setTasks(prev => prev.map(t => t.worksetId === worksetId ? { ...t, worksetId: 'work' } : t));
        if (selectedWorksetId === worksetId) {
          setSelectedWorksetId('all');
        }
        showToast(`Workset "${target.title}" deleted`);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to delete workset', 'error');
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ── PILLAR 3: PRATIGYA (COVENANT LEDGER) ──────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  const [pratigyaFilter, setPratigyaFilter] = useState<'all' | 'active' | 'sacred' | 'overdue' | 'honored' | 'renegotiated'>('all');
  const [isNewCommitmentModalOpen, setIsNewCommitmentModalOpen] = useState(false);
  const [newCommitmentTitle, setNewCommitmentTitle] = useState('');
  const [newCommitmentRecipient, setNewCommitmentRecipient] = useState('');
  const [newCommitmentContact, setNewCommitmentContact] = useState('');
  const [newCommitmentDeadline, setNewCommitmentDeadline] = useState('');
  const [newCommitmentUrgency, setNewCommitmentUrgency] = useState<CommitmentUrgency>('sacred');
  const [newCommitmentDesc, setNewCommitmentDesc] = useState('');

  // Honor Modal
  const [honoringCommitment, setHonoringCommitment] = useState<PratigyaCommitment | null>(null);
  const [honorProofNotes, setHonorProofNotes] = useState('');

  // Renegotiate Modal
  const [renegotiatingCommitment, setRenegotiatingCommitment] = useState<PratigyaCommitment | null>(null);
  const [renegotiateNewDeadline, setRenegotiateNewDeadline] = useState('');
  const [renegotiateReason, setRenegotiateReason] = useState('');

  const filteredCommitments = useMemo(() => {
    const now = new Date().getTime();
    return commitments.filter(c => {
      const deadlineMs = new Date(c.deadline).getTime();
      const isPast = deadlineMs <= now;

      if (pratigyaFilter === 'all') return true;
      if (pratigyaFilter === 'honored') return c.status === 'honored';
      if (pratigyaFilter === 'renegotiated') return c.status === 'renegotiated';
      if (pratigyaFilter === 'sacred') return c.urgency === 'sacred';
      if (pratigyaFilter === 'overdue') return (c.status === 'active' || c.status === 'breached') && isPast;
      if (pratigyaFilter === 'active') return c.status === 'active' || c.status === 'renegotiated';
      return true;
    });
  }, [commitments, pratigyaFilter]);

  const pratigyaStats = useMemo(() => {
    const now = new Date().getTime();
    let total = commitments.length;
    let active = 0;
    let honored = 0;
    let overdue = 0;
    let sacred = 0;

    commitments.forEach(c => {
      if (c.status === 'honored') honored++;
      else {
        active++;
        if (new Date(c.deadline).getTime() <= now) overdue++;
      }
      if (c.urgency === 'sacred') sacred++;
    });

    return { total, active, honored, overdue, sacred };
  }, [commitments]);

  const handleCreateCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommitmentTitle.trim() || !newCommitmentRecipient.trim() || !newCommitmentDeadline) {
      alert('Title, recipient name, and deadline are required.');
      return;
    }

    const payload: PratigyaCommitment = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      title: newCommitmentTitle.trim(),
      recipientName: newCommitmentRecipient.trim(),
      recipientContact: newCommitmentContact.trim(),
      deadline: new Date(newCommitmentDeadline).toISOString(),
      urgency: newCommitmentUrgency,
      description: newCommitmentDesc.trim(),
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setCommitments(prev => [payload, ...prev]);
    setIsNewCommitmentModalOpen(false);
    setNewCommitmentTitle('');
    setNewCommitmentRecipient('');
    setNewCommitmentContact('');
    setNewCommitmentDeadline('');
    setNewCommitmentDesc('');
    showToast('Covenant recorded in Pratigya ledger');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch('/api/todos/commitments', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }).catch(console.error);
  };

  const handleExecuteHonor = async () => {
    if (!honoringCommitment) return;
    const now = new Date().toISOString();
    setCommitments(prev => prev.map(c => c.id === honoringCommitment.id ? {
      ...c,
      status: 'honored',
      fulfilledAt: now,
      proofNotes: honorProofNotes.trim()
    } : c));

    const id = honoringCommitment.id;
    const notes = honorProofNotes.trim();
    setHonoringCommitment(null);
    setHonorProofNotes('');
    showToast('Word honored and fulfilled');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch(`/api/todos/commitments/${id}/honor`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ proofNotes: notes })
    }).catch(console.error);
  };

  const handleExecuteRenegotiate = async () => {
    if (!renegotiatingCommitment || !renegotiateNewDeadline || !renegotiateReason.trim()) {
      alert('New deadline and justification reason are required.');
      return;
    }

    const renegRecord: RenegotiationRecord = {
      previousDeadline: renegotiatingCommitment.deadline,
      newDeadline: new Date(renegotiateNewDeadline).toISOString(),
      reason: renegotiateReason.trim(),
      timestamp: new Date().toISOString()
    };

    setCommitments(prev => prev.map(c => c.id === renegotiatingCommitment.id ? {
      ...c,
      deadline: renegRecord.newDeadline,
      status: 'renegotiated',
      renegotiationHistory: [...(c.renegotiationHistory || []), renegRecord]
    } : c));

    const id = renegotiatingCommitment.id;
    setRenegotiatingCommitment(null);
    setRenegotiateNewDeadline('');
    setRenegotiateReason('');
    showToast('Commitment renegotiated with documented justification');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch(`/api/todos/commitments/${id}/renegotiate`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        newDeadline: renegRecord.newDeadline,
        reason: renegRecord.reason
      })
    }).catch(console.error);
  };

  const handleDeleteCommitment = (id: string) => {
    if (window.confirm('Delete this commitment from the Pratigya ledger?')) {
      setCommitments(prev => prev.filter(c => c.id !== id));
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;
      fetch(`/api/todos/commitments/${id}`, { method: 'DELETE', headers }).catch(console.error);
    }
  };

  const getCommitmentTiming = (deadlineStr: string) => {
    const now = new Date().getTime();
    const dTime = new Date(deadlineStr).getTime();
    const diff = dTime - now;
    const isPast = diff <= 0;

    const absMs = Math.abs(diff);
    const hours = Math.floor(absMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const mins = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));

    let label = '';
    if (isPast) {
      label = days > 0 ? `Overdue by ${days}d ${hours % 24}h` : `Overdue by ${hours}h ${mins}m`;
    } else {
      label = days > 0 ? `${days}d ${hours % 24}h remaining` : `${hours}h ${mins}m remaining`;
    }

    return { isPast, label };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ── RENDER ────────────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  if (!isLoggedIn && isBoardPrivate) {
    return (
      <div className="max-w-md mx-auto my-20 bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Private Todo & Commitment Vault</h3>
        <p className="text-xs text-slate-500">This board has been locked as private by the owner.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none animate-fade-in pb-12">
      
      {/* Toast Notification */}
      {feedbackToast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg border flex items-center gap-2 animate-fade-in ${
          feedbackToast.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-slate-900 text-white border-slate-800'
        }`}>
          {feedbackToast.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-500" /> : <Check className="w-4 h-4 text-blue-400" />}
          {feedbackToast.message}
        </div>
      )}

      {/* ── Top Header & Ecosystem Bar ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-blue-600 text-xs font-extrabold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            Task Management & Word Ledger
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Todos
            <span className="text-sm font-normal text-slate-500 font-serif">
              (Whiteboard, Tasks & Pratigya)
            </span>
            {isBoardPrivate && (
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Private Board
              </span>
            )}
          </h1>
        </div>

        {/* ── Three-Pillar Tab Switcher ── */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => switchPillar('whiteboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activePillar === 'whiteboard'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Whiteboard</span>
          </button>

          <button
            onClick={() => switchPillar('karya')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activePillar === 'karya'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Tasks & Worksets</span>
          </button>

          <button
            onClick={() => switchPillar('pratigya')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activePillar === 'pratigya'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Pratigya</span>
          </button>
        </div>

        {/* Board Level Actions */}
        <div className="flex items-center gap-2">
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
              {isBoardPrivate ? 'Private' : 'Public'}
            </button>
          )}

          <button
            onClick={loadEcosystemData}
            disabled={isLoading}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* ── PILLAR 1: WHITEBOARD (CHITRA-PATRA) ────────────────────────────── */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activePillar === 'whiteboard' && (
        <div className="space-y-5 animate-fade-in">
          {/* Top Control Bar: Switches between Whiteboard Pastel Canvas & Flat List View */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">View:</span>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setWhiteboardViewMode('whiteboard')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      whiteboardViewMode === 'whiteboard' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Whiteboard
                  </button>
                  <button
                    onClick={() => setWhiteboardViewMode('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      whiteboardViewMode === 'list' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    Flat List
                  </button>
                </div>

                {whiteboardViewMode === 'whiteboard' && (
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 ml-2">
                    <button
                      onClick={() => setCanvasLayout('canvas')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                        canvasLayout === 'canvas' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Freeform
                    </button>
                    <button
                      onClick={() => setCanvasLayout('grid')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                        canvasLayout === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Grid
                    </button>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500 font-medium">
                {visibleWhiteboardNotes.length} notes
              </div>
            </div>

            {/* Quick Add Sticky Note (Logged-in only) */}
            {isLoggedIn && (
              <form onSubmit={handleAddWhiteboardNote} className="flex flex-col md:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="Add a new task or sticky note..."
                  value={newWhiteboardText}
                  onChange={e => setNewWhiteboardText(e.target.value)}
                  className="flex-1 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                  {/* Color Selector for Whiteboard Mode */}
                  {whiteboardViewMode === 'whiteboard' && (
                    <div className="flex gap-1.5">
                      {(['yellow', 'blue', 'emerald', 'purple', 'rose'] as const).map(color => (
                        <button
                          type="button"
                          key={color}
                          onClick={() => setNewWhiteboardColor(color)}
                          className={`w-6 h-6 rounded-full border-2 transition ${
                            newWhiteboardColor === color ? 'border-slate-800 scale-110 shadow-sm' : 'border-transparent'
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

                  {/* Privacy Toggle */}
                  <button
                    type="button"
                    onClick={() => setNewWhiteboardPrivate(!newWhiteboardPrivate)}
                    className={`p-2 rounded-xl border transition ${
                      newWhiteboardPrivate ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                    title={newWhiteboardPrivate ? 'Private Task' : 'Public Task'}
                  >
                    {newWhiteboardPrivate ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4" />}
                  </button>

                  <button
                    type="submit"
                    disabled={!newWhiteboardText.trim()}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition shadow-md shrink-0 flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add Entry
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── View Mode 1: Aesthetic Whiteboard Canvas ── */}
          {whiteboardViewMode === 'whiteboard' && (
            canvasLayout === 'canvas' ? (
              <div
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className="relative min-h-[580px] bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-hidden shadow-xl bg-[radial-gradient(#334155_1.5px,transparent_1.5px)] [background-size:24px_24px]"
              >
                <div className="absolute top-4 right-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest pointer-events-none">
                  Aesthetic Whiteboard Canvas
                </div>

                {visibleWhiteboardNotes.length > 0 ? (
                  visibleWhiteboardNotes.map(t => {
                    const colorClass = PASTEL_COLORS[t.color || 'yellow'];
                    const isEditing = editingNoteId === t.id;
                    const isDragging = draggingNoteId === t.id;

                    return (
                      <div
                        key={t.id}
                        onMouseDown={(e) => handleMouseDownOnNote(e, t)}
                        style={{
                          position: 'absolute',
                          left: `${t.x ?? 40}px`,
                          top: `${t.y ?? 40}px`,
                          width: '240px',
                          zIndex: isDragging ? 40 : 10
                        }}
                        className={`draggable-sticky p-4 rounded-2xl border-2 ${colorClass} cursor-grab active:cursor-grabbing select-none transition-shadow ${
                          isDragging ? 'shadow-2xl scale-105 opacity-90' : 'hover:shadow-lg'
                        } flex flex-col justify-between min-h-[160px] group`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-black/10">
                          <button
                            onClick={() => handleToggleWhiteboardComplete(t.id)}
                            className="text-slate-800 hover:opacity-80 transition"
                          >
                            {t.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </button>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            {isLoggedIn && (
                              <button
                                onClick={() => { setPromotingNote(t); setPromoteMode('task'); }}
                                className="p-1 rounded hover:bg-black/10 text-slate-700 transition"
                                title="Promote to Structured Task"
                              >
                                <MoveRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isLoggedIn && (
                              <button
                                onClick={() => { setPromotingNote(t); setPromoteMode('pratigya'); setPromoteRecipient(''); setPromoteDeadline(''); }}
                                className="p-1 rounded hover:bg-black/10 text-slate-700 transition"
                                title="Promote to Pratigya Covenant"
                              >
                                <Shield className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isLoggedIn && (
                              <button
                                onClick={() => handleToggleWhiteboardPrivacy(t.id)}
                                className="p-1 rounded hover:bg-black/10 transition"
                              >
                                {t.isPrivate ? <Lock className="w-3 h-3 text-amber-800" /> : <Unlock className="w-3 h-3 text-slate-500" />}
                              </button>
                            )}
                            {isLoggedIn && (
                              <button
                                onClick={() => { setEditingNoteId(t.id); setEditNoteText(t.text); }}
                                className="p-1 rounded hover:bg-black/10 text-slate-700 transition"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {isLoggedIn && (
                              <button
                                onClick={() => handleDeleteWhiteboardNote(t.id)}
                                className="p-1 rounded hover:bg-black/10 text-rose-700 transition"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="py-2 flex-1">
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editNoteText}
                                onChange={e => setEditNoteText(e.target.value)}
                                rows={3}
                                className="w-full p-2 text-xs font-semibold bg-white/90 rounded-lg border border-slate-300 focus:outline-none"
                              />
                              <button
                                onClick={() => handleSaveWhiteboardEdit(t.id)}
                                className="w-full py-1 bg-slate-900 text-white rounded text-[10px] font-bold"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <p className={`text-xs font-semibold leading-relaxed break-words ${t.completed ? 'line-through opacity-60' : ''}`}>
                              {t.text}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[9px] font-mono font-bold opacity-60 pt-2 border-t border-black/10">
                          <span>{t.createdAt}</span>
                          {t.isPrivate && <span className="uppercase text-amber-800">Private</span>}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
                    <Sparkles className="w-8 h-8 opacity-40" />
                    <p className="text-xs font-semibold">Whiteboard is clean</p>
                  </div>
                )}
              </div>
            ) : (
              /* Grid Layout */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {visibleWhiteboardNotes.map(t => {
                  const colorClass = PASTEL_COLORS[t.color || 'yellow'];
                  const isEditing = editingNoteId === t.id;

                  return (
                    <div
                      key={t.id}
                      className={`relative p-5 rounded-2xl border-2 ${colorClass} transition-all duration-200 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between min-h-[160px] group`}
                    >
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/10">
                        <button
                          onClick={() => handleToggleWhiteboardComplete(t.id)}
                          className="text-slate-800 hover:opacity-80 transition"
                        >
                          {t.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          {isLoggedIn && (
                            <button
                              onClick={() => { setPromotingNote(t); setPromoteMode('task'); }}
                              className="p-1 rounded hover:bg-black/10 text-slate-700 transition"
                              title="Promote to Task"
                            >
                              <MoveRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isLoggedIn && (
                            <button
                              onClick={() => { setPromotingNote(t); setPromoteMode('pratigya'); setPromoteRecipient(''); setPromoteDeadline(''); }}
                              className="p-1 rounded hover:bg-black/10 text-slate-700 transition"
                              title="Promote to Pratigya"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isLoggedIn && (
                            <button
                              onClick={() => handleToggleWhiteboardPrivacy(t.id)}
                              className="p-1 rounded hover:bg-black/10 transition"
                            >
                              {t.isPrivate ? <Lock className="w-3 h-3 text-amber-800" /> : <Unlock className="w-3 h-3 text-slate-500" />}
                            </button>
                          )}
                          {isLoggedIn && (
                            <button
                              onClick={() => { setEditingNoteId(t.id); setEditNoteText(t.text); }}
                              className="p-1 rounded hover:bg-black/10 text-slate-700 transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isLoggedIn && (
                            <button
                              onClick={() => handleDeleteWhiteboardNote(t.id)}
                              className="p-1 rounded hover:bg-black/10 text-rose-700 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="py-2 flex-1">
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editNoteText}
                              onChange={e => setEditNoteText(e.target.value)}
                              rows={3}
                              className="w-full p-2 text-xs font-semibold bg-white/90 rounded-lg border border-slate-300 focus:outline-none"
                            />
                            <button
                              onClick={() => handleSaveWhiteboardEdit(t.id)}
                              className="w-full py-1 bg-slate-900 text-white rounded text-[10px] font-bold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className={`text-xs font-semibold leading-relaxed break-words ${t.completed ? 'line-through opacity-60' : ''}`}>
                            {t.text}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[9px] font-mono font-bold opacity-60 pt-2 border-t border-black/10">
                        <span>{t.createdAt}</span>
                        {t.isPrivate && <span className="uppercase text-amber-800">Private</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── View Mode 2: Restored Flat List View ── */}
          {whiteboardViewMode === 'list' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
              {visibleWhiteboardNotes.length > 0 ? (
                visibleWhiteboardNotes.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl transition group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => handleToggleWhiteboardComplete(t.id)}
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
                          onClick={() => { setPromotingNote(t); setPromoteMode('task'); }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white"
                          title="Promote to Task"
                        >
                          <MoveRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setPromotingNote(t); setPromoteMode('pratigya'); setPromoteRecipient(''); setPromoteDeadline(''); }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white"
                          title="Promote to Pratigya"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleWhiteboardPrivacy(t.id)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-white"
                          title={t.isPrivate ? 'Private' : 'Public'}
                        >
                          {t.isPrivate ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteWhiteboardNote(t.id)}
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

          {/* ── Promote Modal ── */}
          {promotingNote && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    Promote Note: "{promotingNote.text.slice(0, 30)}..."
                  </div>
                  <button onClick={() => setPromotingNote(null)} className="text-slate-400 hover:text-slate-700">✕</button>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setPromoteMode('task')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      promoteMode === 'task' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    To Task
                  </button>
                  <button
                    onClick={() => setPromoteMode('pratigya')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      promoteMode === 'pratigya' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    To Pratigya Covenant
                  </button>
                </div>

                {promoteMode === 'task' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Target Workset</label>
                      <select
                        value={promoteWorksetId}
                        onChange={e => setPromoteWorksetId(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      >
                        {worksets.map(w => (
                          <option key={w.id} value={w.id}>{w.title}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700">Priority</label>
                        <select
                          value={promotePriority}
                          onChange={e => setPromotePriority(e.target.value as TaskPriority)}
                          className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        >
                          <option value="p1">P1 (Urgent)</option>
                          <option value="p2">P2 (High)</option>
                          <option value="p3">P3 (Normal)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700">Due Date (Optional)</label>
                        <input
                          type="date"
                          value={promoteDueDate}
                          onChange={e => setPromoteDueDate(e.target.value)}
                          className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                    </div>

                    <button
                      onClick={executePromoteToTask}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md"
                    >
                      Promote to Task
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Word Given To (Recipient Name) *</label>
                      <input
                        type="text"
                        placeholder="e.g. Prof. Sharma, Mom, Alex..."
                        value={promoteRecipient}
                        onChange={e => setPromoteRecipient(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700">Urgency Tier</label>
                        <select
                          value={promoteUrgency}
                          onChange={e => setPromoteUrgency(e.target.value as CommitmentUrgency)}
                          className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        >
                          <option value="sacred">Sacred (Critical Word)</option>
                          <option value="high">High</option>
                          <option value="standard">Standard</option>
                          <option value="flexible">Flexible</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700">Deadline (Date & Time) *</label>
                        <input
                          type="datetime-local"
                          value={promoteDeadline}
                          onChange={e => setPromoteDeadline(e.target.value)}
                          className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                    </div>

                    <button
                      onClick={executePromoteToPratigya}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md"
                    >
                      Record in Pratigya
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* ── PILLAR 2: TASKS & WORKSETS (KĀRYA) ──────────────────────────────── */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activePillar === 'karya' && (
        <div className="space-y-6 animate-fade-in">
          {/* Workset Selector & Management Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Common Board Tab */}
              <button
                onClick={() => setSelectedWorksetId('all')}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition border ${
                  selectedWorksetId === 'all'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Tasks</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-md">
                  {tasks.filter(t => !t.completed).length}
                </span>
              </button>

              {/* Individual Worksets */}
              {worksets.map(w => {
                const isSelected = selectedWorksetId === w.id;
                const count = tasks.filter(t => t.worksetId === w.id && !t.completed).length;

                return (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWorksetId(w.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition border ${
                      isSelected
                        ? 'bg-blue-50 text-blue-800 border-blue-200 shadow-sm ring-2 ring-blue-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {renderWorksetIcon(w.icon)}
                    <span>{w.title}</span>
                    {count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Manage Worksets Button */}
              {isLoggedIn && (
                <button
                  onClick={() => setIsWorksetsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
                  title="Manage and create worksets"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Worksets</span>
                </button>
              )}
            </div>

            {/* Clear Completed Tasks Button */}
            {isLoggedIn && tasks.some(t => t.completed) && (
              <button
                onClick={handleClearCompletedTasks}
                className="text-xs font-bold text-slate-400 hover:text-red-600 transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Completed
              </button>
            )}
          </div>

          {/* ── Simple, Responsive & Idempotent Task Creation Bar ── */}
          {isLoggedIn && (
            <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
              <form onSubmit={handleQuickCreateTask} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                
                <input
                  type="text"
                  placeholder={`Add a task to ${currentWorksetName}... (Press Enter)`}
                  value={quickTaskTitle}
                  onChange={e => setQuickTaskTitle(e.target.value)}
                  disabled={isSubmittingTask}
                  className="flex-1 text-sm font-medium text-slate-900 bg-transparent focus:outline-none placeholder-slate-400"
                />

                <button
                  type="button"
                  onClick={() => setIsTaskDetailsOpen(!isTaskDetailsOpen)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 shrink-0 ${
                    isTaskDetailsOpen 
                      ? 'bg-slate-100 text-slate-900 border-slate-300' 
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Toggle additional details (due date, priority, notes)"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Options</span>
                </button>

                <button
                  type="submit"
                  disabled={!quickTaskTitle.trim() || isSubmittingTask}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition shadow-sm shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>

              {/* Extended Form Tray (Opens only when Options button is explicitly clicked) */}
              {isTaskDetailsOpen && (
                <div className="pt-3 border-t border-slate-100 space-y-3 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Workset Selector */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Target Workset</label>
                      <select
                        value={selectedWorksetId === 'all' ? extraTaskWorkset : selectedWorksetId}
                        onChange={e => setExtraTaskWorkset(e.target.value)}
                        className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      >
                        {worksets.map(w => (
                          <option key={w.id} value={w.id}>{w.title}</option>
                        ))}
                      </select>
                    </div>

                    {/* Due Date */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Due Date</label>
                      <input
                        type="date"
                        value={extraTaskDueDate}
                        onChange={e => setExtraTaskDueDate(e.target.value)}
                        className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>

                    {/* Priority Selector */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Priority</label>
                      <select
                        value={extraTaskPriority}
                        onChange={e => setExtraTaskPriority(e.target.value as TaskPriority)}
                        className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      >
                        <option value="p1">P1 (Urgent)</option>
                        <option value="p2">P2 (High)</option>
                        <option value="p3">P3 (Normal)</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes Field */}
                  <div>
                    <input
                      type="text"
                      placeholder="Add notes, instructions, or links..."
                      value={extraTaskNotes}
                      onChange={e => setExtraTaskNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />
                  </div>

                  {/* Subtask / Checklist Builder */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add subtask checklist item..."
                        value={newSubtaskInput}
                        onChange={e => setNewSubtaskInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newSubtaskInput.trim()) {
                              setExtraSubtasks([...extraSubtasks, newSubtaskInput.trim()]);
                              setNewSubtaskInput('');
                            }
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newSubtaskInput.trim()) {
                            setExtraSubtasks([...extraSubtasks, newSubtaskInput.trim()]);
                            setNewSubtaskInput('');
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                      >
                        Add Subtask
                      </button>
                    </div>

                    {extraSubtasks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {extraSubtasks.map((st, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg font-medium">
                            <span>• {st}</span>
                            <button
                              type="button"
                              onClick={() => setExtraSubtasks(extraSubtasks.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-red-600 ml-1"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filter Chips & Search Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'today', 'upcoming', 'overdue', 'completed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTaskFilter(f)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition ${
                    taskFilter === f ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'upcoming' ? 'Upcoming (7d)' : f}
                </button>
              ))}

              <span className="text-slate-300 mx-1">|</span>

              {(['all', 'p1', 'p2', 'p3'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setTaskPriorityFilter(p)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold uppercase transition ${
                    taskPriorityFilter === p ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {p === 'all' ? 'All' : p}
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search tasks..."
                value={taskSearch}
                onChange={e => setTaskSearch(e.target.value)}
                className="w-full md:w-48 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Tasks List */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
            {filteredTasks.length > 0 ? (
              filteredTasks.map(t => {
                const parentWorkset = worksets.find(w => w.id === t.worksetId);
                const hasSubtasks = Array.isArray(t.subtasks) && t.subtasks.length > 0;
                const completedSubtasksCount = hasSubtasks ? t.subtasks.filter(s => s.completed).length : 0;
                const subtaskProgress = hasSubtasks ? Math.round((completedSubtasksCount / t.subtasks.length) * 100) : 0;

                const priorityBadge = 
                  t.priority === 'p1' ? 'bg-red-50 text-red-700 border-red-200' :
                  t.priority === 'p2' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-blue-50 text-blue-700 border-blue-200';

                return (
                  <div
                    key={t.id}
                    className={`p-4 rounded-2xl border transition group ${
                      t.completed ? 'bg-slate-50/60 border-slate-200/60 opacity-65' : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => handleToggleTaskComplete(t.id)}
                          className="mt-0.5 text-blue-600 hover:text-blue-700 transition shrink-0"
                        >
                          {t.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-400" />}
                        </button>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-sm font-bold text-slate-900 ${t.completed ? 'line-through text-slate-400' : ''}`}>
                              {t.title}
                            </span>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase ${priorityBadge}`}>
                              {t.priority}
                            </span>

                            {selectedWorksetId === 'all' && parentWorkset && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                {renderWorksetIcon(parentWorkset.icon)}
                                <span>{parentWorkset.title}</span>
                              </span>
                            )}

                            {t.dueDate && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{t.dueDate.slice(0, 10)}</span>
                              </span>
                            )}
                          </div>

                          {t.notes && (
                            <p className="text-xs text-slate-500 line-clamp-2">
                              {t.notes}
                            </p>
                          )}

                          {hasSubtasks && (
                            <div className="pt-2 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-xs">
                                  <div
                                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                    style={{ width: `${subtaskProgress}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {completedSubtasksCount}/{t.subtasks.length} subtasks
                                </span>
                              </div>

                              <div className="space-y-1 pl-1">
                                {t.subtasks.map(s => (
                                  <div
                                    key={s.id}
                                    onClick={() => handleToggleSubtask(t.id, s.id)}
                                    className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-slate-900"
                                  >
                                    {s.completed ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    ) : (
                                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                                    )}
                                    <span className={s.completed ? 'line-through text-slate-400' : ''}>
                                      {s.text}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {isLoggedIn && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                          <button
                            onClick={() => handleDeleteTask(t.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold space-y-2">
                <CheckSquare className="w-8 h-8 opacity-30 mx-auto" />
                <p>No tasks in this view.</p>
              </div>
            )}
          </div>

          {/* ── Worksets Management Modal with Delete & Creation Options ── */}
          {isWorksetsModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <FolderPlus className="w-5 h-5 text-blue-600" />
                    Manage Worksets
                  </div>
                  <button onClick={() => setIsWorksetsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Existing Worksets List */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Worksets</div>
                  {worksets.map(w => {
                    const taskCount = tasks.filter(t => t.worksetId === w.id).length;
                    const isDefault = ['work', 'research', 'dev', 'personal'].includes(w.id);

                    return (
                      <div key={w.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-700">
                            {renderWorksetIcon(w.icon)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{w.title}</div>
                            <div className="text-[10px] text-slate-500">{taskCount} tasks assigned</div>
                          </div>
                        </div>

                        {!isDefault && (
                          <button
                            onClick={() => handleDeleteWorkset(w.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white transition"
                            title="Delete Workset"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add New Workset Form */}
                <form onSubmit={handleCreateWorkset} className="space-y-4 pt-3 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Create New Workset</div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Deep Work, Reading, Finance..."
                      value={newWorksetTitle}
                      onChange={e => setNewWorksetTitle(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Icon</label>
                      <select
                        value={newWorksetIcon}
                        onChange={e => setNewWorksetIcon(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      >
                        {AVAILABLE_WORKSET_ICONS.map(ic => (
                          <option key={ic} value={ic}>{ic}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700">Color Badge</label>
                      <select
                        value={newWorksetColor}
                        onChange={e => setNewWorksetColor(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      >
                        <option value="blue">Blue</option>
                        <option value="purple">Purple</option>
                        <option value="emerald">Emerald</option>
                        <option value="amber">Amber</option>
                        <option value="rose">Rose</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!newWorksetTitle.trim()}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition shadow-md"
                  >
                    Save Workset
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* ── PILLAR 3: PRATIGYA (COVENANT LEDGER — HARMONIC THEME) ─────────── */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activePillar === 'pratigya' && (
        <div className="space-y-6 animate-fade-in">
          {/* Harmonic Canvas Header aligned with Shudkara's warm editorial palette */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>Sovereign Word & Integrity Ledger (प्रतिज्ञा)</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif tracking-tight">
              "रघुकुल रीत सदा चली आई, प्राण जाई पर वचन न जाई"
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Pratigya tracks commitments made to specific individuals. Guarded by the autonomous Caretaker alerting engine, ensuring promises are fulfilled or renegotiated with transparent justification.
            </p>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-100 text-center">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className="text-lg font-black text-slate-900">{pratigyaStats.total}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className="text-lg font-black text-blue-700">{pratigyaStats.active}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className="text-lg font-black text-amber-700">{pratigyaStats.sacred}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sacred</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className="text-lg font-black text-red-700">{pratigyaStats.overdue}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Overdue</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className="text-lg font-black text-emerald-700">{pratigyaStats.honored}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Honored</div>
              </div>
            </div>
          </div>

          {/* Pratigya Actions & Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'active', 'sacred', 'overdue', 'honored', 'renegotiated'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setPratigyaFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                    pratigyaFilter === f
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {isLoggedIn && (
              <button
                onClick={() => setIsNewCommitmentModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                <Award className="w-4 h-4" />
                <span>Record Commitment</span>
              </button>
            )}
          </div>

          {/* Commitments Feed */}
          <div className="space-y-4">
            {filteredCommitments.length > 0 ? (
              filteredCommitments.map(c => {
                const timing = getCommitmentTiming(c.deadline);
                const isHonored = c.status === 'honored';
                const isRenegotiated = c.status === 'renegotiated';
                const isBreached = timing.isPast && !isHonored;

                const cardBorder = 
                  isHonored ? 'border-emerald-300 bg-emerald-50/20' :
                  isBreached ? 'border-red-300 bg-red-50/20' :
                  c.urgency === 'sacred' ? 'border-amber-300 bg-amber-50/15' :
                  'border-slate-200 bg-white';

                const urgencyBadge = 
                  c.urgency === 'sacred' ? 'border-amber-300 bg-amber-50 text-amber-900' :
                  c.urgency === 'high' ? 'border-slate-300 bg-slate-100 text-slate-800' :
                  c.urgency === 'standard' ? 'border-slate-200 bg-slate-50 text-slate-700' :
                  'border-emerald-200 bg-emerald-50 text-emerald-800';

                return (
                  <div
                    key={c.id}
                    className={`rounded-3xl border-2 p-6 transition-all duration-200 shadow-xs ${cardBorder} space-y-4`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md border ${urgencyBadge}`}>
                          {c.urgency}
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                          isHonored ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          isBreached ? 'bg-red-50 text-red-800 border-red-200' :
                          isRenegotiated ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {isHonored ? 'Fulfilled' : isBreached ? 'Overdue Breach' : c.status}
                        </span>
                      </div>

                      <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                        isHonored ? 'bg-emerald-50 text-emerald-800' :
                        timing.isPast ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{isHonored ? `Honored ${c.fulfilledAt?.slice(0, 10)}` : timing.label}</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2">
                      <h3 className={`text-base font-bold text-slate-900 ${isHonored ? 'line-through text-slate-400' : ''}`}>
                        {c.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <User className="w-4 h-4 text-blue-600" />
                          <span>Given to:</span>
                          <span className="text-slate-900 font-bold">{c.recipientName}</span>
                        </div>
                        {c.recipientContact && (
                          <span className="text-slate-500">({c.recipientContact})</span>
                        )}
                        <span className="text-slate-300">•</span>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Deadline: {new Date(c.deadline).toLocaleString()}</span>
                        </div>
                      </div>

                      {c.description && (
                        <p className="text-xs text-slate-600 leading-relaxed pt-1">
                          {c.description}
                        </p>
                      )}

                      {c.proofNotes && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
                          <div className="font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Evidence & Fulfillment Notes:
                          </div>
                          <p>{c.proofNotes}</p>
                        </div>
                      )}

                      {Array.isArray(c.renegotiationHistory) && c.renegotiationHistory.length > 0 && (
                        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs space-y-2">
                          <div className="font-bold text-amber-900 flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                            Renegotiation History ({c.renegotiationHistory.length})
                          </div>
                          {c.renegotiationHistory.map((h, i) => (
                            <div key={i} className="text-[11px] text-amber-800 border-l-2 border-amber-400 pl-2 space-y-0.5">
                              <div className="font-semibold">
                                Extended from {new Date(h.previousDeadline).toLocaleDateString()} to {new Date(h.newDeadline).toLocaleDateString()}
                              </div>
                              <div className="italic text-amber-700">"{h.reason}"</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {isLoggedIn && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          {!isHonored && (
                            <button
                              onClick={() => { setHonoringCommitment(c); setHonorProofNotes(''); }}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Mark Honored
                            </button>
                          )}

                          {!isHonored && (
                            <button
                              onClick={() => { setRenegotiatingCommitment(c); setRenegotiateNewDeadline(''); setRenegotiateReason(''); }}
                              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Renegotiate
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteCommitment(c.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                          title="Remove from Ledger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs font-semibold space-y-2">
                <Shield className="w-8 h-8 opacity-30 mx-auto" />
                <p>No commitments found under this filter.</p>
              </div>
            )}
          </div>

          {/* ── Record Commitment Modal ── */}
          {isNewCommitmentModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2 font-black text-slate-900">
                    <Award className="w-5 h-5 text-blue-600" />
                    Record Commitment (Pratigya)
                  </div>
                  <button onClick={() => setIsNewCommitmentModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
                </div>

                <form onSubmit={handleCreateCommitment} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700">What was promised? (Title) *</label>
                    <input
                      type="text"
                      placeholder="e.g. Deliver research milestone audit..."
                      value={newCommitmentTitle}
                      onChange={e => setNewCommitmentTitle(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Word Given To *</label>
                      <input
                        type="text"
                        placeholder="e.g. Prof. Sharma, Mom, Alex..."
                        value={newCommitmentRecipient}
                        onChange={e => setNewCommitmentRecipient(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700">Contact (Optional Phone/Email)</label>
                      <input
                        type="text"
                        placeholder="Optional contact details..."
                        value={newCommitmentContact}
                        onChange={e => setNewCommitmentContact(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Urgency Tier</label>
                      <select
                        value={newCommitmentUrgency}
                        onChange={e => setNewCommitmentUrgency(e.target.value as CommitmentUrgency)}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      >
                        <option value="sacred">Sacred (Highest Integrity)</option>
                        <option value="high">High</option>
                        <option value="standard">Standard</option>
                        <option value="flexible">Flexible</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700">Deadline (Date & Time) *</label>
                      <input
                        type="datetime-local"
                        value={newCommitmentDeadline}
                        onChange={e => setNewCommitmentDeadline(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Description & Deliverable Scope</label>
                    <textarea
                      rows={3}
                      placeholder="Context, expectations, delivery instructions, or links..."
                      value={newCommitmentDesc}
                      onChange={e => setNewCommitmentDesc(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2"
                  >
                    <Award className="w-4 h-4" />
                    Record in Ledger
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── Mark Honored Modal ── */}
          {honoringCommitment && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2 font-black text-slate-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Fulfill Commitment
                  </div>
                  <button onClick={() => setHonoringCommitment(null)} className="text-slate-400 hover:text-slate-700">✕</button>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-slate-600">
                    Word given to <strong>{honoringCommitment.recipientName}</strong> on <em>"{honoringCommitment.title}"</em>.
                  </p>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Deliverable Evidence / Proof Notes (Optional)</label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Sent report via email, shared link, delivered physical item..."
                      value={honorProofNotes}
                      onChange={e => setHonorProofNotes(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <button
                    onClick={handleExecuteHonor}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md"
                  >
                    Confirm Word Honored
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Renegotiate Deadline Modal ── */}
          {renegotiatingCommitment && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2 font-black text-slate-900">
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                    Renegotiate Deadline
                  </div>
                  <button onClick={() => setRenegotiatingCommitment(null)} className="text-slate-400 hover:text-slate-700">✕</button>
                </div>

                <div className="space-y-4">
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>Commitment: <strong>{renegotiatingCommitment.title}</strong></div>
                    <div>Recipient: <strong>{renegotiatingCommitment.recipientName}</strong></div>
                    <div>Current Deadline: <span className="font-mono">{new Date(renegotiatingCommitment.deadline).toLocaleDateString()}</span></div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">New Renegotiated Deadline *</label>
                    <input
                      type="datetime-local"
                      value={renegotiateNewDeadline}
                      onChange={e => setRenegotiateNewDeadline(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Documented Reason / Justification *</label>
                    <textarea
                      rows={3}
                      placeholder="Why is this deadline being renegotiated? Document transparently..."
                      value={renegotiateReason}
                      onChange={e => setRenegotiateReason(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <button
                    onClick={handleExecuteRenegotiate}
                    disabled={!renegotiateNewDeadline || !renegotiateReason.trim()}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition shadow-md"
                  >
                    Record Renegotiated Deadline
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
