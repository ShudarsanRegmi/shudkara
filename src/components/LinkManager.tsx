import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, ExternalLink, Plus, Trash2, Edit2, ChevronRight, ChevronDown, Save, X, Link, RefreshCw, Lock, Unlock } from 'lucide-react';

interface LinkNode {
  id: string;
  parentId: string | null;
  name: string;
  type: 'folder' | 'link';
  url?: string;
  isPrivate?: boolean;
}

interface LinkManagerProps {
  authToken: string | null;
}

export const LinkManager: React.FC<LinkManagerProps> = ({ authToken }) => {
  const [nodes, setNodes] = useState<LinkNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  
  // Creation state
  const [addingNodeParentId, setAddingNodeParentId] = useState<string | null>(null);
  const [addingNodeType, setAddingNodeType] = useState<'folder' | 'link' | null>(null);
  const [newFormName, setNewFormName] = useState('');
  const [newFormUrl, setNewFormUrl] = useState('');

  // Editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingUrl, setEditingUrl] = useState('');

  const isLoggedIn = !!authToken;

  const fetchNodes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/links');
      if (res.ok) {
        const data = await res.json();
        setNodes(data);
      }
    } catch (err) {
      console.error('Failed to fetch link tree nodes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const handleToggleFolder = (id: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Add Folder/Link
  const handleAddNode = async (parentId: string | null) => {
    if (!newFormName.trim()) return;
    if (addingNodeType === 'link' && !newFormUrl.trim()) return;

    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken ?? ''
        },
        body: JSON.stringify({
          name: newFormName.trim(),
          type: addingNodeType,
          parentId: parentId,
          url: addingNodeType === 'link' ? newFormUrl.trim() : undefined
        })
      });

      if (res.ok) {
        setNewFormName('');
        setNewFormUrl('');
        setAddingNodeParentId(null);
        setAddingNodeType(null);
        await fetchNodes();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to create node.');
      }
    } catch (err) {
      alert('Error creating node.');
    }
  };

  // Save Edit
  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;

    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken ?? ''
        },
        body: JSON.stringify({
          name: editingName.trim(),
          url: editingUrl.trim() || undefined
        })
      });

      if (res.ok) {
        setEditingNodeId(null);
        await fetchNodes();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to update node.');
      }
    } catch (err) {
      alert('Error updating node.');
    }
  };

  // Toggle node privacy
  const handleTogglePrivate = async (node: LinkNode) => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch(`/api/links/${node.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': authToken ?? ''
        },
        body: JSON.stringify({
          isPrivate: !node.isPrivate
        })
      });
      if (res.ok) {
        await fetchNodes();
      }
    } catch {}
  };

  // Delete Node (recursive)
  const handleDeleteNode = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This will delete all subfolders and links inside it recursively.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'DELETE',
        headers: {
          'X-Session-Token': authToken ?? ''
        }
      });

      if (res.ok) {
        await fetchNodes();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete node.');
      }
    } catch (err) {
      alert('Error deleting node.');
    }
  };

  // Recursive Tree Node Renderer
  const renderTree = (parentId: string | null, depth: number = 0) => {
    const levelNodes = nodes.filter(n => n.parentId === parentId)
      .sort((a, b) => {
        // Folders first, then alphabetically
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return (
      <div className="space-y-1">
        {levelNodes.map(node => {
          const isFolder = node.type === 'folder';
          const isExpanded = expandedFolders[node.id];
          const isEditing = editingNodeId === node.id;
          const isAddingUnderThis = addingNodeParentId === node.id;

          return (
            <div key={node.id} className="select-none">
              
              {/* Row content */}
              <div 
                style={{ paddingLeft: `${depth * 1.5}rem` }}
                className="group flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-100/70 transition duration-150 text-slate-800"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Expanded chevron for folders */}
                  {isFolder ? (
                    <button 
                      onClick={() => handleToggleFolder(node.id)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition shrink-0"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  ) : (
                    <div className="w-5 shrink-0" /> /* Spacer for links */
                  )}

                  {/* Icon */}
                  {isFolder ? (
                    isExpanded ? (
                      <FolderOpen className="w-4.5 h-4.5 text-blue-500 shrink-0" />
                    ) : (
                      <Folder className="w-4.5 h-4.5 text-blue-500 shrink-0" />
                    )
                  ) : (
                    <Link className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}

                  {/* Name / Link Anchor or Editor */}
                  {isEditing ? (
                    <div className="flex gap-2 flex-1 items-center min-w-0">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="px-2 py-0.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-1/3"
                      />
                      {!isFolder && (
                        <input
                          type="text"
                          value={editingUrl}
                          onChange={(e) => setEditingUrl(e.target.value)}
                          className="px-2 py-0.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-1/2"
                        />
                      )}
                      <button 
                        onClick={() => handleSaveEdit(node.id)}
                        className="text-emerald-600 hover:text-emerald-700 p-0.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setEditingNodeId(null)}
                        className="text-red-500 hover:text-red-650 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 truncate">
                      {isFolder ? (
                        <span 
                          onClick={() => handleToggleFolder(node.id)}
                          className="text-sm font-semibold text-slate-800 cursor-pointer hover:underline truncate"
                        >
                          {node.name}
                        </span>
                      ) : (
                        <a
                          href={node.url?.startsWith('http') ? node.url : `https://${node.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-slate-700 hover:text-blue-600 hover:underline flex items-center gap-1 truncate"
                        >
                          {node.name}
                          <ExternalLink className="w-3 h-3 text-slate-400 inline" />
                        </a>
                      )}
                      {node.isPrivate && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 shrink-0">
                          <Lock className="w-2.5 h-2.5" /> Private
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Operations (Logged-in only) */}
                {isLoggedIn && !isEditing && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleTogglePrivate(node)}
                      className={`p-1 hover:bg-slate-200 rounded ${node.isPrivate ? 'text-amber-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                      title={node.isPrivate ? 'Private (Click to make Public)' : 'Public (Click to Lock)'}
                    >
                      {node.isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    {isFolder && (
                      <>
                        <button
                          onClick={() => {
                            setAddingNodeParentId(node.id);
                            setAddingNodeType('folder');
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-700"
                          title="Add subfolder"
                        >
                          <Folder className="w-3.5 h-3.5 inline mr-0.5" />+
                        </button>
                        <button
                          onClick={() => {
                            setAddingNodeParentId(node.id);
                            setAddingNodeType('link');
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-700"
                          title="Add link"
                        >
                          <Link className="w-3.5 h-3.5 inline mr-0.5" />+
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setEditingNodeId(node.id);
                        setEditingName(node.name);
                        setEditingUrl(node.url || '');
                      }}
                      className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                      title="Rename"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteNode(node.id, node.name)}
                      className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-red-650"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Inline creator block if adding node under this folder */}
              {isAddingUnderThis && addingNodeType && (
                <div 
                  style={{ paddingLeft: `${(depth + 1) * 1.5}rem` }}
                  className="flex flex-wrap gap-2 items-center py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl my-1 max-w-md animate-fade-in"
                >
                  <span className="text-[10px] uppercase font-bold text-slate-450">
                    New {addingNodeType}
                  </span>
                  <input
                    type="text"
                    placeholder="Name"
                    value={newFormName}
                    onChange={(e) => setNewFormName(e.target.value)}
                    className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none w-1/3"
                    autoFocus
                  />
                  {addingNodeType === 'link' && (
                    <input
                      type="text"
                      placeholder="URL (e.g. google.com)"
                      value={newFormUrl}
                      onChange={(e) => setNewFormUrl(e.target.value)}
                      className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none w-1/2"
                    />
                  )}
                  <div className="flex gap-1.5 ml-auto">
                    <button 
                      onClick={() => handleAddNode(node.id)}
                      className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold"
                    >
                      Add
                    </button>
                    <button 
                      onClick={() => {
                        setAddingNodeParentId(null);
                        setAddingNodeType(null);
                      }}
                      className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-tree rendering (recursive) */}
              {isFolder && isExpanded && (
                <div className="border-l border-slate-250/70 ml-5 my-0.5">
                  {renderTree(node.id, depth + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header Block */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-750 text-xs font-semibold border border-blue-100">
            <Folder className="w-3.5 h-3.5 text-blue-600" />
            <span>Folder Directories</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
            LinkManager
          </h1>
          <p className="text-sm md:text-base text-slate-600 max-w-xl leading-relaxed">
            Organize bookmarks and hyperlinks in a tree folder hierarchy. Create folders, nest directories, and launch links with a single click.
          </p>
        </div>
        
        {isLoggedIn && addingNodeParentId === null && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAddingNodeParentId(null);
                setAddingNodeType('folder');
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              New Folder
            </button>
            <button
              onClick={() => {
                setAddingNodeParentId(null);
                setAddingNodeType('link');
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              New Link
            </button>
          </div>
        )}
      </div>

      {/* Root-level creation form */}
      {addingNodeParentId === null && addingNodeType && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-lg shadow-sm space-y-4 animate-fade-in text-slate-800">
          <h3 className="text-base font-bold">
            Create Root-Level {addingNodeType === 'folder' ? 'Folder' : 'Link'}
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Name"
              value={newFormName}
              onChange={(e) => setNewFormName(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
            {addingNodeType === 'link' && (
              <input
                type="text"
                placeholder="URL (e.g. github.com)"
                value={newFormUrl}
                onChange={(e) => setNewFormUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setAddingNodeType(null);
                setNewFormName('');
                setNewFormUrl('');
              }}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleAddNode(null)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-xs"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Tree Grid View */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
        {loading ? (
          <div className="text-center py-10">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <span className="text-xs text-slate-500">Loading directory tree...</span>
          </div>
        ) : nodes.length > 0 ? (
          <div className="space-y-4">
            {renderTree(null)}
          </div>
        ) : (
          <div className="text-center py-16 space-y-3">
            <Folder className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-700">Empty directory</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              {isLoggedIn 
                ? 'Create root folders and link bookmarks using the buttons above to build your hierarchy.'
                : 'No bookmarks exist. Log in to start creating folders and link hierarchies.'}
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
