import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, Plus, FolderPlus, Tag, Trash2, Edit3, Image as ImageIcon, 
  Search, Lock, RefreshCw, X, Check,
  Layers, Shield, Camera, Upload
} from 'lucide-react';
import { MediaLightboxModal } from './MediaLightboxModal';
import type { LightboxMediaItem } from './MediaLightboxModal';

export interface InventoryGroup {
  _id: string;
  name: string;
  description: string;
  color?: string;
  createdAt: string;
}

export interface InventoryItem {
  _id: string;
  groupId: string;
  name: string;
  description: string;
  tags: string[];
  images: { fileId: string; viewUrl: string; thumbnailUrl: string }[];
  quantity: number;
  createdAt: string;
}

interface InventoryProps {
  authToken: string | null;
}

interface LiveCameraModalProps {
  onCapture: (base64: string, fileName: string) => void;
  onClose: () => void;
}

const LiveCameraModal: React.FC<LiveCameraModalProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startStream = async () => {
      setErrorMsg(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        setErrorMsg('Camera access denied or unavailable. You can use the direct camera upload button.');
      }
    };
    startStream();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [facingMode]);

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      onCapture(dataUrl, `camera_${Date.now()}.jpg`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 text-white rounded-3xl w-full max-w-lg p-5 shadow-2xl space-y-4 border border-slate-700 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-blue-400">
            <Camera className="w-5 h-5" />
            <span>Live Camera Snapshot</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg ? (
          <div className="p-4 bg-red-900/40 border border-red-700/60 rounded-2xl text-xs text-red-200 leading-relaxed">
            {errorMsg}
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-800">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl text-slate-300 transition"
          >
            Flip Camera 🔄
          </button>

          <button
            type="button"
            onClick={handleTakeSnapshot}
            disabled={!!errorMsg}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Snap Photo
          </button>
        </div>
      </div>
    </div>
  );
};

export const Inventory: React.FC<InventoryProps> = ({ authToken }) => {
  const [groups, setGroups] = useState<InventoryGroup[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Modal States
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupEditing, setGroupEditing] = useState<InventoryGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupColor, setGroupColor] = useState('blue');

  const [showItemModal, setShowItemModal] = useState(false);
  const [itemEditing, setItemEditing] = useState<InventoryItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemGroupId, setItemGroupId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemTagsInput, setItemTagsInput] = useState('');
  
  // Image Upload, Staging & Camera State
  const [itemImages, setItemImages] = useState<{ fileId: string; viewUrl: string; thumbnailUrl: string }[]>([]);
  const [stagedFiles, setStagedFiles] = useState<{ id: string; name: string; type: string; base64Data: string }[]>([]);
  const [savingItem, setSavingItem] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // Lightbox State
  const [lightboxItems, setLightboxItems] = useState<LightboxMediaItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Session-Token': authToken || ''
  });

  const fetchData = async () => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [resGroups, resItems] = await Promise.all([
        fetch('/api/inventory/groups', { headers: getHeaders() }),
        fetch('/api/inventory/items', { headers: getHeaders() })
      ]);

      if (resGroups.ok && resItems.ok) {
        const groupsData = await resGroups.json();
        const itemsData = await resItems.json();
        setGroups(groupsData);
        setItems(itemsData);
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
      triggerToast('Error loading inventory data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authToken]);

  // ── Group Actions ──
  const handleOpenGroupModal = (group?: InventoryGroup) => {
    if (group) {
      setGroupEditing(group);
      setGroupName(group.name);
      setGroupDesc(group.description || '');
      setGroupColor(group.color || 'blue');
    } else {
      setGroupEditing(null);
      setGroupName('');
      setGroupDesc('');
      setGroupColor('blue');
    }
    setShowGroupModal(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      const url = groupEditing 
        ? `/api/inventory/groups/${groupEditing._id}`
        : '/api/inventory/groups';
      const method = groupEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          name: groupName,
          description: groupDesc,
          color: groupColor
        })
      });

      if (res.ok) {
        triggerToast(groupEditing ? 'Group updated' : 'Inventory group created');
        setShowGroupModal(false);
        fetchData();
      } else {
        triggerToast('Failed to save group', 'error');
      }
    } catch (err) {
      triggerToast('Network error', 'error');
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!window.confirm(`Are you sure you want to delete group "${groupName}"? All items under this group will also be deleted.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/inventory/groups/${groupId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (res.ok) {
        triggerToast('Group deleted');
        if (activeGroupId === groupId) setActiveGroupId('all');
        fetchData();
      }
    } catch (err) {
      triggerToast('Failed to delete group', 'error');
    }
  };

  // ── Item Actions ──
  const handleOpenItemModal = (item?: InventoryItem) => {
    if (item) {
      setItemEditing(item);
      setItemName(item.name);
      setItemDesc(item.description || '');
      setItemGroupId(item.groupId);
      setItemQuantity(item.quantity || 1);
      setItemTagsInput((item.tags || []).join(', '));
      setItemImages(item.images || []);
    } else {
      setItemEditing(null);
      setItemName('');
      setItemDesc('');
      setItemGroupId(activeGroupId !== 'all' ? activeGroupId : (groups[0]?._id || ''));
      setItemQuantity(1);
      setItemTagsInput('');
      setItemImages([]);
    }
    setStagedFiles([]);
    setShowItemModal(true);
  };

  const stageBase64Image = (base64Data: string, fileName: string, mimeType: string = 'image/jpeg') => {
    setStagedFiles(prev => [
      ...prev,
      {
        id: `staged_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: fileName,
        type: mimeType,
        base64Data
      }
    ]);
    triggerToast('Photo staged for upload (will save to Google Drive when submitted)', 'info');
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        triggerToast(`Skipping ${file.name}: Not an image`, 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        stageBase64Image(base64Data, file.name, file.type);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveExistingImage = (index: number) => {
    setItemImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveStagedFile = (id: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemGroupId) {
      triggerToast('Item name and group are required', 'error');
      return;
    }

    setSavingItem(true);
    try {
      const uploadedDriveImages: { fileId: string; viewUrl: string; thumbnailUrl: string }[] = [];
      
      // Upload staged files sequentially
      for (let i = 0; i < stagedFiles.length; i++) {
        const staged = stagedFiles[i];
        triggerToast(`Uploading file ${i + 1} of ${stagedFiles.length} to Google Drive...`, 'info');
        
        const res = await fetch('/api/inventory/upload', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            fileName: staged.name,
            mimeType: staged.type,
            base64Data: staged.base64Data
          })
        });

        if (res.ok) {
          const data = await res.json();
          uploadedDriveImages.push({
            fileId: data.fileId,
            viewUrl: data.viewUrl,
            thumbnailUrl: data.thumbnailUrl
          });
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.details || errData.error || `Failed to upload ${staged.name}`);
        }
      }

      const finalImages = [...itemImages, ...uploadedDriveImages];
      const tags = itemTagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const url = itemEditing 
        ? `/api/inventory/items/${itemEditing._id}`
        : '/api/inventory/items';
      const method = itemEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          name: itemName,
          description: itemDesc,
          groupId: itemGroupId,
          quantity: itemQuantity,
          tags,
          images: finalImages
        })
      });

      if (res.ok) {
        triggerToast(itemEditing ? 'Item updated & synced' : 'Inventory item saved');
        setShowItemModal(false);
        setStagedFiles([]);
        fetchData();
      } else {
        triggerToast('Failed to save item', 'error');
      }
    } catch (err: any) {
      triggerToast(`Error saving item: ${err.message || err}`, 'error');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (!window.confirm(`Are you sure you want to delete item "${itemName}"?`)) return;

    try {
      const res = await fetch(`/api/inventory/items/${itemId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (res.ok) {
        triggerToast('Item deleted');
        fetchData();
      }
    } catch (err) {
      triggerToast('Failed to delete item', 'error');
    }
  };

  // ── Unauthenticated Private Privacy Model Guard ──
  if (!authToken) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md shadow-xl space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900">Private Inventory Vault</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Under Shudkara permission model, personal inventories are strictly private and accessible only to the authenticated owner.
            </p>
          </div>
          <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
            Please Log In with your TOTP Authenticator code to access your personal inventory.
          </p>
        </div>
      </div>
    );
  }

  // Filtered Items
  const allTags = Array.from(new Set(items.flatMap(i => i.tags || [])));
  const filteredItems = items.filter(item => {
    const matchesGroup = activeGroupId === 'all' || item.groupId === activeGroupId;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'all' || (item.tags || []).includes(selectedTag);
    return matchesGroup && matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border text-white transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' :
          toast.type === 'error' ? 'bg-rose-600 border-rose-500' : 'bg-blue-600 border-blue-500'
        }`}>
          <Check className="w-4 h-4" />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 text-xs font-extrabold uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4 text-emerald-600" />
            Private Inventory Management
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Personal Belongings & Vault
          </h1>
          <p className="text-xs text-slate-500 max-w-xl">
            Organize personal items into custom groups (dresses, utensils, books, electronics). Upload item images stored safely in your Google Drive <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono">StorageBuckets/ShudkaraBucket/Inventory</code> subfolder.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => handleOpenGroupModal()}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition shadow-sm"
          >
            <FolderPlus className="w-4 h-4 text-blue-600" />
            New Group
          </button>
          <button
            onClick={() => handleOpenItemModal()}
            disabled={groups.length === 0}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/10 transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Group Selector & Filter Toolbar */}
      <div className="space-y-4">
        
        {/* Groups Horizontal Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-sm">
          <button
            onClick={() => setActiveGroupId('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeGroupId === 'all'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Items</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20">
              {items.length}
            </span>
          </button>

          {groups.map((group) => {
            const isSelected = activeGroupId === group._id;
            const groupItemCount = items.filter(i => i.groupId === group._id).length;

            return (
              <div key={group._id} className="flex items-center gap-1">
                <button
                  onClick={() => setActiveGroupId(group._id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>{group.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {groupItemCount}
                  </span>
                </button>

                {isSelected && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenGroupModal(group)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                      title="Edit Group"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group._id, group.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                      title="Delete Group"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Search & Tag Filter Bar */}
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex flex-col md:flex-row flex-wrap items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search items by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0">
                <Tag className="w-3.5 h-3.5 text-blue-600" /> Filter Tag:
              </span>
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition ${
                  selectedTag === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                All Tags
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition ${
                    selectedTag === tag ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white border border-slate-200 rounded-3xl shadow-sm">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          <span className="text-xs text-slate-500 font-semibold ml-2">Loading private inventory...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-sm">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-800">No Inventory Items Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {groups.length === 0 
              ? 'Start by creating your first inventory group (e.g. Dresses, Utensils, Books).' 
              : 'No items match your selected filters. Click "Add Item" to add your belongings.'}
          </p>
          {groups.length > 0 && (
            <button
              onClick={() => handleOpenItemModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition"
            >
              Add Item
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => {
            const groupName = groups.find(g => g._id === item.groupId)?.name || 'General';

            return (
              <div key={item._id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
                <div>
                  {/* Top Image Banner & Gallery */}
                  {item.images && item.images.length > 0 ? (
                    <div className="bg-slate-100 border-b border-slate-100">
                      <div 
                        onClick={() => {
                          setLightboxItems(item.images.map(img => ({ url: img.viewUrl, thumbnailUrl: img.thumbnailUrl })));
                          setLightboxIndex(0);
                          setShowLightbox(true);
                        }}
                        className="relative h-48 cursor-pointer overflow-hidden group/img"
                      >
                        <img 
                          src={item.images[0].viewUrl} 
                          alt={item.name} 
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                        />
                        {item.images.length > 1 && (
                          <span className="absolute bottom-2 right-2 px-2.5 py-1 bg-slate-900/80 text-white rounded-full text-[10px] font-bold shadow-md">
                            📷 {item.images.length} photos
                          </span>
                        )}
                      </div>

                      {/* Multi-Image Thumbnail Gallery Strip */}
                      {item.images.length > 1 && (
                        <div className="flex gap-1.5 p-2 overflow-x-auto bg-slate-50 border-t border-slate-100">
                          {item.images.map((img, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setLightboxItems(item.images.map(i => ({ url: i.viewUrl, thumbnailUrl: i.thumbnailUrl })));
                                setLightboxIndex(idx);
                                setShowLightbox(true);
                              }}
                              className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 shrink-0 transition"
                            >
                              <img src={img.thumbnailUrl || img.viewUrl} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-28 bg-slate-50 border-b border-slate-100 flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 font-extrabold text-[10px] rounded-md border border-blue-100 uppercase tracking-wider">
                        {groupName}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        Qty: {item.quantity || 1}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-extrabold text-slate-900 tracking-tight">{item.name}</h4>
                      {item.description && (
                        <p className="text-xs text-slate-600 line-clamp-3 mt-1 leading-relaxed whitespace-pre-wrap">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.tags.map(tag => (
                          <span key={tag} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    Added: {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenItemModal(item)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
                      title="Edit Item"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item._id, item.name)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                      title="Delete Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT GROUP MODAL ── */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 relative">
            <button 
              onClick={() => setShowGroupModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-slate-900">
                {groupEditing ? 'Edit Inventory Group' : 'New Inventory Group'}
              </h3>
              <p className="text-xs text-slate-500">
                Categorize your personal belongings (e.g. Dresses, Utensils, Books, Electronics).
              </p>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dresses / Utensils / Books"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Notes about this collection..."
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  Save Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT ITEM MODAL ── */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 relative my-8">
            <button 
              onClick={() => setShowItemModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-slate-900">
                {itemEditing ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </h3>
              <p className="text-xs text-slate-500">
                Upload item images directly to Google Drive <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono">StorageBuckets/ShudkaraBucket/Inventory</code> subfolder.
              </p>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-800 block mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Navy Blue Formal Blazer / Non-Stick Frying Pan"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Group Category *</label>
                <select
                  value={itemGroupId}
                  onChange={(e) => setItemGroupId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  {groups.map(g => (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Description & Specs</label>
                <textarea
                  placeholder="Details, size, purchase date, or condition notes..."
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. winter, formal, kitchen, favorite"
                  value={itemTagsInput}
                  onChange={(e) => setItemTagsInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>

              {/* Google Drive Image Attachments (Local Staging) */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    Item Media & Attachments
                  </span>
                  {savingItem && (
                    <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Uploading to Drive & Saving...
                    </span>
                  )}
                </label>

                {/* Hidden File Inputs */}
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  multiple
                  disabled={savingItem}
                  onChange={handleImageFileSelect} 
                  className="hidden" 
                />
                <input 
                  ref={cameraInputRef}
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  disabled={savingItem}
                  onChange={handleImageFileSelect} 
                  className="hidden" 
                />

                {/* Attachment Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={savingItem}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>Browse Files</span>
                  </button>

                  <button
                    type="button"
                    disabled={savingItem}
                    onClick={() => setShowCameraModal(true)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span>Take Photo / Camera</span>
                  </button>
                </div>

                {/* Existing Drive Images */}
                {itemImages.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Already in Google Drive:</span>
                    <div className="grid grid-cols-4 gap-2">
                      {itemImages.map((img, idx) => (
                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 h-20 bg-slate-50 shadow-sm">
                          <img src={img.viewUrl} alt="Item" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition shadow-sm"
                            title="Remove & Trash from Google Drive on Save"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Staged Local Draft Images */}
                {stagedFiles.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                      <span>Ready to Upload ({stagedFiles.length}):</span>
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {stagedFiles.map((staged) => (
                        <div key={staged.id} className="relative group rounded-xl overflow-hidden border-2 border-blue-400 h-20 bg-slate-900 shadow-sm">
                          <img src={staged.base64Data} alt="Staged" className="w-full h-full object-cover" />
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-blue-600 text-white rounded text-[8px] font-bold uppercase">
                            Staged
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveStagedFile(staged.id)}
                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-lg transition opacity-90 hover:opacity-100 shadow-sm"
                            title="Remove from staging"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {savingItem ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading to Drive & Saving...</>
                  ) : (
                    <><Check className="w-4 h-4" /> Save Item</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── LIVE CAMERA MODAL ── */}
      {showCameraModal && (
        <LiveCameraModal
          onClose={() => setShowCameraModal(false)}
          onCapture={(base64, fileName) => {
            stageBase64Image(base64, fileName, 'image/jpeg');
          }}
        />
      )}

      {/* ── MEDIA LIGHTBOX MODAL ── */}
      {showLightbox && (
        <MediaLightboxModal
          items={lightboxItems}
          initialIndex={lightboxIndex}
          onClose={() => setShowLightbox(false)}
        />
      )}

    </div>
  );
};
