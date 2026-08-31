import React, { useState, useEffect, useRef } from 'react';
import { 
  Tag, Search, Plus, Trash2, Edit2, Image, 
  Video, Film, Check, AlertCircle, X, ChevronDown, 
  Loader2, Sparkles, BookOpen, Clock, FolderOpen
} from 'lucide-react';

interface MediaItem {
  googleDriveId: string;
  fileName: string;
  mimeType: string;
  viewUrl: string;
  thumbnailUrl: string;
}

interface Post {
  _id: string;
  title?: string;
  content: string;
  timestamp: string;
  createdAt: string;
  category: string;
  tags: string[];
  media?: MediaItem[];
}

interface LifetimeLineProps {
  authToken?: string | null;
}

export const LifetimeLine: React.FC<LifetimeLineProps> = ({ authToken }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [limit] = useState(10);
  const [skip, setSkip] = useState(0);

  // New Post Form
  const [showCreator, setShowCreator] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [rawTags, setRawTags] = useState('');
  const [timestamp, setTimestamp] = useState(new Date().toISOString().substring(0, 16));
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; type: string; base64: string }[]>([]);

  // Editing state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editRawTags, setEditRawTags] = useState('');
  const [editTimestamp, setEditTimestamp] = useState('');
  const [syncing, setSyncing] = useState(false);

  const handleSyncDrive = async () => {
    if (!authToken || syncing) return;
    setSyncing(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/timeline/sync-drive', {
        method: 'POST',
        headers: { 'X-Session-Token': authToken }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Sync successful');
        fetchPosts(true);
        fetchFilterMetadata();
      } else {
        setErrorMsg(data.error || 'Failed to sync Google Drive.');
      }
    } catch {
      setErrorMsg('Network error occurred during Google Drive sync.');
    } finally {
      setSyncing(false);
    }
  };

  // Media Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxMime, setLightboxMime] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch posts & filter options
  const fetchFilterMetadata = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/timeline/tags', {
        headers: { 'X-Session-Token': authToken }
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setTags(data.tags || []);
      }
    } catch {}
  };

  const fetchPosts = async (reset = false) => {
    if (!authToken) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const currentSkip = reset ? 0 : skip;
      const url = new URL('/api/timeline', window.location.origin);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('skip', String(currentSkip));
      if (search) url.searchParams.set('search', search);
      if (selectedCategory) url.searchParams.set('category', selectedCategory);
      if (selectedTag) url.searchParams.set('tag', selectedTag);

      const res = await fetch(url.toString(), {
        headers: { 'X-Session-Token': authToken }
      });
      const data = await res.json();

      if (res.ok) {
        if (reset) {
          setPosts(data.posts || []);
          setSkip(limit);
        } else {
          setPosts(prev => [...prev, ...(data.posts || [])]);
          setSkip(prev => prev + limit);
        }
        setTotal(data.total || 0);
      } else {
        setErrorMsg(data.error || 'Failed to load timeline feed.');
      }
    } catch {
      setErrorMsg('Network error while loading timeline feed.');
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when filters change
  useEffect(() => {
    if (authToken) {
      fetchPosts(true);
      fetchFilterMetadata();
    }
  }, [search, selectedCategory, selectedTag, authToken]);

  // Convert files to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFiles(prev => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            base64: reader.result as string
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Submit new post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !authToken) return;

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-Token': authToken
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category: category.trim(),
          tags: rawTags.split(',').map(t => t.trim()).filter(Boolean),
          timestamp: new Date(timestamp).toISOString(),
          mediaFiles: selectedFiles
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTitle('');
        setContent('');
        setCategory('General');
        setRawTags('');
        setSelectedFiles([]);
        setTimestamp(new Date().toISOString().substring(0, 16));
        setShowCreator(false);
        fetchPosts(true);
        fetchFilterMetadata();
      } else {
        setErrorMsg(data.error || 'Failed to create post.');
      }
    } catch {
      setErrorMsg('Network error. Check connection or file upload size.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete post
  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this memory? Media will be deleted from Google Drive.') || !authToken) return;

    try {
      const res = await fetch(`/api/timeline/${id}`, {
        method: 'DELETE',
        headers: { 'X-Session-Token': authToken }
      });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p._id !== id));
        setTotal(t => t - 1);
        fetchFilterMetadata();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete post.');
      }
    } catch {
      alert('Network error.');
    }
  };

  // Trigger editing inline
  const startEdit = (post: Post) => {
    setEditingPostId(post._id);
    setEditTitle(post.title || '');
    setEditContent(post.content);
    setEditCategory(post.category);
    setEditRawTags(post.tags.join(', '));
    setEditTimestamp(new Date(post.timestamp).toISOString().substring(0, 16));
  };

  const handleUpdatePost = async (id: string) => {
    if (!editContent.trim() || !authToken) return;

    try {
      const res = await fetch(`/api/timeline/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          category: editCategory.trim(),
          tags: editRawTags.split(',').map(t => t.trim()).filter(Boolean),
          timestamp: new Date(editTimestamp).toISOString()
        })
      });

      if (res.ok) {
        setPosts(prev => prev.map(p => {
          if (p._id === id) {
            return {
              ...p,
              title: editTitle.trim(),
              content: editContent.trim(),
              category: editCategory.trim(),
              tags: editRawTags.split(',').map(t => t.trim()).filter(Boolean),
              timestamp: new Date(editTimestamp).toISOString()
            };
          }
          return p;
        }));
        setEditingPostId(null);
        fetchFilterMetadata();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update post.');
      }
    } catch {
      alert('Network error.');
    }
  };

  // Format date helper
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return {
      day: date.getDate(),
      month: date.toLocaleString('default', { month: 'short' }),
      year: date.getFullYear(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  // If not logged in
  if (!authToken) {
    return (
      <div className="max-w-md mx-auto my-16 text-center space-y-4">
        <div className="inline-flex p-4 bg-red-50 text-red-500 rounded-full">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Authentication Required</h2>
        <p className="text-slate-500 text-sm">Please log in to view or manage your personal Lifetime Line timeline feed.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 select-none">
      
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-amber-500" />
            Lifetime Line
          </h1>
          <p className="text-sm text-slate-500">Your personal chronicle & timeline vault</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncDrive}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold rounded-xl text-sm transition shadow-sm"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <Clock className="w-4 h-4 text-slate-500" />}
            {syncing ? 'Syncing...' : 'Sync GDrive'}
          </button>
          
          <button
            onClick={() => setShowCreator(!showCreator)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-sm"
          >
            {showCreator ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showCreator ? 'Close' : 'Document Moment'}
          </button>
        </div>
      </div>

      {/* ── Post Creator Form ── */}
      {showCreator && (
        <form onSubmit={handleCreatePost} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Title (Optional)</label>
              <input
                type="text"
                placeholder="What happened?"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Date & Time (Can backdate)</label>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={e => setTimestamp(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Write entry</label>
            <textarea
              placeholder="Record your thoughts or event details. Markdown is supported..."
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-sans resize-y"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Category</label>
              <input
                type="text"
                placeholder="e.g. Travel, Career, Health, Daily"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Tags (comma separated)</label>
              <input
                type="text"
                placeholder="e.g. trip, promotion, family"
                value={rawTags}
                onChange={e => setRawTags(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>
          </div>

          {/* Media Attachments Dropzone */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Attach Media (Images, Videos to Google Drive)</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50 flex flex-col items-center gap-1.5"
            >
              <Image className="w-6 h-6 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600">Drag files here or click to browse</p>
              <p className="text-[10px] text-slate-400">Supports images and videos. Uploaded directly to your secure Google Drive.</p>
              <input 
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Selected Files Preview List */}
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700">
                    {file.type.startsWith('video/') ? <Video className="w-3.5 h-3.5 text-blue-500" /> : <Image className="w-3.5 h-3.5 text-teal-500" />}
                    <span className="truncate max-w-[150px] font-mono">{file.name}</span>
                    <button 
                      type="button" 
                      onClick={() => removeSelectedFile(idx)}
                      className="text-slate-400 hover:text-red-500 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading media to Google Drive & saving...</>
            ) : (
              <><Check className="w-4 h-4" /> Save Moment</>
            )}
          </button>
        </form>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* ── Filter & Search Bar ── */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search moments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <FolderOpen className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer text-slate-700"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Tag Filter */}
        <div className="relative">
          <Tag className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <select
            value={selectedTag}
            onChange={e => setSelectedTag(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer text-slate-700"
          >
            <option value="">All Tags</option>
            {tags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Feed Timeline List ── */}
      {loading && posts.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-2 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-xs font-semibold">Retrieving your timeline chronicle...</span>
        </div>
      ) : (
        <div className="relative border-l border-slate-200 ml-6 pl-8 space-y-8 py-4">
          
          {posts.map((post) => {
            const dt = formatDate(post.timestamp);
            const isEditing = editingPostId === post._id;

            return (
              <div key={post._id} className="relative group animate-in fade-in duration-200">
                {/* Timeline Dot */}
                <div className="absolute -left-[45px] top-1.5 w-8 h-8 bg-white border-2 border-slate-200 group-hover:border-blue-500 rounded-full flex flex-col items-center justify-center shadow-sm text-[9px] font-bold text-slate-600 transition">
                  {dt.day}
                  <span className="text-[7px] uppercase -mt-0.5">{dt.month}</span>
                </div>

                {/* Post Body Container */}
                <div className="bg-white border border-slate-100 hover:border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-4">
                  
                  {isEditing ? (
                    // ── Editing view ──
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          placeholder="Title"
                          className="md:col-span-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50"
                        />
                        <input
                          type="datetime-local"
                          value={editTimestamp}
                          onChange={e => setEditTimestamp(e.target.value)}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50"
                        />
                      </div>
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 resize-y"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editCategory}
                          onChange={e => setEditCategory(e.target.value)}
                          placeholder="Category"
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50"
                        />
                        <input
                          type="text"
                          value={editRawTags}
                          onChange={e => setEditRawTags(e.target.value)}
                          placeholder="Tags (comma separated)"
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingPostId(null)}
                          className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdatePost(post._id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ── Display view ──
                    <>
                      {/* Top bar with category & actions */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-amber-50 border border-amber-100 text-amber-700 font-extrabold uppercase tracking-wider rounded-lg text-[9px]">
                            {post.category}
                          </span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {dt.time}, {dt.year}
                          </span>
                        </div>
                        
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition">
                          <button 
                            onClick={() => startEdit(post)}
                            className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg hover:bg-slate-50 transition"
                            title="Edit memory"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeletePost(post._id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-50 transition"
                            title="Delete memory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-2">
                        {post.title && (
                          <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">{post.title}</h3>
                        )}
                        <p className="text-sm text-slate-600 leading-relaxed font-sans whitespace-pre-wrap">
                          {post.content}
                        </p>
                      </div>

                      {/* Attachments rendering */}
                      {post.media && post.media.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                          {post.media.map((file, fIdx) => (
                            <div 
                              key={fIdx} 
                              onClick={() => { setLightboxUrl(file.viewUrl); setLightboxMime(file.mimeType); }}
                              className="relative border border-slate-100 rounded-2xl overflow-hidden cursor-pointer hover:opacity-95 transition bg-slate-50 aspect-video group/media"
                            >
                              {file.mimeType.startsWith('video/') ? (
                                <div className="w-full h-full flex flex-col items-center justify-center relative">
                                  <Film className="w-8 h-8 text-slate-400 group-hover/media:scale-110 transition duration-150" />
                                  <span className="text-[10px] font-mono text-slate-400 absolute bottom-2">{file.fileName}</span>
                                </div>
                              ) : (
                                <img 
                                  src={file.viewUrl} 
                                  alt={file.fileName} 
                                  className="w-full h-full object-cover group-hover/media:scale-105 transition duration-200" 
                                  loading="lazy"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tags */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {post.tags.map(t => (
                            <span 
                              key={t} 
                              onClick={() => setSelectedTag(t === selectedTag ? '' : t)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition ${
                                selectedTag === t 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                              }`}
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && posts.length === 0 && (
        <div className="text-center py-20 border border-dashed border-slate-200 rounded-3xl bg-slate-50 space-y-3">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-600">Timeline is empty</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">No memories documented yet. Try clicking "Document Moment" above to write your first entry.</p>
        </div>
      )}

      {/* ── Load More / Pagination ── */}
      {posts.length < total && !loading && (
        <button
          onClick={() => fetchPosts(false)}
          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition border border-slate-200 shadow-sm"
        >
          Load Older Memories
        </button>
      )}

      {/* ── Lightbox Overlay Modal ── */}
      {lightboxUrl && (
        <div 
          onClick={() => { setLightboxUrl(null); setLightboxMime(null); }}
          className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-[999] animate-in fade-in duration-200 cursor-zoom-out"
        >
          <button className="absolute top-4 right-4 text-white hover:text-slate-300 bg-white/10 p-2 rounded-full transition">
            <X className="w-6 h-6" />
          </button>
          
          <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl" onClick={e => e.stopPropagation()}>
            {lightboxMime?.startsWith('video/') ? (
              <video 
                src={lightboxUrl} 
                controls 
                autoPlay 
                className="max-w-full max-h-[85vh] rounded-2xl outline-none" 
              />
            ) : (
              <img 
                src={lightboxUrl} 
                alt="Enlarged view" 
                className="max-w-full max-h-[85vh] object-contain rounded-2xl" 
              />
            )}
          </div>
        </div>
      )}

    </div>
  );
};
