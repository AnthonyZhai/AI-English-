const DB_NAME = 'karaoke_db';
const DB_VERSION = 1;
const STORE_NAME = 'karaoke_sessions';

export interface KaraokeSessionData {
  id: string;
  videoBuffer: ArrayBuffer;
  videoMimeType: string;
  wordTimings: { text: string; start: number; end: number }[];
  analysis: any;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveKaraokeData(data: {
  videoBuffer: ArrayBuffer;
  videoMimeType: string;
  wordTimings: { text: string; start: number; end: number }[];
  analysis: any;
}): Promise<string> {
  const id = `session_${Date.now()}`;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ ...data, id, createdAt: Date.now() });
    tx.oncomplete = () => { db.close(); resolve(id); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadKaraokeData(id: string): Promise<KaraokeSessionData | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getLatestKaraokeData(): Promise<KaraokeSessionData | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const all = req.result as KaraokeSessionData[];
      if (all.length === 0) return resolve(null);
      all.sort((a, b) => b.createdAt - a.createdAt);
      resolve(all[0]);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function clearKaraokeData(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
