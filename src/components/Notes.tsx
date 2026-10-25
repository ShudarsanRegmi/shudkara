import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Folder,
  FolderPlus,
  Plus,
  Search,
  Pin,
  Star,
  Trash2,
  Edit3,
  Copy,
  Check,
  Download,
  LayoutGrid,
  List,
  Clock,
  Tag,
  X,
  SlidersHorizontal,
  Bold,
  Italic,
  Heading,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Eye,
  Edit,
  Files,
  Sparkles,
  Heart,
  Briefcase
} from 'lucide-react';

export interface NoteCategory {
  id: string;
  name: string;
  description?: string;
  color?: string; // 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan'
  icon?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;
  color?: string; // 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple'
  createdAt: string;
  updatedAt: string;
}

interface NotesProps {
  authToken?: string | null;
}

const DEFAULT_CATEGORIES: NoteCategory[] = [
  {
    id: 'general',
    name: 'General',
    description: 'Default category for general notes and quick memos',
    color: 'slate',
    icon: 'Folder',
    isDefault: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'work',
    name: 'Work & Projects',
    description: 'Tasks, architecture, and project documentations',
    color: 'blue',
    icon: 'Briefcase',
    isDefault: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'ideas',
    name: 'Ideas & Brainstorm',
    description: 'Creative inspirations, feature ideas and sketches',
    color: 'purple',
    icon: 'Sparkles',
    isDefault: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'personal',
    name: 'Personal & Journal',
    description: 'Personal reflections, logs and reading notes',
    color: 'emerald',
    icon: 'Heart',
    isDefault: false,
    createdAt: new Date().toISOString()
  }
];

const COLOR_PRESETS = [
  { key: 'slate', label: 'Slate', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', activeRing: 'ring-slate-400' },
  { key: 'blue', label: 'Blue', bg: 'bg-blue-50/70', border: 'border-blue-200', text: 'text-blue-700', activeRing: 'ring-blue-400' },
  { key: 'emerald', label: 'Emerald', bg: 'bg-emerald-50/70', border: 'border-emerald-200', text: 'text-emerald-700', activeRing: 'ring-emerald-400' },
  { key: 'amber', label: 'Amber', bg: 'bg-amber-50/70', border: 'border-amber-200', text: 'text-amber-700', activeRing: 'ring-amber-400' },
  { key: 'rose', label: 'Rose', bg: 'bg-rose-50/70', border: 'border-rose-200', text: 'text-rose-700', activeRing: 'ring-rose-400' },
  { key: 'purple', label: 'Purple', bg: 'bg-purple-50/70', border: 'border-purple-200', text: 'text-purple-700', activeRing: 'ring-purple-400' },
  { key: 'cyan', label: 'Cyan', bg: 'bg-cyan-50/70', border: 'border-cyan-200', text: 'text-cyan-700', activeRing: 'ring-cyan-400' }
];

export const COLOR_MAP: Record<string, { bg: string; text: string; border: string; pill: string; badge: string }> = {
  slate: { bg: 'bg-white', text: 'text-slate-800', border: 'border-slate-200', pill: 'bg-slate-100 text-slate-700', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  blue: { bg: 'bg-blue-50/30', text: 'text-blue-900', border: 'border-blue-200', pill: 'bg-blue-100 text-blue-800', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  emerald: { bg: 'bg-emerald-50/30', text: 'text-emerald-900', border: 'border-emerald-200', pill: 'bg-emerald-100 text-emerald-800', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  amber: { bg: 'bg-amber-50/30', text: 'text-amber-900', border: 'border-amber-200', pill: 'bg-amber-100 text-amber-800', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  rose: { bg: 'bg-rose-50/30', text: 'text-rose-900', border: 'border-rose-200', pill: 'bg-rose-100 text-rose-800', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  purple: { bg: 'bg-purple-50/30', text: 'text-purple-900', border: 'border-purple-200', pill: 'bg-purple-100 text-purple-800', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  cyan: { bg: 'bg-cyan-50/30', text: 'text-cyan-900', border: 'border-cyan-200', pill: 'bg-cyan-100 text-cyan-800', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' }
};

// Render Icon for Category
function renderCategoryIcon(iconName?: string, className = 'w-4 h-4') {
  switch (iconName) {
    case 'Briefcase':
      return <Briefcase className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Heart':
      return <Heart className={className} />;
    default:
      return <Folder className={className} />;
  }
}

// Lightweight, secure Markdown Renderer
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  const formatInline = (text: string): React.ReactNode[] => {
    // Basic regex-based inline formatter for bold, italic, inline-code, and links
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Bold **bold**
      const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
      if (boldMatch) {
        parts.push(<strong key={keyIdx++} className="font-bold text-slate-900">{boldMatch[2]}</strong>);
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Inline code `code`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(
          <code key={keyIdx++} className="px-1.5 py-0.5 bg-slate-100 text-indigo-700 rounded text-[11px] font-mono">
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Italic *italic*
      const italicMatch = remaining.match(/^(\*|_)(.*?)\1/);
      if (italicMatch) {
        parts.push(<em key={keyIdx++} className="italic">{italicMatch[2]}</em>);
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Plain character
      const nextSpecial = remaining.search(/[`*_]/);
      if (nextSpecial === -1) {
        parts.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        parts.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return parts;
  };

  lines.forEach((line, index) => {
    // Code block check
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        renderedElements.push(
          <pre key={`code-${index}`} className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto my-2 border border-slate-800">
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Headings
    if (line.startsWith('### ')) {
      renderedElements.push(
        <h4 key={index} className="text-sm font-bold text-slate-900 mt-2 mb-1">
          {formatInline(line.slice(4))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ')) {
      renderedElements.push(
        <h3 key={index} className="text-base font-extrabold text-slate-900 mt-3 mb-1">
          {formatInline(line.slice(3))}
        </h3>
      );
      return;
    }
    if (line.startsWith('# ')) {
      renderedElements.push(
        <h2 key={index} className="text-lg font-black text-slate-900 mt-4 mb-2">
          {formatInline(line.slice(2))}
        </h2>
      );
      return;
    }

    // Checklist
    if (line.trim().startsWith('- [ ] ') || line.trim().startsWith('- [x] ') || line.trim().startsWith('- [X] ')) {
      const isChecked = line.trim().startsWith('- [x] ') || line.trim().startsWith('- [X] ');
      const text = line.trim().slice(6);
      renderedElements.push(
        <div key={index} className="flex items-center gap-2 text-xs py-0.5">
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-0 cursor-default"
          />
          <span className={isChecked ? 'line-through text-slate-400' : 'text-slate-700'}>
            {formatInline(text)}
          </span>
        </div>
      );
      return;
    }

    // Bullet List
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      renderedElements.push(
        <div key={index} className="flex items-start gap-2 text-xs py-0.5 text-slate-700 pl-2">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
          <span>{formatInline(line.trim().slice(2))}</span>
        </div>
      );
      return;
    }

    // Blockquote
    if (line.trim().startsWith('> ')) {
      renderedElements.push(
        <blockquote key={index} className="border-l-2 border-indigo-400 pl-3 py-1 my-1 text-xs text-slate-600 italic bg-slate-50/50 rounded-r">
          {formatInline(line.trim().slice(2))}
        </blockquote>
      );
      return;
    }

    // Blank line
    if (!line.trim()) {
      renderedElements.push(<div key={index} className="h-2" />);
      return;
    }

    // Regular Paragraph
    renderedElements.push(
      <p key={index} className="text-xs text-slate-700 leading-relaxed">
        {formatInline(line)}
      </p>
    );
  });

  return <div className="space-y-1">{renderedElements}</div>;
}

export const Notes: React.FC<NotesProps> = ({ authToken: _authToken }) => {
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const cached = localStorage.getItem('shudkara_notes_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [categories, setCategories] = useState<NoteCategory[]>(() => {
    try {
      const cached = localStorage.getItem('shudkara_categories_cache');
      return cached ? JSON.parse(cached) : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterOnlyPinned, setFilterOnlyPinned] = useState(false);
  const [filterOnlyFavorites, setFilterOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Copy indicator state (note id)
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Editor Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formIsFavorite, setFormIsFavorite] = useState(false);
  const [formColor, setFormColor] = useState('slate');
  const [savingNote, setSavingNote] = useState(false);

  // Category Management Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState('slate');
  const [catIcon, setCatIcon] = useState('Folder');
  const [editingCat, setEditingCat] = useState<NoteCategory | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch Notes & Categories from API
  const fetchNotesAndCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notes');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notes)) {
          setNotes(data.notes);
          localStorage.setItem('shudkara_notes_cache', JSON.stringify(data.notes));
        }
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
          localStorage.setItem('shudkara_categories_cache', JSON.stringify(data.categories));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch notes from backend, using local cache:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotesAndCategories();
  }, []);

  // Save Note (Create or Update)
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim() && !formTitle.trim()) {
      alert('Please add some title or content to save note.');
      return;
    }

    try {
      setSavingNote(true);
      const payload: Partial<NoteItem> = {
        id: editingNote?.id,
        title: formTitle.trim(),
        content: formContent,
        categoryId: formCategory || 'general',
        tags: formTags,
        isPinned: formIsPinned,
        isFavorite: formIsFavorite,
        color: formColor
      };

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: payload })
      });

      if (res.ok) {
        const data = await res.json();
        const saved: NoteItem = data.note;
        setNotes(prev => {
          const index = prev.findIndex(n => n.id === saved.id);
          const next = index >= 0
            ? prev.map(n => (n.id === saved.id ? saved : n))
            : [saved, ...prev];
          localStorage.setItem('shudkara_notes_cache', JSON.stringify(next));
          return next;
        });
        setIsEditorOpen(false);
        resetNoteForm();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save note.');
      }
    } catch (err) {
      console.error('Error saving note:', err);
      // Offline fallback
      const offlineNote: NoteItem = {
        id: editingNote?.id || `note_${Date.now()}`,
        title: formTitle.trim() || 'Untitled Note',
        content: formContent,
        categoryId: formCategory || 'general',
        tags: formTags,
        isPinned: formIsPinned,
        isFavorite: formIsFavorite,
        color: formColor,
        createdAt: editingNote?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setNotes(prev => {
        const index = prev.findIndex(n => n.id === offlineNote.id);
        const next = index >= 0
          ? prev.map(n => (n.id === offlineNote.id ? offlineNote : n))
          : [offlineNote, ...prev];
        localStorage.setItem('shudkara_notes_cache', JSON.stringify(next));
        return next;
      });
      setIsEditorOpen(false);
      resetNoteForm();
    } finally {
      setSavingNote(false);
    }
  };

  // Delete Note
  const handleDeleteNote = async (noteId: string, noteTitle: string) => {
    if (!window.confirm(`Delete note "${noteTitle || 'Untitled'}"?`)) return;

    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      if (res.ok) {
        setNotes(prev => {
          const next = prev.filter(n => n.id !== noteId);
          localStorage.setItem('shudkara_notes_cache', JSON.stringify(next));
          return next;
        });
      }
    } catch {
      // Local fallback
      setNotes(prev => {
        const next = prev.filter(n => n.id !== noteId);
        localStorage.setItem('shudkara_notes_cache', JSON.stringify(next));
        return next;
      });
    }
  };

  // Toggle Pin Optimistically
  const handleTogglePin = async (note: NoteItem) => {
    const updated = { ...note, isPinned: !note.isPinned, updatedAt: new Date().toISOString() };
    setNotes(prev => {
      const next = prev.map(n => (n.id === note.id ? updated : n));
      localStorage.setItem('shudkara_notes_cache', JSON.stringify(next));
      return next;
    });

    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: updated })
      });
    } catch (e) {
      console.warn('Failed to sync pin toggle to backend:', e);
    }
  };

  // Toggle Favorite Optimistically
  const handleToggleFavorite = async (note: NoteItem) => {
    const updated = { ...note, isFavorite: !note.isFavorite, updatedAt: new Date().toISOString() };
    setNotes(prev => {
      const next = prev.map(n => (n.id === note.id ? updated : n));
      localStorage.setItem('shudkara_notes_cache', JSON.stringify(next));
      return next;
    });

    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: updated })
      });
    } catch (e) {
      console.warn('Failed to sync favorite toggle to backend:', e);
    }
  };

  // Copy note content
  const handleCopyNote = (note: NoteItem) => {
    const fullText = note.title ? `${note.title}\n\n${note.content}` : note.content;
    navigator.clipboard.writeText(fullText);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  // Export note as Markdown (.md)
  const handleExportNote = (note: NoteItem) => {
    const fullText = note.title ? `# ${note.title}\n\n${note.content}` : note.content;
    const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(note.title || 'note').toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Duplicate Note
  const handleDuplicateNote = async (note: NoteItem) => {
    const duplicated: Partial<NoteItem> = {
      title: `${note.title || 'Untitled'} (Copy)`,
      content: note.content,
      categoryId: note.categoryId,
      tags: [...note.tags],
      isPinned: false,
      isFavorite: false,
      color: note.color
    };

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: duplicated })
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(prev => [data.note, ...prev]);
      }
    } catch {
      // Local fallback
      const offlineCopy: NoteItem = {
        ...duplicated,
        id: `note_${Date.now()}`,
        title: `${note.title || 'Untitled'} (Copy)`,
        content: note.content,
        categoryId: note.categoryId,
        tags: [...note.tags],
        isPinned: false,
        isFavorite: false,
        color: note.color,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setNotes(prev => [offlineCopy, ...prev]);
    }
  };

  // Open Editor for Creating
  const openNewNote = (categoryId?: string) => {
    resetNoteForm();
    if (categoryId && categoryId !== 'all') {
      setFormCategory(categoryId);
    } else if (activeCategory !== 'all') {
      setFormCategory(activeCategory);
    }
    setIsEditorOpen(true);
  };

  // Open Editor for Editing
  const openEditNote = (note: NoteItem) => {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormCategory(note.categoryId || 'general');
    setFormTags(note.tags || []);
    setFormIsPinned(!!note.isPinned);
    setFormIsFavorite(!!note.isFavorite);
    setFormColor(note.color || 'slate');
    setEditorTab('edit');
    setIsEditorOpen(true);
  };

  const resetNoteForm = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory(activeCategory !== 'all' ? activeCategory : 'general');
    setFormTags([]);
    setTagInput('');
    setFormIsPinned(false);
    setFormIsFavorite(false);
    setFormColor('slate');
    setEditorTab('edit');
  };

  // Tags input helpers
  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (trimmed && !formTags.includes(trimmed)) {
      setFormTags([...formTags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormTags(formTags.filter(t => t !== tagToRemove));
  };

  // Markdown Helper insertion
  const insertMarkdown = (prefix: string, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = formContent.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;

    const newContent = formContent.substring(0, start) + replacement + formContent.substring(end);
    setFormContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 4));
    }, 10);
  };

  // Category Save / Update
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    const payload = {
      id: editingCat ? editingCat.id : undefined,
      name: catName.trim(),
      description: catDesc.trim() || undefined,
      color: catColor,
      icon: catIcon
    };

    try {
      const res = await fetch('/api/notes/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: payload })
      });

      if (res.ok) {
        const data = await res.json();
        const savedCat: NoteCategory = data.category;
        setCategories(prev => {
          const index = prev.findIndex(c => c.id === savedCat.id);
          const next = index >= 0
            ? prev.map(c => (c.id === savedCat.id ? savedCat : c))
            : [...prev, savedCat];
          localStorage.setItem('shudkara_categories_cache', JSON.stringify(next));
          return next;
        });
        resetCatForm();
      }
    } catch {
      // Local fallback
      const catId = editingCat ? editingCat.id : catName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const offlineCat: NoteCategory = {
        id: catId,
        name: catName.trim(),
        description: catDesc.trim() || undefined,
        color: catColor,
        icon: catIcon,
        isDefault: editingCat ? !!editingCat.isDefault : catId === 'general',
        createdAt: editingCat?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setCategories(prev => {
        const index = prev.findIndex(c => c.id === offlineCat.id);
        const next = index >= 0
          ? prev.map(c => (c.id === offlineCat.id ? offlineCat : c))
          : [...prev, offlineCat];
        localStorage.setItem('shudkara_categories_cache', JSON.stringify(next));
        return next;
      });
      resetCatForm();
    }
  };

  // Category Delete
  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (catId === 'general') {
      alert('The General category is default and cannot be deleted.');
      return;
    }

    if (!window.confirm(`Delete category "${catName}"? All its notes will be moved to General.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/notes/categories/${catId}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories(prev => {
          const next = prev.filter(c => c.id !== catId);
          localStorage.setItem('shudkara_categories_cache', JSON.stringify(next));
          return next;
        });
        // Update local notes category to general
        setNotes(prev => {
          const next = prev.map(n => (n.categoryId === catId ? { ...n, categoryId: 'general' } : n));
          localStorage.setItem('shudkara_notes_cache', JSON.stringify(next));
          return next;
        });
        if (activeCategory === catId) {
          setActiveCategory('all');
        }
      }
    } catch {
      // Local fallback
      setCategories(prev => {
        const next = prev.filter(c => c.id !== catId);
        localStorage.setItem('shudkara_categories_cache', JSON.stringify(next));
        return next;
      });
      setNotes(prev => {
        const next = prev.map(n => (n.categoryId === catId ? { ...n, categoryId: 'general' } : n));
        localStorage.setItem('shudkara_notes_cache', JSON.stringify(next));
        return next;
      });
      if (activeCategory === catId) {
        setActiveCategory('all');
      }
    }
  };

  const resetCatForm = () => {
    setEditingCat(null);
    setCatName('');
    setCatDesc('');
    setCatColor('slate');
    setCatIcon('Folder');
  };

  const startEditCategory = (cat: NoteCategory) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatDesc(cat.description || '');
    setCatColor(cat.color || 'slate');
    setCatIcon(cat.icon || 'Folder');
  };

  // Map category ID to Category Object
  const categoryMap = useMemo(() => {
    const map = new Map<string, NoteCategory>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  // All distinct tags across all notes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(n => {
      if (Array.isArray(n.tags)) {
        n.tags.forEach(t => tagSet.add(t));
      }
    });
    return Array.from(tagSet).sort();
  }, [notes]);

  // Filtered & Sorted Notes
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      // Category filter
      if (activeCategory !== 'all' && (note.categoryId || 'general') !== activeCategory) {
        return false;
      }

      // Pinned only filter
      if (filterOnlyPinned && !note.isPinned) {
        return false;
      }

      // Favorites only filter
      if (filterOnlyFavorites && !note.isFavorite) {
        return false;
      }

      // Tag filter
      if (filterTag && (!note.tags || !note.tags.includes(filterTag))) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = (note.title || '').toLowerCase().includes(q);
        const inContent = (note.content || '').toLowerCase().includes(q);
        const inTags = (note.tags || []).some(t => t.toLowerCase().includes(q));
        if (!inTitle && !inContent && !inTags) return false;
      }

      return true;
    }).sort((a, b) => {
      // Primary: Pinned notes stay at top unless sorting alphabetically
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      if (sortBy === 'updated') {
        return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      }
      if (sortBy === 'created') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'title') {
        return (a.title || 'Untitled').localeCompare(b.title || 'Untitled');
      }
      return 0;
    });
  }, [notes, activeCategory, filterOnlyPinned, filterOnlyFavorites, filterTag, searchQuery, sortBy]);

  // Group into Pinned and Unpinned
  const pinnedNotes = useMemo(() => filteredNotes.filter(n => n.isPinned), [filteredNotes]);
  const otherNotes = useMemo(() => filteredNotes.filter(n => !n.isPinned), [filteredNotes]);

  // Word count & Char count in form
  const formStats = useMemo(() => {
    const words = formContent.trim() ? formContent.trim().split(/\s+/).length : 0;
    const chars = formContent.length;
    const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readTimeMinutes };
  }, [formContent]);

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* ── HEADER BAR ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Notes
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Categorized notebook with markdown preview, tags & instant organization
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition"
            title="Manage Categories"
          >
            <FolderPlus className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Categories</span>
          </button>

          <button
            onClick={() => openNewNote()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* ── CATEGORY TABS & FILTER CHIPS ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 border ${
              activeCategory === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>All Notes</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {notes.length}
            </span>
          </button>

          {categories.map(cat => {
            const isSelected = activeCategory === cat.id;
            const catNotesCount = notes.filter(n => (n.categoryId || 'general') === cat.id).length;
            const theme = COLOR_MAP[cat.color || 'slate'] || COLOR_MAP.slate;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 border ${
                  isSelected
                    ? `${theme.badge} border-slate-300 font-extrabold shadow-2xs`
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {renderCategoryIcon(cat.icon, 'w-3.5 h-3.5')}
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-black/10' : 'bg-slate-100 text-slate-600'
                }`}>
                  {catNotesCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── TOOLBAR: SEARCH, SORTS, TAGS & VIEW TOGGLE ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, content or tags..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters: Pinned, Starred, Tags, Sort, View Toggle */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setFilterOnlyPinned(!filterOnlyPinned)}
              className={`p-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${
                filterOnlyPinned
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Filter Pinned Notes"
            >
              <Pin className={`w-3.5 h-3.5 ${filterOnlyPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span className="hidden md:inline">Pinned</span>
            </button>

            <button
              onClick={() => setFilterOnlyFavorites(!filterOnlyFavorites)}
              className={`p-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${
                filterOnlyFavorites
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Filter Starred Notes"
            >
              <Star className={`w-3.5 h-3.5 ${filterOnlyFavorites ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span className="hidden md:inline">Favorites</span>
            </button>

            {/* Sort Select */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="updated">Recent</option>
                <option value="created">Created</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tag Filters cloud if tags exist */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">Tags:</span>
            {filterTag && (
              <button
                onClick={() => setFilterTag(null)}
                className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1 hover:bg-slate-300"
              >
                <span>Clear Tag</span>
                <X className="w-3 h-3" />
              </button>
            )}
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition flex items-center gap-1 border ${
                  filterTag === tag
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Tag className="w-2.5 h-2.5" />
                <span>{tag}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── NOTES CONTENT ── */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          Loading notes notebook...
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {searchQuery || filterTag || filterOnlyPinned || filterOnlyFavorites
                ? 'No notes match your filters'
                : 'No notes in this category yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create a new note or memo to organize your thoughts, project specs, and tasks.
            </p>
          </div>
          <button
            onClick={() => openNewNote()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs inline-flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Note</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Section */}
          {pinnedNotes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-amber-700 uppercase tracking-wider">
                <Pin className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>Pinned Notes ({pinnedNotes.length})</span>
              </div>
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
                {pinnedNotes.map(note => renderNoteCard(note))}
              </div>
            </div>
          )}

          {/* Regular Section */}
          {otherNotes.length > 0 && (
            <div className="space-y-3">
              {pinnedNotes.length > 0 && (
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-400 uppercase tracking-wider pt-2">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Other Notes ({otherNotes.length})</span>
                </div>
              )}
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
                {otherNotes.map(note => renderNoteCard(note))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: CREATE / EDIT NOTE ── */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {editingNote ? 'Edit Note' : 'Create New Note'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Supports Markdown formatting, tags, checklists & categories
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Pin toggle */}
                <button
                  type="button"
                  onClick={() => setFormIsPinned(!formIsPinned)}
                  className={`p-2 rounded-xl border transition ${
                    formIsPinned
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700'
                  }`}
                  title={formIsPinned ? 'Pinned to top' : 'Pin note'}
                >
                  <Pin className={`w-4 h-4 ${formIsPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                </button>

                {/* Star toggle */}
                <button
                  type="button"
                  onClick={() => setFormIsFavorite(!formIsFavorite)}
                  className={`p-2 rounded-xl border transition ${
                    formIsFavorite
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700'
                  }`}
                  title={formIsFavorite ? 'Starred' : 'Add to favorites'}
                >
                  <Star className={`w-4 h-4 ${formIsFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsEditorOpen(false);
                    resetNoteForm();
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Note Form */}
            <form onSubmit={handleSaveNote} className="space-y-4">
              {/* Title input */}
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Note Title..."
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 text-base font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              {/* Category, Color, and Mode controls row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {cat.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Color Tint Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Card Accent Color
                  </label>
                  <div className="flex items-center gap-1.5 pt-1">
                    {COLOR_PRESETS.map(preset => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => setFormColor(preset.key)}
                        className={`w-7 h-7 rounded-xl border flex items-center justify-center transition ${preset.bg} ${preset.border} ${
                          formColor === preset.key ? `ring-2 ${preset.activeRing} scale-110` : 'opacity-80 hover:opacity-100'
                        }`}
                        title={preset.label}
                      >
                        {formColor === preset.key && <Check className="w-3.5 h-3.5 text-slate-800" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tags Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Tags
                </label>
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl min-h-[42px]">
                  {formTags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-indigo-400 hover:text-indigo-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Add tag and press Enter..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="flex-1 min-w-[130px] bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Markdown Toolbar & Tab Switcher */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                {/* Formatting Tools */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => insertMarkdown('**', '**')}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold"
                    title="Bold (**text**)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('*', '*')}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold"
                    title="Italic (*text*)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('### ')}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold"
                    title="Heading (### )"
                  >
                    <Heading className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('- [ ] ')}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold"
                    title="Checklist (- [ ] )"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('- ')}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold"
                    title="Bullet List (- )"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('```\n', '\n```')}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold"
                    title="Code Block"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('> ')}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold"
                    title="Blockquote (> )"
                  >
                    <Quote className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Edit vs Preview Toggle */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditorTab('edit')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition flex items-center gap-1 ${
                      editorTab === 'edit' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    <Edit className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('preview')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition flex items-center gap-1 ${
                      editorTab === 'preview' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                </div>
              </div>

              {/* Editor / Preview Content Box */}
              {editorTab === 'edit' ? (
                <textarea
                  ref={textareaRef}
                  rows={12}
                  placeholder="Type your notes in Markdown here...&#10;&#10;# Title&#10;- [ ] Checklist item&#10;- Bullet point&#10;> Quote"
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs md:text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-y leading-relaxed"
                />
              ) : (
                <div className="min-h-[260px] max-h-[420px] overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  {formContent.trim() ? (
                    <MarkdownRenderer content={formContent} />
                  ) : (
                    <p className="text-xs text-slate-400 italic">No content to preview yet.</p>
                  )}
                </div>
              )}

              {/* Stats Footer bar */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold pt-1">
                <div className="flex items-center gap-3">
                  <span>{formStats.words} words</span>
                  <span>{formStats.chars} chars</span>
                  <span>~{formStats.readTimeMinutes} min read</span>
                </div>
                <div>
                  Markdown supported
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditorOpen(false);
                    resetNoteForm();
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNote}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2"
                >
                  {savingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CATEGORY MANAGEMENT ── */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-indigo-600" />
                  <span>Manage Categories</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Organize your notes into customized groups
                </p>
              </div>
              <button
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  resetCatForm();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Existing Categories List */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Existing Categories
              </label>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {categories.map(cat => {
                  const catNotesCount = notes.filter(n => (n.categoryId || 'general') === cat.id).length;
                  const theme = COLOR_MAP[cat.color || 'slate'] || COLOR_MAP.slate;

                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl border ${theme.badge}`}>
                          {renderCategoryIcon(cat.icon, 'w-4 h-4')}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-slate-900">{cat.name}</span>
                            {cat.isDefault && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-600">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {catNotesCount} note{catNotesCount !== 1 ? 's' : ''} {cat.description ? `• ${cat.description}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditCategory(cat)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition"
                          title="Edit Category"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {!cat.isDefault && cat.id !== 'general' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Create / Edit Category Form */}
            <form onSubmit={handleSaveCategory} className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  {editingCat ? `Edit Category: ${editingCat.name}` : 'Create New Category'}
                </span>
                {editingCat && (
                  <button
                    type="button"
                    onClick={resetCatForm}
                    className="text-[11px] text-slate-500 hover:underline"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Category Name (e.g. Finance, Architecture, Recipes)"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Optional description..."
                  value={catDesc}
                  onChange={e => setCatDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Color & Icon Selector */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Color
                  </label>
                  <select
                    value={catColor}
                    onChange={e => setCatColor(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                  >
                    {COLOR_PRESETS.map(p => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Icon
                  </label>
                  <select
                    value={catIcon}
                    onChange={e => setCatIcon(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                  >
                    <option value="Folder">Folder</option>
                    <option value="Briefcase">Briefcase</option>
                    <option value="Sparkles">Sparkles</option>
                    <option value="Heart">Heart</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!catName.trim()}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition"
                >
                  {editingCat ? 'Update Category' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // Helper to render Note Card
  function renderNoteCard(note: NoteItem) {
    const category = categoryMap.get(note.categoryId || 'general');
    const colorTheme = COLOR_MAP[note.color || 'slate'] || COLOR_MAP.slate;
    const catTheme = COLOR_MAP[category?.color || 'slate'] || COLOR_MAP.slate;

    return (
      <div
        key={note.id}
        onClick={() => openEditNote(note)}
        className={`group border rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between ${colorTheme.bg} ${colorTheme.border} ${
          note.isPinned ? 'ring-1 ring-amber-300' : ''
        }`}
      >
        <div>
          {/* Header Row: Category Badge & Pin/Star icons */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              onClick={e => {
                e.stopPropagation();
                setActiveCategory(note.categoryId || 'general');
              }}
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-1 transition ${catTheme.badge} hover:opacity-80`}
            >
              {renderCategoryIcon(category?.icon, 'w-3 h-3')}
              <span>{category?.name || 'General'}</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleTogglePin(note);
                }}
                className={`p-1 rounded-md transition ${
                  note.isPinned
                    ? 'text-amber-500 fill-amber-500 hover:text-amber-600'
                    : 'text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100'
                }`}
                title={note.isPinned ? 'Unpin' : 'Pin to top'}
              >
                <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-amber-500' : ''}`} />
              </button>

              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleToggleFavorite(note);
                }}
                className={`p-1 rounded-md transition ${
                  note.isFavorite
                    ? 'text-amber-500 fill-amber-500 hover:text-amber-600'
                    : 'text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100'
                }`}
                title={note.isFavorite ? 'Unfavorite' : 'Favorite'}
              >
                <Star className={`w-3.5 h-3.5 ${note.isFavorite ? 'fill-amber-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* Title */}
          <h4 className="text-sm font-black text-slate-900 leading-snug line-clamp-2 mb-1.5">
            {note.title || 'Untitled Note'}
          </h4>

          {/* Content snippet */}
          <div className="text-xs text-slate-600 line-clamp-4 leading-relaxed mb-3">
            <MarkdownRenderer content={note.content || '(Empty note)'} />
          </div>

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mb-3">
              {note.tags.map(tag => (
                <span
                  key={tag}
                  onClick={e => {
                    e.stopPropagation();
                    setFilterTag(tag);
                  }}
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="border-t border-slate-100/80 pt-2.5 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1 font-medium">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>
              {new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                handleCopyNote(note);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
              title="Copy Note Text"
            >
              {copiedNoteId === note.id ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                handleExportNote(note);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
              title="Export as Markdown (.md)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                handleDuplicateNote(note);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
              title="Duplicate Note"
            >
              <Files className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                handleDeleteNote(note.id, note.title);
              }}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
              title="Delete Note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }
};
