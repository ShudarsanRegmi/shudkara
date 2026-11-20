import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  CheckSquare, Square, Plus, Trash2, Edit2, Lock, Unlock, 
  LayoutGrid, Sparkles, Shield, Award, Clock, Calendar, 
  User, CheckCircle2, RefreshCw, Mail, 
  FolderPlus, Flame, MoveRight, AlertCircle, Layers
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

// Backward compatibility alias
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

const WORKSET_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  blue:    { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  purple:  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  amber:   { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  rose:    { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  indigo:  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
};

// ── Main Todos Component ─────────────────────────────────────────────────────
export const Todos: React.FC<TodosProps> = ({ 
  authToken, 
  todos, 
  onTodosChange,
  isBoardPrivate = false,
  onBoardPrivacyChange
}) => {
  // ── Pillar Tab Navigation ──────────────────────────────────────────────────
  // Read initial pillar from URL (?pillar=whiteboard|karya|pratigya)
  const getInitialPillar = (): 'whiteboard' | 'karya' | 'pratigya' => {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('pillar');
      if (p === 'karya' || p === 'pratigya' || p === 'whiteboard') return p;
    } catch {}
    return 'whiteboard';
  };

  const [activePillar, setActivePillar] = useState<'whiteboard' | 'karya' | 'pratigya'>(getInitialPillar);

  // Sync URL pillar query param
  const switchPillar = (pillar: 'whiteboard' | 'karya' | 'pratigya') => {
    setActivePillar(pillar);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('pillar', pillar);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const isLoggedIn = !!authToken;

  // ── State for Three Pillars ────────────────────────────────────────────────
  const [worksets, setWorksets] = useState<TaskWorkset[]>([]);
  const [tasks, setTasks] = useState<KaryaTask[]>([]);
  const [commitments, setCommitments] = useState<PratigyaCommitment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // ── Fetch Full Ecosystem State ─────────────────────────────────────────────
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
      console.error('Failed to load ecosystem state:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authToken, onTodosChange]);

  useEffect(() => {
    loadEcosystemData();
  }, [loadEcosystemData]);

  // ───────────────────────────────────────────────────────────────────────────
  // ── PILLAR 1: WHITEBOARD (CHITRA-PATRA) LOGIC ─────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  const [whiteboardViewMode, setWhiteboardViewMode] = useState<'canvas' | 'grid'>('canvas');
  const [newWhiteboardText, setNewWhiteboardText] = useState('');
  const [newWhiteboardColor, setNewWhiteboardColor] = useState<WhiteboardNote['color']>('yellow');
  const [newWhiteboardPrivate, setNewWhiteboardPrivate] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  // Dragging state for canvas mode
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Promote Modal State
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
    if (window.confirm('Delete this sticky note?')) {
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

  // Canvas Drag Handling
  const handleMouseDownOnNote = (e: React.MouseEvent, note: WhiteboardNote) => {
    if (whiteboardViewMode !== 'canvas' || !isLoggedIn) return;
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

  // Promote Actions
  const executePromoteToTask = async () => {
    if (!promotingNote) return;
    const newTaskPayload = {
      worksetId: promoteWorksetId,
      title: promotingNote.text,
      notes: `Promoted from Whiteboard sticky note on ${new Date().toLocaleDateString()}`,
      dueDate: promoteDueDate || null,
      priority: promotePriority,
      subtasks: [],
      tags: ['whiteboard-promoted'],
      completed: false
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    try {
      const res = await fetch('/api/todos/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(newTaskPayload)
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(prev => [data.task, ...prev]);
        showToast('Successfully promoted sticky note to Task!');
        setPromotingNote(null);
        setPromoteMode(null);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to promote to Task.', 'error');
    }
  };

  const executePromoteToPratigya = async () => {
    if (!promotingNote || !promoteRecipient.trim() || !promoteDeadline) {
      alert('Recipient name and deadline are required for Pratigya.');
      return;
    }
    const newCommitmentPayload = {
      title: promotingNote.text,
      recipientName: promoteRecipient.trim(),
      deadline: new Date(promoteDeadline).toISOString(),
      urgency: promoteUrgency,
      description: `Promoted from Whiteboard note: "${promotingNote.text}"`,
      status: 'active'
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    try {
      const res = await fetch('/api/todos/commitments', {
        method: 'POST',
        headers,
        body: JSON.stringify(newCommitmentPayload)
      });
      if (res.ok) {
        const data = await res.json();
        setCommitments(prev => [data.commitment, ...prev]);
        showToast('Successfully bound sticky note into a Sacred Pratigya Covenant!');
        setPromotingNote(null);
        setPromoteMode(null);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to bind to Pratigya.', 'error');
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ── PILLAR 2: TASKS & WORKSETS (KĀRYA) LOGIC ──────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  const [selectedWorksetId, setSelectedWorksetId] = useState<string>('all'); // 'all' = Common Board
  const [taskFilter, setTaskFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'all' | 'p1' | 'p2' | 'p3'>('all');
  const [taskSearch, setTaskSearch] = useState('');

  // Task Creation State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskWorkset, setNewTaskWorkset] = useState('work');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('p3');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [isTaskFormExpanded, setIsTaskFormExpanded] = useState(false);
  const [newTaskSubtasks, setNewTaskSubtasks] = useState<string[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  // Workset Creation Modal
  const [isNewWorksetModalOpen, setIsNewWorksetModalOpen] = useState(false);
  const [newWorksetTitle, setNewWorksetTitle] = useState('');
  const [newWorksetIcon, setNewWorksetIcon] = useState('📁');
  const [newWorksetColor, setNewWorksetColor] = useState('blue');

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return tasks.filter(t => {
      // Workset filter
      if (selectedWorksetId !== 'all' && t.worksetId !== selectedWorksetId) return false;

      // Priority filter
      if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) return false;

      // Search filter
      if (taskSearch.trim() && !t.title.toLowerCase().includes(taskSearch.toLowerCase())) return false;

      // Status / Time Horizon filter
      if (taskFilter === 'completed') return t.completed;
      if (taskFilter === 'all') return true;

      // For uncompleted time-based filters
      if (t.completed) return false;

      const taskDate = t.dueDate ? t.dueDate.slice(0, 10) : null;
      if (taskFilter === 'today') {
        return taskDate === todayStr;
      }
      if (taskFilter === 'upcoming') {
        return taskDate && taskDate >= todayStr && taskDate <= sevenDaysLater;
      }
      if (taskFilter === 'overdue') {
        return taskDate && taskDate < todayStr;
      }
      return true;
    });
  }, [tasks, selectedWorksetId, taskPriorityFilter, taskSearch, taskFilter]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const subtasksPayload: SubTask[] = newTaskSubtasks.map(s => ({
      id: Math.random().toString(36).substring(2, 9),
      text: s,
      completed: false
    }));

    const payload = {
      worksetId: selectedWorksetId === 'all' ? newTaskWorkset : selectedWorksetId,
      title: newTaskTitle.trim(),
      notes: newTaskNotes.trim(),
      dueDate: newTaskDueDate || null,
      priority: newTaskPriority,
      subtasks: subtasksPayload,
      tags: [],
      completed: false
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    try {
      const res = await fetch('/api/todos/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(prev => [data.task, ...prev]);
        setNewTaskTitle('');
        setNewTaskNotes('');
        setNewTaskDueDate('');
        setNewTaskSubtasks([]);
        setIsTaskFormExpanded(false);
        showToast('Task added to Kārya!');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to add task.', 'error');
    }
  };

  const handleToggleTaskComplete = async (id: string) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;
    const nextCompleted = !target.completed;
    const updated = tasks.map(t => t.id === id ? { ...t, completed: nextCompleted, completedAt: nextCompleted ? new Date().toISOString() : null } : t);
    setTasks(updated);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch(`/api/todos/tasks/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ completed: nextCompleted })
    }).catch(console.error);
  };

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
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

  const handleDeleteTask = async (id: string) => {
    if (window.confirm('Delete this task?')) {
      setTasks(prev => prev.filter(t => t.id !== id));
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;
      fetch(`/api/todos/tasks/${id}`, { method: 'DELETE', headers }).catch(console.error);
    }
  };

  const handleClearCompletedTasks = async () => {
    if (!window.confirm('Clear all completed tasks?')) return;
    setTasks(prev => prev.filter(t => !t.completed));
    const headers: Record<string, string> = {};
    if (authToken) headers['X-Session-Token'] = authToken;
    fetch('/api/todos/tasks/completed', { method: 'DELETE', headers }).catch(console.error);
    showToast('Completed tasks cleared.');
  };

  const handleCreateWorkset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorksetTitle.trim()) return;

    const payload = {
      title: newWorksetTitle.trim(),
      icon: newWorksetIcon || '📁',
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
        setIsNewWorksetModalOpen(false);
        setNewWorksetTitle('');
        showToast(`Workset "${data.workset.title}" created!`);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to create workset.', 'error');
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ── PILLAR 3: PRATIGYA COMMITMENT MANAGER LOGIC ───────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  const [pratigyaFilter, setPratigyaFilter] = useState<'all' | 'active' | 'sacred' | 'overdue' | 'honored' | 'renegotiated'>('all');
  const [isNewCommitmentModalOpen, setIsNewCommitmentModalOpen] = useState(false);
  const [newCommitmentTitle, setNewCommitmentTitle] = useState('');
  const [newCommitmentRecipient, setNewCommitmentRecipient] = useState('');
  const [newCommitmentContact, setNewCommitmentContact] = useState('');
  const [newCommitmentDeadline, setNewCommitmentDeadline] = useState('');
  const [newCommitmentUrgency, setNewCommitmentUrgency] = useState<CommitmentUrgency>('sacred');
  const [newCommitmentDesc, setNewCommitmentDesc] = useState('');

  // Honor / Fulfillment Modal
  const [honoringCommitment, setHonoringCommitment] = useState<PratigyaCommitment | null>(null);
  const [honorProofNotes, setHonorProofNotes] = useState('');

  // Renegotiation Modal
  const [renegotiatingCommitment, setRenegotiatingCommitment] = useState<PratigyaCommitment | null>(null);
  const [renegotiateNewDeadline, setRenegotiateNewDeadline] = useState('');
  const [renegotiateReason, setRenegotiateReason] = useState('');

  // Test Alert Dispatch State
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);

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

    const payload = {
      title: newCommitmentTitle.trim(),
      recipientName: newCommitmentRecipient.trim(),
      recipientContact: newCommitmentContact.trim(),
      deadline: new Date(newCommitmentDeadline).toISOString(),
      urgency: newCommitmentUrgency,
      description: newCommitmentDesc.trim()
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    try {
      const res = await fetch('/api/todos/commitments', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setCommitments(prev => [data.commitment, ...prev]);
        setIsNewCommitmentModalOpen(false);
        setNewCommitmentTitle('');
        setNewCommitmentRecipient('');
        setNewCommitmentContact('');
        setNewCommitmentDeadline('');
        setNewCommitmentDesc('');
        showToast('Sacred covenant recorded in Pratigya ledger!');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to record commitment.', 'error');
    }
  };

  const handleExecuteHonor = async () => {
    if (!honoringCommitment) return;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    try {
      const res = await fetch(`/api/todos/commitments/${honoringCommitment.id}/honor`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ proofNotes: honorProofNotes.trim() })
      });
      if (res.ok) {
        setCommitments(prev => prev.map(c => c.id === honoringCommitment.id ? {
          ...c,
          status: 'honored',
          fulfilledAt: new Date().toISOString(),
          proofNotes: honorProofNotes.trim()
        } : c));
        setHonoringCommitment(null);
        setHonorProofNotes('');
        showToast('Word honored! Commitment fulfilled with integrity. 🌟');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to honor commitment.', 'error');
    }
  };

  const handleExecuteRenegotiate = async () => {
    if (!renegotiatingCommitment || !renegotiateNewDeadline || !renegotiateReason.trim()) {
      alert('New deadline and justification reason are required to renegotiate.');
      return;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    try {
      const res = await fetch(`/api/todos/commitments/${renegotiatingCommitment.id}/renegotiate`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          newDeadline: new Date(renegotiateNewDeadline).toISOString(),
          reason: renegotiateReason.trim()
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCommitments(prev => prev.map(c => c.id === renegotiatingCommitment.id ? {
          ...c,
          deadline: new Date(renegotiateNewDeadline).toISOString(),
          status: 'renegotiated',
          renegotiationHistory: [...(c.renegotiationHistory || []), data.renegotiation]
        } : c));
        setRenegotiatingCommitment(null);
        setRenegotiateNewDeadline('');
        setRenegotiateReason('');
        showToast('Commitment renegotiated with documented justification.');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to renegotiate commitment.', 'error');
    }
  };

  const handleTriggerTestAlert = async (commitment?: PratigyaCommitment) => {
    setIsSendingTestAlert(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['X-Session-Token'] = authToken;

    try {
      const res = await fetch('/api/todos/commitments/test-alert', {
        method: 'POST',
        headers,
        body: JSON.stringify(commitment ? { id: commitment.id, commitment } : {})
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Test email dispatched to owner address!');
      } else {
        showToast(data.error || 'Failed to dispatch test alert.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error sending test alert: ' + err.message, 'error');
    } finally {
      setIsSendingTestAlert(false);
    }
  };

  const handleDeleteCommitment = async (id: string) => {
    if (window.confirm('Delete this commitment from the Pratigya ledger?')) {
      setCommitments(prev => prev.filter(c => c.id !== id));
      const headers: Record<string, string> = {};
      if (authToken) headers['X-Session-Token'] = authToken;
      fetch(`/api/todos/commitments/${id}`, { method: 'DELETE', headers }).catch(console.error);
    }
  };

  // Helper for Pratigya Remaining Time Display
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

    return { isPast, label, days, hours };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ── RENDER ────────────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────

  // Lockpad banner if board is private and visitor is unauthenticated
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
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-xs font-bold shadow-xl border flex items-center gap-2 animate-bounce ${
          feedbackToast.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-slate-900 text-white border-slate-700'
        }`}>
          {feedbackToast.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-500" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
          {feedbackToast.message}
        </div>
      )}

      {/* ── Top Header & Ecosystem Bar ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-blue-600 text-xs font-extrabold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            Execution & Integrity Ecosystem
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Todos & Pratigya
            <span className="text-sm font-semibold text-slate-400 font-serif">
              (कार्य & प्रतिज्ञा)
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
            <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-md">चित्रपट</span>
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
            <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-md">कार्य</span>
          </button>

          <button
            onClick={() => switchPillar('pratigya')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activePillar === 'pratigya'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-600" />
            <span>Pratigya</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-md font-bold">प्रतिज्ञा</span>
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
            title="Refresh All"
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
          {/* Whiteboard Controls & Add Sticky Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Canvas Layout:</span>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setWhiteboardViewMode('canvas')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      whiteboardViewMode === 'canvas' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Spatial Canvas
                  </button>
                  <button
                    onClick={() => setWhiteboardViewMode('grid')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      whiteboardViewMode === 'grid' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Grid View
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                {visibleWhiteboardNotes.length} notes on board • Drag freely to reposition
              </div>
            </div>

            {/* Quick Add Sticky Note (Logged-in only) */}
            {isLoggedIn && (
              <form onSubmit={handleAddWhiteboardNote} className="flex flex-col md:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="Drop a thought or sticky note on Chitra-Patra..."
                  value={newWhiteboardText}
                  onChange={e => setNewWhiteboardText(e.target.value)}
                  className="flex-1 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                  {/* Color Selector */}
                  <div className="flex gap-1.5">
                    {(['yellow', 'blue', 'emerald', 'purple', 'rose'] as const).map(color => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setNewWhiteboardColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition ${
                          newWhiteboardColor === color ? 'border-slate-900 scale-110 shadow-sm' : 'border-transparent'
                        } ${
                          color === 'yellow' ? 'bg-amber-300' :
                          color === 'blue' ? 'bg-sky-300' :
                          color === 'emerald' ? 'bg-emerald-300' :
                          color === 'purple' ? 'bg-purple-300' : 'bg-rose-300'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Privacy Toggle */}
                  <button
                    type="button"
                    onClick={() => setNewWhiteboardPrivate(!newWhiteboardPrivate)}
                    className={`p-2 rounded-xl border transition ${
                      newWhiteboardPrivate ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                    title={newWhiteboardPrivate ? 'Private Note' : 'Public Note'}
                  >
                    {newWhiteboardPrivate ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4" />}
                  </button>

                  <button
                    type="submit"
                    disabled={!newWhiteboardText.trim()}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition shadow-md shrink-0 flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Stick Note
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Whiteboard Board Canvas / Grid */}
          {whiteboardViewMode === 'canvas' ? (
            <div
              ref={canvasRef}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              className="relative min-h-[580px] bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-hidden shadow-2xl bg-[radial-gradient(#334155_1.5px,transparent_1.5px)] [background-size:24px_24px]"
            >
              <div className="absolute top-4 right-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest pointer-events-none">
                Chitra-Patra • Spatial Canvas (चित्रपट)
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
                      {/* Top Bar Icons */}
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
                              title="Promote to Workset Task (कार्य)"
                            >
                              <MoveRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isLoggedIn && (
                            <button
                              onClick={() => { setPromotingNote(t); setPromoteMode('pratigya'); setPromoteRecipient(''); setPromoteDeadline(''); }}
                              className="p-1 rounded hover:bg-black/10 text-amber-800 transition"
                              title="Promote to Pratigya Covenant (प्रतिज्ञा)"
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

                      {/* Content */}
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

                      {/* Footer */}
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
            /* Grid View */
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
                            title="Promote to Task (कार्य)"
                          >
                            <MoveRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isLoggedIn && (
                          <button
                            onClick={() => { setPromotingNote(t); setPromoteMode('pratigya'); setPromoteRecipient(''); setPromoteDeadline(''); }}
                            className="p-1 rounded hover:bg-black/10 text-amber-800 transition"
                            title="Promote to Pratigya (प्रतिज्ञा)"
                          >
                            <Shield className="w-3.5 h-3.5" />
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
          )}

          {/* ── Promote Modal ── */}
          {promotingNote && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    Promote Sticky Note: "{promotingNote.text.slice(0, 30)}..."
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
                    To Kārya Task (कार्य)
                  </button>
                  <button
                    onClick={() => setPromoteMode('pratigya')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      promoteMode === 'pratigya' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    To Pratigya Covenant (प्रतिज्ञा)
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
                          <option key={w.id} value={w.id}>{w.icon} {w.title}</option>
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
                          <option value="p1">P1: Urgent</option>
                          <option value="p2">P2: High</option>
                          <option value="p3">P3: Normal</option>
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
                      Promote into Task
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Word Given To (Recipient Name) *</label>
                      <input
                        type="text"
                        placeholder="e.g. Prof. Sharma, Mom, Client Alex..."
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
                          <option value="sacred">🔥 Sacred (Unbreakable)</option>
                          <option value="high">⚡ High</option>
                          <option value="standard">📜 Standard</option>
                          <option value="flexible">🌱 Flexible</option>
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
                      className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition shadow-md"
                    >
                      Bind into Sacred Pratigya
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* ── PILLAR 2: TASKS & WORKSETS (GOOGLE TASKS STYLE — KĀRYA) ────────── */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activePillar === 'karya' && (
        <div className="space-y-6 animate-fade-in">
          {/* Workset Chips Selector Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Common Board Chip */}
              <button
                onClick={() => setSelectedWorksetId('all')}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition border ${
                  selectedWorksetId === 'all'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>🌐 Common Board (All)</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-md">
                  {tasks.filter(t => !t.completed).length}
                </span>
              </button>

              {/* Individual Worksets */}
              {worksets.map(w => {
                const colorScheme = WORKSET_COLOR_MAP[w.color || 'blue'] || WORKSET_COLOR_MAP.blue;
                const isSelected = selectedWorksetId === w.id;
                const count = tasks.filter(t => t.worksetId === w.id && !t.completed).length;

                return (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWorksetId(w.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition border ${
                      isSelected
                        ? `${colorScheme.bg} ${colorScheme.text} ${colorScheme.border} shadow-sm ring-2 ring-blue-500/20`
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{w.icon || '📁'}</span>
                    <span>{w.title}</span>
                    {count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}

              {isLoggedIn && (
                <button
                  onClick={() => setIsNewWorksetModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>New Workset</span>
                </button>
              )}
            </div>

            {/* Clear Completed Tasks Button */}
            {isLoggedIn && tasks.some(t => t.completed) && (
              <button
                onClick={handleClearCompletedTasks}
                className="text-xs font-bold text-slate-400 hover:text-red-600 transition flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear Completed
              </button>
            )}
          </div>

          {/* Quick Add Task Bar (Google Tasks Style) */}
          {isLoggedIn && (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <form onSubmit={handleCreateTask} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Add a new task (e.g. 'Draft system evaluation section')..."
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onFocus={() => setIsTaskFormExpanded(true)}
                    className="flex-1 text-sm font-semibold text-slate-900 bg-transparent focus:outline-none placeholder-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!newTaskTitle.trim()}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition shadow-sm shrink-0"
                  >
                    Add Task
                  </button>
                </div>

                {/* Expanded Details Form */}
                {isTaskFormExpanded && (
                  <div className="pt-3 border-t border-slate-100 space-y-3 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Workset Selector */}
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Workset</label>
                        <select
                          value={selectedWorksetId === 'all' ? newTaskWorkset : selectedWorksetId}
                          onChange={e => setNewTaskWorkset(e.target.value)}
                          className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        >
                          {worksets.map(w => (
                            <option key={w.id} value={w.id}>{w.icon} {w.title}</option>
                          ))}
                        </select>
                      </div>

                      {/* Due Date */}
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Due Date</label>
                        <input
                          type="date"
                          value={newTaskDueDate}
                          onChange={e => setNewTaskDueDate(e.target.value)}
                          className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>

                      {/* Priority Selector */}
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Priority</label>
                        <select
                          value={newTaskPriority}
                          onChange={e => setNewTaskPriority(e.target.value as TaskPriority)}
                          className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        >
                          <option value="p1">P1: Urgent (🚨)</option>
                          <option value="p2">P2: High (⚡)</option>
                          <option value="p3">P3: Normal (🔵)</option>
                        </select>
                      </div>
                    </div>

                    {/* Notes Field */}
                    <div>
                      <input
                        type="text"
                        placeholder="Add notes, context, or links..."
                        value={newTaskNotes}
                        onChange={e => setNewTaskNotes(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                      />
                    </div>

                    {/* Subtasks / Checklist Builder */}
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
                                setNewTaskSubtasks([...newTaskSubtasks, newSubtaskInput.trim()]);
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
                              setNewTaskSubtasks([...newTaskSubtasks, newSubtaskInput.trim()]);
                              setNewSubtaskInput('');
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                        >
                          + Add Subtask
                        </button>
                      </div>

                      {newTaskSubtasks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {newTaskSubtasks.map((st, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg font-medium">
                              • {st}
                              <button
                                type="button"
                                onClick={() => setNewTaskSubtasks(newTaskSubtasks.filter((_, i) => i !== idx))}
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
              </form>
            </div>
          )}

          {/* Filter Chips & Search Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Filter Chips */}
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

              {/* Priority Chips */}
              {(['all', 'p1', 'p2', 'p3'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setTaskPriorityFilter(p)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold uppercase transition ${
                    taskPriorityFilter === p ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {p === 'all' ? 'All Priorities' : p}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter tasks..."
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
                        {/* Checkbox */}
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

                            {/* Priority Badge */}
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase ${priorityBadge}`}>
                              {t.priority}
                            </span>

                            {/* Workset Badge (Common Board View) */}
                            {selectedWorksetId === 'all' && parentWorkset && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                {parentWorkset.icon} {parentWorkset.title}
                              </span>
                            )}

                            {/* Due Date Pill */}
                            {t.dueDate && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {t.dueDate.slice(0, 10)}
                              </span>
                            )}
                          </div>

                          {/* Notes */}
                          {t.notes && (
                            <p className="text-xs text-slate-500 line-clamp-2">
                              {t.notes}
                            </p>
                          )}

                          {/* Subtasks Progress Bar & Checklist */}
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

                      {/* Actions */}
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
                <p>No tasks found in this view.</p>
              </div>
            )}
          </div>

          {/* ── New Workset Modal ── */}
          {isNewWorksetModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <FolderPlus className="w-5 h-5 text-blue-600" />
                    Create Custom Workset
                  </div>
                  <button onClick={() => setIsNewWorksetModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
                </div>

                <form onSubmit={handleCreateWorkset} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Workset Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Deep Work, Reading, Family..."
                      value={newWorksetTitle}
                      onChange={e => setNewWorksetTitle(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Icon / Emoji</label>
                      <input
                        type="text"
                        placeholder="💼, 🔬, 🛠️, 📚..."
                        value={newWorksetIcon}
                        onChange={e => setNewWorksetIcon(e.target.value)}
                        className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
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
                        <option value="indigo">Indigo</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!newWorksetTitle.trim()}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md"
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
      {/* ── PILLAR 3: PRATIGYA (THE COVENANT & COMMITMENT MANAGER) ─────────── */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activePillar === 'pratigya' && (
        <div className="space-y-6 animate-fade-in">
          {/* Philosophical Sanskrit Banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/80 border border-amber-900/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-widest">
                <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
                The Sovereign Covenant Ledger (प्रतिज्ञा)
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-amber-100 font-serif tracking-wide">
                "रघुकुल रीत सदा चली आई, प्राण जाई पर वचन न जाई"
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Pratigya is a high-stakes ledger for promises made to specific living people. Guarded by an adaptive horizon email engine that ensures commitments are fulfilled or renegotiated with integrity.
              </p>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-white/10 text-center">
                <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10">
                  <div className="text-lg font-black text-white">{pratigyaStats.total}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pledges</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10">
                  <div className="text-lg font-black text-amber-400">{pratigyaStats.active}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10">
                  <div className="text-lg font-black text-red-400">{pratigyaStats.sacred}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sacred</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10">
                  <div className="text-lg font-black text-rose-500">{pratigyaStats.overdue}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overdue / Breach</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10">
                  <div className="text-lg font-black text-emerald-400">{pratigyaStats.honored}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Honored</div>
                </div>
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
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Test Alert Dispatch Button */}
              {isLoggedIn && (
                <button
                  onClick={() => handleTriggerTestAlert()}
                  disabled={isSendingTestAlert}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition flex items-center gap-1.5"
                  title="Dispatch instant test alert email"
                >
                  <Mail className={`w-3.5 h-3.5 ${isSendingTestAlert ? 'animate-pulse text-amber-600' : ''}`} />
                  <span>{isSendingTestAlert ? 'Sending...' : 'Test Alert'}</span>
                </button>
              )}

              {/* Record Covenant Button */}
              {isLoggedIn && (
                <button
                  onClick={() => setIsNewCommitmentModalOpen(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Award className="w-4 h-4" />
                  <span>Record Covenant (प्रतिज्ञा लें)</span>
                </button>
              )}
            </div>
          </div>

          {/* Commitments Feed */}
          <div className="space-y-4">
            {filteredCommitments.length > 0 ? (
              filteredCommitments.map(c => {
                const timing = getCommitmentTiming(c.deadline);
                const isSacred = c.urgency === 'sacred';
                const isHonored = c.status === 'honored';
                const isRenegotiated = c.status === 'renegotiated';
                const isBreached = timing.isPast && !isHonored;

                const cardBorder = 
                  isHonored ? 'border-emerald-300 bg-emerald-50/20' :
                  isBreached ? 'border-red-400 bg-red-50/30 ring-1 ring-red-400' :
                  isSacred ? 'border-amber-400 bg-amber-50/20 shadow-amber-100/50' :
                  'border-slate-200 bg-white';

                const urgencyPill = 
                  c.urgency === 'sacred' ? 'bg-red-500 text-white' :
                  c.urgency === 'high' ? 'bg-orange-500 text-white' :
                  c.urgency === 'standard' ? 'bg-blue-600 text-white' :
                  'bg-emerald-600 text-white';

                return (
                  <div
                    key={c.id}
                    className={`rounded-3xl border-2 p-6 transition-all duration-200 shadow-sm ${cardBorder} space-y-4`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Urgency Badge */}
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${urgencyPill}`}>
                          {c.urgency}
                        </span>

                        {/* Status Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                          isHonored ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          isBreached ? 'bg-red-100 text-red-800 border-red-300 animate-pulse' :
                          isRenegotiated ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          'bg-blue-100 text-blue-800 border-blue-300'
                        }`}>
                          {isHonored ? 'Fulfilled / Honored' : isBreached ? '⚠️ Overdue Breach' : c.status}
                        </span>

                        {/* Alert History Count */}
                        {Array.isArray(c.alertHistory) && c.alertHistory.length > 0 && (
                          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {c.alertHistory.length} alert(s) dispatched
                          </span>
                        )}
                      </div>

                      {/* Timing Pill */}
                      <div className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                        isHonored ? 'bg-emerald-100 text-emerald-900' :
                        timing.isPast ? 'bg-red-100 text-red-900' : 'bg-slate-100 text-slate-900'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{isHonored ? `Honored on ${c.fulfilledAt?.slice(0, 10)}` : timing.label}</span>
                      </div>
                    </div>

                    {/* Core Commitment Details */}
                    <div className="space-y-2">
                      <h3 className={`text-lg font-black text-slate-900 ${isHonored ? 'line-through text-slate-500' : ''}`}>
                        {c.title}
                      </h3>

                      {/* Recipient Details */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 bg-white/60 p-2.5 rounded-xl border border-black/5">
                        <div className="flex items-center gap-1.5 font-bold">
                          <User className="w-4 h-4 text-blue-600" />
                          <span>Word Given To:</span>
                          <span className="text-slate-900 underline font-black">{c.recipientName}</span>
                        </div>
                        {c.recipientContact && (
                          <span className="text-slate-400">({c.recipientContact})</span>
                        )}
                        <span className="text-slate-300">•</span>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Deadline: {new Date(c.deadline).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Description */}
                      {c.description && (
                        <p className="text-xs text-slate-600 leading-relaxed pt-1">
                          {c.description}
                        </p>
                      )}

                      {/* Proof / Fulfillment Notes */}
                      {c.proofNotes && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
                          <div className="font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Deliverable Evidence / Proof Notes:
                          </div>
                          <p>{c.proofNotes}</p>
                        </div>
                      )}

                      {/* Renegotiation History Accordion */}
                      {Array.isArray(c.renegotiationHistory) && c.renegotiationHistory.length > 0 && (
                        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs space-y-2">
                          <div className="font-bold text-amber-900 flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                            Renegotiation History ({c.renegotiationHistory.length} time(s))
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

                    {/* Actions Bar */}
                    {isLoggedIn && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-black/5">
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

                          <button
                            onClick={() => handleTriggerTestAlert(c)}
                            disabled={isSendingTestAlert}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-xs font-bold rounded-xl transition border border-slate-200 flex items-center gap-1"
                            title="Dispatch email alert now"
                          >
                            <Mail className="w-3 h-3" />
                            Alert Now
                          </button>
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

          {/* ── New Commitment Modal ── */}
          {isNewCommitmentModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2 font-black text-slate-900">
                    <Award className="w-5 h-5 text-amber-600" />
                    Record Sacred Covenant (प्रतिज्ञा)
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
                      <label className="text-xs font-bold text-slate-700">Word Given To (Person) *</label>
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
                        placeholder="Optional phone or email..."
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
                        <option value="sacred">🔥 Sacred (Unbreakable)</option>
                        <option value="high">⚡ High Stakes</option>
                        <option value="standard">📜 Standard Commitment</option>
                        <option value="flexible">🌱 Flexible Timeline</option>
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
                    <label className="text-xs font-bold text-slate-700">Description / Scope & Deliverables</label>
                    <textarea
                      rows={3}
                      placeholder="Detailed expectations, scope, constraints, and delivery links..."
                      value={newCommitmentDesc}
                      onChange={e => setNewCommitmentDesc(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2"
                  >
                    <Award className="w-4 h-4" />
                    Record in Pratigya Ledger
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
                    You gave your word to <strong>{honoringCommitment.recipientName}</strong> on <em>"{honoringCommitment.title}"</em>.
                  </p>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Deliverable Evidence / Proof Notes (Optional)</label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Sent via email, delivered final PDF link, received confirmation..."
                      value={honorProofNotes}
                      onChange={e => setHonorProofNotes(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <button
                    onClick={handleExecuteHonor}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md"
                  >
                    Confirm Word Honored & Fulfilled
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
                  <div className="flex items-center gap-2 font-black text-amber-900">
                    <RefreshCw className="w-5 h-5 text-amber-600" />
                    Renegotiate Commitment Deadline
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
                      placeholder="Why is this deadline being renegotiated? Document the reason truthfully..."
                      value={renegotiateReason}
                      onChange={e => setRenegotiateReason(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <button
                    onClick={handleExecuteRenegotiate}
                    disabled={!renegotiateNewDeadline || !renegotiateReason.trim()}
                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition shadow-md"
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
