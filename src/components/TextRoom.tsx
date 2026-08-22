import React, { useState, useEffect } from 'react';
import { 
  FileText, Lock, Unlock, RefreshCw, Plus, 
  ExternalLink, Key, Check, AlertCircle, Share2, Search, X
} from 'lucide-react';

interface TextRoomProps {
  initialRoomId?: string;
  onRoomChange: (roomId: string | null) => void;
}

export const TextRoom: React.FC<TextRoomProps> = ({ initialRoomId, onRoomChange }) => {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(initialRoomId || null);
  
  // Creation state
  const [createRoomId, setCreateRoomId] = useState('');
  const [createEditKey, setCreateEditKey] = useState('');
  const [createContent, setCreateContent] = useState('');
  
  // Viewing/Editing state
  const [roomContent, setRoomContent] = useState('');
  const [inputEditKey, setInputEditKey] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Search/Join room state
  const [joinRoomId, setJoinRoomId] = useState('');

  // Status feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch Room content from SWA API
  const fetchRoomContent = async (roomId: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/rooms/${roomId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Room '${roomId}' not found.`);
        }
        throw new Error('Failed to fetch room details from server.');
      }
      const data = await response.json();
      setRoomContent(data.content);
      setActiveRoomId(roomId);
      onRoomChange(roomId);

      // Check if we have the edit key cached in localStorage
      const cachedKeys = localStorage.getItem('shudkara_room_keys');
      const keysMap = cachedKeys ? JSON.parse(cachedKeys) : {};
      const cachedKey = keysMap[roomId];

      if (cachedKey) {
        setInputEditKey(cachedKey);
        setIsUnlocked(true);
      } else {
        setInputEditKey('');
        setIsUnlocked(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setActiveRoomId(null);
      onRoomChange(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Load a room on startup if ID exists
  useEffect(() => {
    if (initialRoomId) {
      setActiveRoomId(initialRoomId);
      fetchRoomContent(initialRoomId);
    }
  }, [initialRoomId]);

  // Create room handler
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEditKey.trim()) {
      setErrorMsg('Edit passcode/key is required to secure the room.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: createRoomId.trim() || undefined,
          editKey: createEditKey,
          content: createContent
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create text room.');
      }

      // Cache the key in local storage so they can edit easily
      const cachedKeys = localStorage.getItem('shudkara_room_keys');
      const keysMap = cachedKeys ? JSON.parse(cachedKeys) : {};
      keysMap[data.roomId] = createEditKey;
      localStorage.setItem('shudkara_room_keys', JSON.stringify(keysMap));

      // Reset form
      setCreateRoomId('');
      setCreateEditKey('');
      setCreateContent('');

      // Open new room
      setActiveRoomId(data.roomId);
      onRoomChange(data.roomId);
      setRoomContent(createContent);
      setInputEditKey(createEditKey);
      setIsUnlocked(true);
      setSuccessMsg('Text room created successfully!');
      
      // Clear success msg
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Save room modifications
  const handleSaveChanges = async () => {
    if (!activeRoomId) return;
    if (!inputEditKey.trim()) {
      setErrorMsg('Enter the edit key to save changes.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(`/api/rooms/${activeRoomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editKey: inputEditKey,
          content: roomContent
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setIsUnlocked(false);
          throw new Error('Incorrect edit key. Save rejected.');
        }
        throw new Error(data.error || 'Failed to save changes.');
      }

      // Cache correct key just in case it wasn't cached before
      const cachedKeys = localStorage.getItem('shudkara_room_keys');
      const keysMap = cachedKeys ? JSON.parse(cachedKeys) : {};
      keysMap[activeRoomId] = inputEditKey;
      localStorage.setItem('shudkara_room_keys', JSON.stringify(keysMap));

      setIsUnlocked(true);
      setSuccessMsg('Changes saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlockLocal = () => {
    if (!inputEditKey.trim()) {
      setErrorMsg('Please enter an edit key.');
      return;
    }
    // Set unlocked in UI. The actual verification will occur upon clicking Save
    setIsUnlocked(true);
    setErrorMsg(null);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim()) return;
    fetchRoomContent(joinRoomId.trim().toLowerCase());
    setJoinRoomId('');
  };

  const copyRoomLink = () => {
    if (!activeRoomId) return;
    const shareUrl = `${window.location.origin}?room=${activeRoomId}`;
    navigator.clipboard.writeText(shareUrl);
    setSuccessMsg('Room share link copied!');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleLeaveRoom = () => {
    setActiveRoomId(null);
    onRoomChange(null);
    setRoomContent('');
    setInputEditKey('');
    setIsUnlocked(false);
    setErrorMsg(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-16">
      
      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold flex-1">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center gap-3">
          <Check className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold flex-1">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main room view if active */}
      {activeRoomId ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          
          {/* Header panel */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-650 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-0.5 rounded">
                Active Room
              </span>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="text-indigo-600 w-5 h-5" />
                {activeRoomId}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => fetchRoomContent(activeRoomId)}
                disabled={isLoading}
                title="Refresh from server"
                className="p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-750 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={copyRoomLink}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-750 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Copy Link
              </button>

              <button
                onClick={handleLeaveRoom}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-xl transition-colors"
              >
                Exit Room
              </button>
            </div>
          </div>

          {/* Locked / Unlocked edit bar */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isUnlocked 
              ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/15 dark:border-emerald-900/30' 
              : 'bg-amber-50/70 border-amber-100 dark:bg-amber-950/15 dark:border-amber-900/30'
          }`}>
            {isUnlocked ? (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 text-xs font-semibold">
                  <Unlock className="w-4 h-4 shrink-0" />
                  <span>Editor Unlocked. Click Save below when done.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">Passcode loaded:</span>
                  <input
                    type="password"
                    value={inputEditKey}
                    onChange={(e) => setInputEditKey(e.target.value)}
                    className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 dark:text-white rounded text-xs font-mono w-28 text-center"
                    placeholder="Edit Key"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 text-xs font-semibold">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Viewing Mode (Read-only). Enter passcode to edit:</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter Edit Key"
                    value={inputEditKey}
                    onChange={(e) => setInputEditKey(e.target.value)}
                    className="px-3 py-1.5 text-xs font-mono text-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 dark:text-white rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                  <button
                    onClick={handleUnlockLocal}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition-colors"
                  >
                    Unlock
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Text Editor Area */}
          <div className="space-y-3">
            <textarea
              placeholder="Start typing some text or code..."
              value={roomContent}
              onChange={(e) => setRoomContent(e.target.value)}
              disabled={!isUnlocked || isSaving}
              rows={15}
              className="w-full font-mono text-sm bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 p-4 rounded-2xl border border-slate-200 dark:border-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-85 shadow-inner"
            />
            
            {isUnlocked && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-500/10 hover:shadow-indigo-600/20 transition-all"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* Create & Join dashboard views if no active room */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Create a Room Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col justify-between">
            <form onSubmit={handleCreateRoom} className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Plus className="text-indigo-600 w-5 h-5" />
                  Create a Text Room
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Launch a new shared pad and protect it with a key.
                </p>
              </div>

              {/* Room ID Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Room Name / ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. secret-notes-123 (auto if empty)"
                  value={createRoomId}
                  onChange={(e) => setCreateRoomId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Edit Key Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Edit Passcode / Key (Required)
                </label>
                <input
                  type="password"
                  placeholder="Choose a passcode to lock modifications"
                  required
                  value={createEditKey}
                  onChange={(e) => setCreateEditKey(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Initial content */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Initial Content (Optional)
                </label>
                <textarea
                  placeholder="Paste snippets or notes to initialize with..."
                  rows={4}
                  value={createContent}
                  onChange={(e) => setCreateContent(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-500/10 hover:shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Create & Launch Room
              </button>
            </form>
          </div>

          {/* Join a Room Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col justify-between">
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Search className="text-indigo-600 w-5 h-5" />
                  Join Existing Room
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Access a room created by yourself or shared by a team member.
                </p>
              </div>

              <form onSubmit={handleJoinRoom} className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Enter Room Name / ID"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !joinRoomId.trim()}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 dark:bg-slate-750 dark:hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition-all"
                >
                  Retrieve Room
                </button>
              </form>

              {/* Cached local rooms list */}
              <LocalRoomsList onSelectRoom={fetchRoomContent} />
            </div>

            <div className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/45 p-4 rounded-xl border border-slate-100 dark:border-slate-850 text-center leading-relaxed mt-6">
              Rooms can be read publicly without auth, but saving edits requires the secret passcode chosen at room creation.
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

// Sub-component to list cached rooms
interface LocalRoomsListProps {
  onSelectRoom: (roomId: string) => void;
}

const LocalRoomsList: React.FC<LocalRoomsListProps> = ({ onSelectRoom }) => {
  const [rooms, setRooms] = useState<string[]>([]);

  useEffect(() => {
    const cachedKeys = localStorage.getItem('shudkara_room_keys');
    if (cachedKeys) {
      try {
        const keysMap = JSON.parse(cachedKeys);
        setRooms(Object.keys(keysMap));
      } catch (e) {
        console.error('Failed to parse cached room keys:', e);
      }
    }
  }, []);

  const handleClearCachedList = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Clear your history of visited/created rooms? This does not delete rooms on the server.')) {
      localStorage.removeItem('shudkara_room_keys');
      setRooms([]);
    }
  };

  if (rooms.length === 0) return null;

  return (
    <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-400 uppercase tracking-wider">Your Recents</span>
        <button
          onClick={handleClearCachedList}
          className="text-slate-400 hover:text-rose-500 transition-colors font-medium"
        >
          Clear history
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
        {rooms.map((roomId) => (
          <button
            key={roomId}
            onClick={() => onSelectRoom(roomId)}
            className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850/80 text-xs font-semibold text-slate-700 dark:text-slate-350 border border-slate-150 dark:border-slate-800/60 rounded-xl transition-all text-left"
          >
            <span className="truncate flex-1 mr-2">{roomId}</span>
            <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
