// E2-002: Content Script — извлечение auth-данных из cookie/storage
// Extracts Telegram Web session data from localStorage, cookies, sessionStorage, IndexedDB.
// Research (E2-001): auth lives in localStorage (dc*_auth_key, user_auth, tt-account-* slots).
// Cookies and sessionStorage are NOT used by Telegram for auth but we scan them defensively.

import type { AuthData, AuthSource } from '../lib/types';

/** Detect Telegram Web version from hostname (webk / webz subdomains) */
function detectVersion(): 'k' | 'a' | 'unknown' {
  const host = window.location.hostname;
  if (host.startsWith('webk')) return 'k';
  if (host.startsWith('webz')) return 'a';
  // Fallback: check URL path (legacy/direct access)
  const path = window.location.pathname;
  if (path.startsWith('/k')) return 'k';
  if (path.startsWith('/a')) return 'a';
  return 'unknown';
}

/** Parse document.cookie into a Record */
function parseCookies(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of document.cookie.split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const key = pair.slice(0, eq).trim();
    const val = pair.slice(eq + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

/**
 * Extract auth-related keys from localStorage.
 * Covers both Web A multi-account (tt-account-1..3) and Web K legacy keys.
 */
function extractLocalStorage(): AuthSource | null {
  const authKeys: Record<string, string> = {};

  const patterns = [
    /^user_auth$/,
    /^dc\d*_auth_key$/,
    /^dc$/,
    /^dc\d+_hash$/,
    /^dc\d+_server_salt$/,
    /^tgme_sync/,
    /^auth_key/,
    /^user$/,
    /^state_id$/,
    /^session/,
    /^k_build$/,
    /^tt-global-state$/,
    /^tt-account-\d+$/, // multi-account slots (Web A)
    /^tt-screen-locked$/, // screen lock flag
  ];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (patterns.some((p) => p.test(key))) {
      const val = localStorage.getItem(key);
      if (val !== null) authKeys[key] = val;
    }
  }

  if (Object.keys(authKeys).length === 0) return null;

  return { type: 'localStorage', keys: authKeys };
}

/** Extract auth-related keys from sessionStorage (not used by TG, defensive scan) */
function extractSessionStorage(): AuthSource | null {
  const authKeys: Record<string, string> = {};

  const patterns = [/^user_auth$/, /^dc/, /^auth/, /^session/];

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key) continue;
    if (patterns.some((p) => p.test(key))) {
      const val = sessionStorage.getItem(key);
      if (val !== null) authKeys[key] = val;
    }
  }

  if (Object.keys(authKeys).length === 0) return null;

  return { type: 'sessionStorage', keys: authKeys };
}

/** Extract cookies relevant to Telegram auth (not used by TG, defensive scan) */
function extractCookies(): AuthSource | null {
  const cookies = parseCookies();

  const authCookies: Record<string, string> = {};
  const patterns = [/^stel_/, /^tgme_/, /^__telegram/, /^user/, /^session/];

  for (const [key, val] of Object.entries(cookies)) {
    if (patterns.some((p) => p.test(key))) {
      authCookies[key] = val;
    }
  }

  if (Object.keys(authCookies).length === 0) return null;

  return { type: 'cookie', keys: authCookies };
}

/**
 * Read auth data from IndexedDB (Web K: "tweb", Web A: "tt-data").
 * IndexedDB stores cache only (messages, media) — not auth keys themselves.
 * We still scan for defensive completeness.
 */
async function extractIndexedDB(): Promise<AuthSource | null> {
  const dbNames = ['tweb', 'tt-data', 'telegram-web'];
  const authKeys: Record<string, string> = {};

  for (const dbName of dbNames) {
    try {
      const data = await readIDBAuthKeys(dbName);
      for (const [k, v] of Object.entries(data)) {
        authKeys[`${dbName}:${k}`] = v;
      }
    } catch {
      // DB doesn't exist or can't be opened — skip
    }
  }

  if (Object.keys(authKeys).length === 0) return null;

  return { type: 'indexedDB', keys: authKeys };
}

/** Open an IndexedDB and read auth-relevant key-value pairs */
function readIDBAuthKeys(dbName: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const result: Record<string, string> = {};
      const storeNames = Array.from(db.objectStoreNames);

      const authStores = storeNames.filter((name) => /session|auth|user|key|state/i.test(name));

      if (authStores.length === 0) {
        db.close();
        resolve(result);
        return;
      }

      let pending = authStores.length;

      for (const storeName of authStores) {
        try {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const getAll = store.getAll();
          const getAllKeys = store.getAllKeys();

          tx.oncomplete = () => {
            const keys = getAllKeys.result;
            const values = getAll.result;
            for (let i = 0; i < keys.length; i++) {
              const k = String(keys[i]);
              const v = values[i];
              if (typeof v === 'string' || typeof v === 'number') {
                result[`${storeName}/${k}`] = String(v);
              } else if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) {
                try {
                  const json = JSON.stringify(v);
                  if (json.length < 4096) {
                    result[`${storeName}/${k}`] = json;
                  }
                } catch {
                  // skip non-serializable
                }
              }
            }
            pending--;
            if (pending === 0) {
              db.close();
              resolve(result);
            }
          };

          tx.onerror = () => {
            pending--;
            if (pending === 0) {
              db.close();
              resolve(result);
            }
          };
        } catch {
          pending--;
          if (pending === 0) {
            db.close();
            resolve(result);
          }
        }
      }
    };

    request.onupgradeneeded = () => {
      // DB didn't exist — abort, don't create
      request.transaction?.abort();
      reject(new Error(`DB ${dbName} does not exist`));
    };
  });
}

/**
 * Detect screen lock from localStorage flag.
 * When screen is locked, auth keys exist but session is not deserialized.
 */
function isScreenLocked(sources: AuthSource[]): boolean {
  for (const src of sources) {
    if (src.type === 'localStorage' && src.keys['tt-screen-locked'] === 'true') return true;
  }
  return false;
}

/**
 * Determine whether the extracted data indicates an active session.
 * Checks localStorage (primary), then falls back to DOM signals.
 */
function isAuthenticated(sources: AuthSource[]): boolean {
  for (const src of sources) {
    // user_auth in localStorage — strongest signal (Web K legacy)
    if (src.keys['user_auth']) return true;

    // tt-global-state with currentUserId — Web A
    if (src.keys['tt-global-state']) {
      try {
        const state = JSON.parse(src.keys['tt-global-state']);
        if (state.currentUserId) return true;
      } catch {
        // malformed
      }
    }

    // Multi-account slots (Web A)
    for (const key of Object.keys(src.keys)) {
      if (/^tt-account-\d+$/.test(key)) {
        try {
          const slot = JSON.parse(src.keys[key]);
          if (slot.userId || slot.dcId) return true;
        } catch {
          // not JSON — skip
        }
      }
    }

    // Any dc*_auth_key means an active session
    for (const key of Object.keys(src.keys)) {
      if (/dc\d+_auth_key/.test(key)) return true;
    }
  }

  // DOM fallback: chat UI present = logged in
  return isAuthenticatedByDOM();
}

/** DOM-based auth detection (recommended by research E2-001) */
function isAuthenticatedByDOM(): boolean {
  // Chat list or messages container = user is logged in
  if (document.querySelector('.chat-list')) return true;
  if (document.querySelector('.messages-container')) return true;
  // Web A uses different selectors
  if (document.querySelector('#MiddleColumn')) return true;
  if (document.querySelector('#LeftColumn .ChatList')) return true;
  // Login screen hash
  if (window.location.hash.includes('/login')) return false;
  return false;
}

/** Extract user ID from available auth sources */
function extractUserId(sources: AuthSource[]): string | undefined {
  for (const src of sources) {
    if (src.keys['user_auth']) {
      try {
        const parsed = JSON.parse(src.keys['user_auth']);
        if (parsed.id) return String(parsed.id);
      } catch {
        // not JSON
      }
    }

    if (src.keys['tt-global-state']) {
      try {
        const state = JSON.parse(src.keys['tt-global-state']);
        if (state.currentUserId) return String(state.currentUserId);
      } catch {
        // skip
      }
    }

    // Multi-account: take userId from first populated slot
    for (const key of Object.keys(src.keys)) {
      if (/^tt-account-\d+$/.test(key)) {
        try {
          const slot = JSON.parse(src.keys[key]);
          if (slot.userId) return String(slot.userId);
        } catch {
          // skip
        }
      }
    }
  }
  return undefined;
}

/** Extract active datacenter ID */
function extractDcId(sources: AuthSource[]): number | undefined {
  for (const src of sources) {
    if (src.keys['dc']) {
      const n = Number(src.keys['dc']);
      if (n >= 1 && n <= 5) return n;
    }

    if (src.keys['user_auth']) {
      try {
        const parsed = JSON.parse(src.keys['user_auth']);
        if (parsed.dcID) return Number(parsed.dcID);
      } catch {
        // skip
      }
    }

    // From multi-account slots
    for (const key of Object.keys(src.keys)) {
      if (/^tt-account-\d+$/.test(key)) {
        try {
          const slot = JSON.parse(src.keys[key]);
          if (slot.dcId && slot.dcId >= 1 && slot.dcId <= 5) return Number(slot.dcId);
        } catch {
          // skip
        }
      }
    }
  }
  return undefined;
}

/** Count active multi-account slots */
function countAccounts(sources: AuthSource[]): number {
  let count = 0;
  for (const src of sources) {
    for (const key of Object.keys(src.keys)) {
      if (/^tt-account-\d+$/.test(key)) {
        try {
          const slot = JSON.parse(src.keys[key]);
          if (slot.userId || slot.dcId) count++;
        } catch {
          // empty/malformed slot
        }
      }
    }
  }
  return count;
}

/**
 * Main entry: extract all auth data from available browser storage.
 * Returns aggregated AuthData ready to send to the background SW.
 */
export async function extractAuth(): Promise<AuthData> {
  const version = detectVersion();
  const sources: AuthSource[] = [];

  // Synchronous extractions
  const ls = extractLocalStorage();
  if (ls) sources.push(ls);

  const ss = extractSessionStorage();
  if (ss) sources.push(ss);

  const cookies = extractCookies();
  if (cookies) sources.push(cookies);

  // Async: IndexedDB
  const idb = await extractIndexedDB();
  if (idb) sources.push(idb);

  const authenticated = isAuthenticated(sources);
  const screenLocked = isScreenLocked(sources);
  const userId = extractUserId(sources);
  const dcId = extractDcId(sources);
  const accounts = countAccounts(sources);

  const result: AuthData = {
    authenticated,
    version,
    userId,
    dcId,
    sources,
    extractedAt: Date.now(),
    screenLocked,
    accounts,
  };

  console.log('[TG-AI] Auth extraction result:', {
    authenticated,
    version,
    userId,
    dcId,
    sourceCount: sources.length,
    screenLocked,
    accounts,
  });

  return result;
}
