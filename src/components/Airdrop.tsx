import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { 
  Share2, ShieldCheck, FileUp, Download, RefreshCw, X, Check, 
  AlertCircle, Copy, Wifi, WifiOff
} from 'lucide-react';

interface Transfer {
  id: string;
  name: string;
  size: number;
  progress: number; // percentage
  status: 'pending' | 'transferring' | 'completed' | 'failed';
  type: 'incoming' | 'outgoing';
  blobUrl?: string;
  mimeType?: string;
}

const CHUNK_SIZE = 16384; // 16KB safe chunk size for WebRTC channels

export const Airdrop: React.FC = () => {
  const [peerId, setPeerId] = useState<string>('');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [remotePeerIdInput, setRemotePeerIdInput] = useState<string>('');
  const [activeTransfers, setActiveTransfers] = useState<Transfer[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  // Buffer state for incoming files
  const incomingFileBuffer = useRef<{
    name: string;
    size: number;
    mimeType: string;
    totalChunks: number;
    chunks: ArrayBuffer[];
    transferId: string;
  } | null>(null);

  // File sender state
  const outgoingFileState = useRef<{
    file: File;
    arrayBuffer: ArrayBuffer;
    totalChunks: number;
    currentChunk: number;
    transferId: string;
  } | null>(null);

  // Clean up on unmount
  useEffect(() => {
    // Initialize Peer on mount
    // Generate a simple readable 6-character user ID
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newPeer = new Peer(`SHUD-${randomId}`, {
      debug: 1, // Only print warnings/errors
    });

    peerRef.current = newPeer;
    setPeer(newPeer);

    newPeer.on('open', (id) => {
      setPeerId(id);
      setConnectionStatus('disconnected');
    });

    newPeer.on('connection', (conn) => {
      // Handle incoming connection
      if (connRef.current) {
        // Reject if already connected to someone
        conn.on('open', () => {
          conn.send({ type: 'error', message: 'Peer is already in an active session' });
          setTimeout(() => conn.close(), 500);
        });
        return;
      }
      setupConnection(conn);
    });

    newPeer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (err.type === 'peer-unavailable') {
        setErrorMsg('Peer not found. Make sure the ID is correct and they are online.');
        setConnectionStatus('disconnected');
      } else {
        setErrorMsg(`Network issue: ${err.message}`);
      }
    });

    return () => {
      if (connRef.current) connRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  // Setup connection event handlers
  function setupConnection(conn: DataConnection) {
    connRef.current = conn;
    setConnection(conn);
    setConnectionStatus('connecting');

    conn.on('open', () => {
      setConnectionStatus('connected');
      setRemotePeerIdInput('');
      setErrorMsg(null);
      setInfoMsg(`Connected to peer: ${conn.peer.replace('SHUD-', '')}`);
    });

    conn.on('close', () => {
      handleDisconnectClean();
    });

    conn.on('error', (err) => {
      setErrorMsg(`Connection error: ${err.message}`);
      handleDisconnectClean();
    });

    // Main protocol message handler
    conn.on('data', (data: any) => {
      handleProtocolMessage(data);
    });
  }

  const handleDisconnectClean = () => {
    connRef.current = null;
    setConnection(null);
    setConnectionStatus('disconnected');
    incomingFileBuffer.current = null;
    outgoingFileState.current = null;
    setInfoMsg('Peer disconnected.');
  };

  // Connect to another peer
  const connectToPeer = () => {
    if (!remotePeerIdInput.trim() || !peer) return;
    let targetId = remotePeerIdInput.trim().toUpperCase();
    if (!targetId.startsWith('SHUD-')) {
      targetId = `SHUD-${targetId}`;
    }
    
    setErrorMsg(null);
    setConnectionStatus('connecting');
    const conn = peer.connect(targetId, {
      reliable: true
    });
    setupConnection(conn);
  };

  // Disconnect manually
  const disconnect = () => {
    if (connRef.current) {
      connRef.current.close();
    }
  };

  // WebRTC Chunk Protocol Handler
  const handleProtocolMessage = (message: any) => {
    if (!connRef.current) return;

    switch (message.type) {
      case 'error':
        setErrorMsg(message.message);
        disconnect();
        break;

      case 'start-transfer': {
        // Incoming file start
        const { name, size, mimeType, totalChunks, transferId } = message;
        
        // Initialize incoming buffer
        incomingFileBuffer.current = {
          name,
          size,
          mimeType,
          totalChunks,
          chunks: [],
          transferId
        };

        // Add to active transfers list
        setActiveTransfers(prev => [
          {
            id: transferId,
            name,
            size,
            progress: 0,
            status: 'transferring',
            type: 'incoming'
          },
          ...prev
        ]);

        // Send ACK to request chunk 0
        connRef.current.send({
          type: 'ack',
          transferId,
          nextChunk: 0
        });
        break;
      }

      case 'chunk': {
        const { transferId, chunkIndex, data } = message;
        const buffer = incomingFileBuffer.current;
        
        if (!buffer || buffer.transferId !== transferId) return;

        // Save chunk
        buffer.chunks[chunkIndex] = data;

        // Calculate progress
        const progress = Math.round(((chunkIndex + 1) / buffer.totalChunks) * 100);
        
        setActiveTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, progress } : t
        ));

        // Check if finished
        if (buffer.chunks.length === buffer.totalChunks) {
          // Complete file transfer
          const fileBlob = new Blob(buffer.chunks, { type: buffer.mimeType });
          const blobUrl = URL.createObjectURL(fileBlob);

          setActiveTransfers(prev => prev.map(t => 
            t.id === transferId 
              ? { ...t, progress: 100, status: 'completed', blobUrl, mimeType: buffer.mimeType } 
              : t
          ));

          // Clean buffer
          incomingFileBuffer.current = null;

          // Notify sender we completed
          connRef.current.send({
            type: 'completed-transfer',
            transferId
          });
        } else {
          // Request next chunk
          connRef.current.send({
            type: 'ack',
            transferId,
            nextChunk: chunkIndex + 1
          });
        }
        break;
      }

      case 'ack': {
        const { transferId, nextChunk } = message;
        const outState = outgoingFileState.current;

        if (!outState || outState.transferId !== transferId) return;

        if (nextChunk >= outState.totalChunks) {
          // All chunks sent, waiting for completion confirm
          return;
        }

        // Send next chunk
        const start = nextChunk * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, outState.arrayBuffer.byteLength);
        const chunkData = outState.arrayBuffer.slice(start, end);

        connRef.current.send({
          type: 'chunk',
          transferId,
          chunkIndex: nextChunk,
          data: chunkData
        });

        // Update progress
        const progress = Math.round((nextChunk / outState.totalChunks) * 100);
        setActiveTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, progress } : t
        ));
        break;
      }

      case 'completed-transfer': {
        const { transferId } = message;
        setActiveTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, progress: 100, status: 'completed' } : t
        ));
        outgoingFileState.current = null;
        setInfoMsg('File sent successfully!');
        break;
      }

      case 'cancel-transfer': {
        const { transferId } = message;
        setActiveTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
        if (incomingFileBuffer.current?.transferId === transferId) incomingFileBuffer.current = null;
        if (outgoingFileState.current?.transferId === transferId) outgoingFileState.current = null;
        setErrorMsg('File transfer was cancelled by peer.');
        break;
      }
    }
  };

  // Send File initiator
  const sendFile = (file: File) => {
    if (!connRef.current || connectionStatus !== 'connected') {
      setErrorMsg('No peer connected.');
      return;
    }

    if (outgoingFileState.current) {
      setErrorMsg('Wait until the current file transfer completes.');
      return;
    }

    const transferId = Math.random().toString(36).substring(2, 10);
    const fileReader = new FileReader();

    fileReader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

      outgoingFileState.current = {
        file,
        arrayBuffer,
        totalChunks,
        currentChunk: 0,
        transferId
      };

      // Create outgoing transfer record
      setActiveTransfers(prev => [
        {
          id: transferId,
          name: file.name,
          size: file.size,
          progress: 0,
          status: 'transferring',
          type: 'outgoing'
        },
        ...prev
      ]);

      // Initiate protocol
      connRef.current?.send({
        type: 'start-transfer',
        transferId,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        totalChunks
      });
    };

    fileReader.onerror = () => {
      setErrorMsg('Failed to read file.');
    };

    fileReader.readAsArrayBuffer(file);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      sendFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      sendFile(e.target.files[0]);
    }
  };

  const copyIdToClipboard = () => {
    const cleanId = peerId.replace('SHUD-', '');
    navigator.clipboard.writeText(cleanId);
    setInfoMsg('Peer ID copied to clipboard!');
    setTimeout(() => setInfoMsg(null), 2500);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Alert boxes */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold flex-1">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {infoMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center gap-3 animate-slide-down">
          <Check className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold flex-1">{infoMsg}</p>
          <button onClick={() => setInfoMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-8">
        
        {/* Connection status header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Share2 className="text-indigo-600 w-6 h-6" />
              WebRTC Airdrop
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Drop a file to send directly to anyone connected, database-free.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {connectionStatus === 'connected' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 text-xs font-bold rounded-full">
                <Wifi className="w-3.5 h-3.5" />
                Active Peer Session
              </span>
            ) : connectionStatus === 'connecting' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 text-xs font-bold rounded-full animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Negotiating P2P...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-450 border border-slate-150 dark:border-slate-700/80 text-xs font-bold rounded-full">
                <WifiOff className="w-3.5 h-3.5" />
                Waiting for Peer
              </span>
            )}
          </div>
        </div>

        {/* Identity & Discovery Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-950/40 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
          
          {/* Your info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Your Sharing Code</h4>
            
            {peerId ? (
              <div className="flex items-center gap-2">
                <code className="text-2xl font-mono font-bold tracking-widest text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl block flex-1 text-center shadow-sm">
                  {peerId.replace('SHUD-', '')}
                </code>
                <button
                  onClick={copyIdToClipboard}
                  className="p-3 bg-white hover:bg-slate-105 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 shadow-sm transition-all"
                  title="Copy Code"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-2 text-sm text-slate-400 font-medium animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                Contacting signalling server...
              </div>
            )}
            
            <p className="text-[11px] text-slate-400 leading-normal">
              Share this 6-character code with the other person, or ask for their code to connect.
            </p>
          </div>

          {/* Connect field */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {connectionStatus === 'connected' ? 'Connected Peer' : 'Connect to Peer'}
            </h4>

            {connectionStatus === 'connected' && connection ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 text-indigo-800 dark:text-indigo-300 font-semibold text-sm rounded-xl flex items-center justify-between">
                  <span>Connected with: {connection.peer.replace('SHUD-', '')}</span>
                  <ShieldCheck className="w-4.5 h-4.5 text-indigo-500 shrink-0" />
                </div>
                <button
                  onClick={disconnect}
                  className="px-4 py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100/40 dark:border-rose-900/30 text-sm font-semibold rounded-xl transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Peer's 6-digit Code"
                  value={remotePeerIdInput}
                  onChange={(e) => setRemotePeerIdInput(e.target.value.toUpperCase())}
                  disabled={connectionStatus === 'connecting'}
                  className="flex-1 font-mono tracking-widest text-center px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
                <button
                  onClick={connectToPeer}
                  disabled={connectionStatus === 'connecting' || !remotePeerIdInput.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 font-semibold rounded-xl text-sm shadow-md shadow-indigo-500/10 hover:shadow-indigo-600/20 transition-all"
                >
                  Connect
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-400 leading-normal">
              Enter their code and click connect to form a WebRTC tunnel.
            </p>
          </div>
        </div>

        {/* File drop zone - Only active when connected */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">File Drop Area</h3>
          {connectionStatus === 'connected' ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[0.99]' 
                  : 'border-slate-200 hover:border-slate-350 dark:border-slate-800 dark:hover:border-slate-700 hover:bg-slate-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              <FileUp className="w-10 h-10 text-indigo-500 mx-auto mb-3 animate-bounce" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Drag and drop a file here, or click to browse
              </p>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">
                P2P data channels support file sizes (GBs) directly without uploads.
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center bg-slate-50/20 dark:bg-slate-900/10">
              <WifiOff className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                You must connect with a peer first before sending files
              </p>
              <div className="w-12 h-12 rounded-full border-4 border-indigo-100 dark:border-indigo-950/50 border-t-indigo-500 animate-spin mx-auto mt-4 hidden" />
            </div>
          )}
        </div>

        {/* Transfer list */}
        {activeTransfers.length > 0 && (
          <div className="space-y-3.5 pt-2">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>Transfer Log</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                {activeTransfers.length} items
              </span>
            </h3>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {activeTransfers.map((transfer) => (
                <div 
                  key={transfer.id} 
                  className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                        transfer.type === 'incoming' 
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/45 dark:text-purple-400' 
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/45 dark:text-indigo-400'
                      }`}>
                        {transfer.type}
                      </span>
                      <span className="font-semibold text-sm text-slate-800 dark:text-white truncate block">
                        {transfer.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                      <span>Size: {formatBytes(transfer.size)}</span>
                      <span>•</span>
                      <span>{transfer.progress}%</span>
                    </div>

                    {/* Progress Bar */}
                    {transfer.status === 'transferring' && (
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-150"
                          style={{ width: `${transfer.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    {transfer.status === 'completed' ? (
                      transfer.type === 'incoming' && transfer.blobUrl ? (
                        <a
                          href={transfer.blobUrl}
                          download={transfer.name}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Save File
                        </a>
                      ) : (
                        <span className="text-emerald-500 flex items-center gap-1 text-xs font-semibold">
                          <Check className="w-4 h-4" />
                          Sent
                        </span>
                      )
                    ) : transfer.status === 'failed' ? (
                      <span className="text-rose-500 flex items-center gap-1 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4" />
                        Failed
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {/* loading spinner */}
                        <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
