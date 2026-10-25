// Shudkara PWA Offline Synchronization Engine
// Manages local outbox queue, background sync, and online/offline network detection.

export interface OfflineAction {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  description: string;
  subapp: string;
  timestamp: number;
  retries: number;
}

const OUTBOX_STORAGE_KEY = 'shudkara_offline_outbox';

let isSyncing = false;
let listenersInitialized = false;

// Check if currently online
export function isDeviceOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

// Read all queued actions from localStorage
export function getOfflineQueue(): OfflineAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read offline queue:', err);
    return [];
  }
}

// Save queue to localStorage and dispatch update event
function saveOfflineQueue(queue: OfflineAction[]): void {
  try {
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('shudkara:outbox-updated', { detail: { queue } }));
  } catch (err) {
    console.error('Failed to save offline queue:', err);
  }
}

// Enqueue a new mutation action
export function enqueueOfflineAction(action: {
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  description: string;
  subapp?: string;
}): OfflineAction {
  const queue = getOfflineQueue();
  const newAction: OfflineAction = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    url: action.url,
    method: action.method,
    body: action.body,
    headers: action.headers || {},
    description: action.description,
    subapp: action.subapp || 'general',
    timestamp: Date.now(),
    retries: 0
  };

  const updatedQueue = [...queue, newAction];
  saveOfflineQueue(updatedQueue);

  // If online, attempt immediate sync in background
  if (isDeviceOnline()) {
    setTimeout(() => {
      syncOfflineQueue().catch(err => console.warn('Background sync attempt failed:', err));
    }, 100);
  }

  return newAction;
}

// Remove an action from the queue by ID
export function removeOfflineAction(id: string): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter(item => item.id !== id);
  saveOfflineQueue(filtered);
}

// Clear all queued actions
export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
}

// Execute sync for all pending actions
export async function syncOfflineQueue(): Promise<{ synced: number; failed: number; remaining: number }> {
  if (isSyncing) {
    return { synced: 0, failed: 0, remaining: getOfflineQueue().length };
  }

  if (!isDeviceOnline()) {
    return { synced: 0, failed: 0, remaining: getOfflineQueue().length };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { synced: 0, failed: 0, remaining: 0 };
  }

  isSyncing = true;
  window.dispatchEvent(new CustomEvent('shudkara:sync-started', { detail: { count: queue.length } }));

  let synced = 0;
  let failed = 0;
  const currentQueue = [...queue];

  try {
    for (const item of currentQueue) {
      if (!isDeviceOnline()) {
        // Lost connection midway, abort and resume when connection is back
        break;
      }

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...item.headers
        };

        // Attach saved auth token if not already specified
        const token = localStorage.getItem('shudkara_auth_token');
        if (token && !headers['X-Session-Token']) {
          headers['X-Session-Token'] = token;
        }

        const fetchOptions: RequestInit = {
          method: item.method,
          headers
        };

        if (item.body !== undefined) {
          fetchOptions.body = JSON.stringify(item.body);
        }

        const response = await fetch(item.url, fetchOptions);

        if (response.ok || (response.status >= 200 && response.status < 300)) {
          // Successfully processed on server
          removeOfflineAction(item.id);
          synced++;
          window.dispatchEvent(new CustomEvent('shudkara:action-synced', { detail: { action: item } }));
        } else if (response.status >= 400 && response.status < 500) {
          // Client error (e.g. 404, 400), don't deadlock the queue indefinitely
          console.warn(`Offline action rejected by server with status ${response.status}:`, item.description);
          removeOfflineAction(item.id);
          failed++;
        } else {
          // Server error 5xx, increment retry and keep in queue
          item.retries += 1;
          const q = getOfflineQueue();
          const updated = q.map(i => (i.id === item.id ? { ...i, retries: item.retries } : i));
          saveOfflineQueue(updated);
          failed++;
        }
      } catch (err) {
        // Network fetch threw (offline or dropped connection)
        console.warn('Network error syncing action:', err);
        break;
      }
    }
  } finally {
    isSyncing = false;
    const remaining = getOfflineQueue().length;
    window.dispatchEvent(new CustomEvent('shudkara:sync-completed', { detail: { synced, failed, remaining } }));
  }

  return { synced, failed, remaining: getOfflineQueue().length };
}

// Smart wrapper around fetch for mutations that must work offline
export async function offlineFetch(
  url: string,
  options: RequestInit = {},
  description = 'Change saved offline',
  subapp = 'general'
): Promise<{ ok: boolean; status: number; offline: boolean; json: () => Promise<any> }> {
  const method = (options.method || 'GET').toUpperCase() as 'POST' | 'PUT' | 'DELETE' | 'GET';

  // If online, try network first
  if (isDeviceOnline()) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        return {
          ok: true,
          status: res.status,
          offline: false,
          json: async () => res.json()
        };
      }
    } catch (networkErr) {
      console.warn('Fetch threw network error, switching to offline queue fallback:', networkErr);
    }
  }

  // If offline or network threw and method is a mutation (POST, PUT, DELETE):
  if (method !== 'GET') {
    let body: any;
    if (typeof options.body === 'string') {
      try {
        body = JSON.parse(options.body);
      } catch {
        body = options.body;
      }
    } else {
      body = options.body;
    }

    const headers: Record<string, string> = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([k, v]) => { headers[k] = v; });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    enqueueOfflineAction({
      url,
      method,
      body,
      headers,
      description,
      subapp
    });

    return {
      ok: true,
      status: 200,
      offline: true,
      json: async () => ({ success: true, offline: true, message: 'Saved locally, queued for sync.' })
    };
  }

  // If GET request failed offline, return synthetic response
  return {
    ok: false,
    status: 503,
    offline: true,
    json: async () => ({ error: 'Device is offline and request was not cached.' })
  };
}

// Initialize listeners for automatic sync
export function initOfflineSyncListeners(): void {
  if (typeof window === 'undefined' || listenersInitialized) return;
  listenersInitialized = true;

  // Sync when coming back online
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Device is back online. Draining outbox...');
    syncOfflineQueue().catch(err => console.error('Error during auto-sync:', err));
  });

  // Sync when app is reopened or becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isDeviceOnline()) {
      syncOfflineQueue().catch(() => {});
    }
  });

  // Periodic fallback check every 30 seconds
  setInterval(() => {
    if (isDeviceOnline() && getOfflineQueue().length > 0) {
      syncOfflineQueue().catch(() => {});
    }
  }, 30000);
}
