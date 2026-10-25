import React, { useState, useEffect } from 'react';
import {
  WifiOff,
  CloudOff,
  RefreshCw,
  Check,
  X,
  Trash2,
  AlertCircle
} from 'lucide-react';
import {
  getOfflineQueue,
  syncOfflineQueue,
  removeOfflineAction,
  clearOfflineQueue,
  isDeviceOnline,
  type OfflineAction
} from '../utils/offlineSync';

export const OfflineSyncIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(isDeviceOnline);
  const [queue, setQueue] = useState<OfflineAction[]>(getOfflineQueue);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setToastMessage('Reconnected to internet. Syncing changes...');
      setTimeout(() => setToastMessage(null), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setToastMessage('Device offline. Changes will save locally and sync when reconnected.');
      setTimeout(() => setToastMessage(null), 4000);
    };

    const handleOutboxUpdate = (e: any) => {
      setQueue(e.detail?.queue || getOfflineQueue());
    };

    const handleSyncStart = () => {
      setIsSyncing(true);
    };

    const handleSyncComplete = (e: any) => {
      setIsSyncing(false);
      setQueue(getOfflineQueue());
      const synced = e.detail?.synced || 0;
      if (synced > 0) {
        setToastMessage(`Synced ${synced} offline item${synced > 1 ? 's' : ''} to server.`);
        setTimeout(() => setToastMessage(null), 3500);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('shudkara:outbox-updated', handleOutboxUpdate);
    window.addEventListener('shudkara:sync-started', handleSyncStart);
    window.addEventListener('shudkara:sync-completed', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('shudkara:outbox-updated', handleOutboxUpdate);
      window.removeEventListener('shudkara:sync-started', handleSyncStart);
      window.removeEventListener('shudkara:sync-completed', handleSyncComplete);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) {
      alert('Cannot sync while device is offline. Check your internet connection.');
      return;
    }
    setIsSyncing(true);
    try {
      await syncOfflineQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  // Only render if offline, syncing, or pending changes exist, or toast is active
  if (isOnline && queue.length === 0 && !isSyncing && !toastMessage) {
    return null;
  }

  return (
    <>
      {/* Floating Status Bar / Pill in Bottom Right */}
      <div className="fixed bottom-4 right-4 z-40 max-w-sm w-auto animate-fade-in">
        {toastMessage && (
          <div className="mb-2 p-3 bg-slate-900 text-white text-xs font-semibold rounded-2xl shadow-xl flex items-center justify-between gap-3 border border-slate-800">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-2 px-3 shadow-lg">
          {!isOnline ? (
            <div
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-700"
              title="Click to view offline queue details"
            >
              <span className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-600">
                <WifiOff className="w-3.5 h-3.5" />
              </span>
              <div className="leading-tight">
                <span className="block">Offline Mode</span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {queue.length > 0 ? `${queue.length} change${queue.length > 1 ? 's' : ''} queued` : 'Ready to save locally'}
                </span>
              </div>
            </div>
          ) : isSyncing ? (
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
              <span className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              </span>
              <div className="leading-tight">
                <span className="block">Syncing to Server</span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {queue.length} item{queue.length > 1 ? 's' : ''} remaining
                </span>
              </div>
            </div>
          ) : queue.length > 0 ? (
            <div
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700"
              title="Click to view offline queue details"
            >
              <span className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-600">
                <CloudOff className="w-3.5 h-3.5" />
              </span>
              <div className="leading-tight">
                <span className="block">{queue.length} Pending Sync</span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Click to inspect or sync
                </span>
              </div>
            </div>
          ) : null}

          {/* Quick Action Button */}
          {queue.length > 0 && isOnline && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="ml-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-xl shadow-2xs transition flex items-center gap-1 shrink-0"
              title="Push changes to server now"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* ── MODAL: OFFLINE OUTBOX INSPECTOR ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
                  <CloudOff className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Offline Sync Queue
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {queue.length} pending change{queue.length !== 1 ? 's' : ''} saved locally
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {queue.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                <Check className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-700">All Changes Synced</p>
                <p>Your local state is completely synchronized with the server.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {queue.map(item => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                          {item.method}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                          {item.subapp}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 truncate">
                        {item.description}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(item.timestamp).toLocaleTimeString()} • {item.url}
                        {item.retries > 0 && ` • Retries: ${item.retries}`}
                      </p>
                    </div>

                    <button
                      onClick={() => removeOfflineAction(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                      title="Discard this queued action"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                When you are offline, all changes (notes, check-ins, tasks) are saved locally so you never lose work.
                They automatically sync the instant an internet connection is detected.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {queue.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Clear all pending offline changes? They will not be sent to the server.')) {
                      clearOfflineQueue();
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition"
                >
                  Discard All
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Close
                </button>
                {queue.length > 0 && (
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing || !isOnline}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
