const DB_NAME = "sentinel";
const DB_VERSION = 2; // v2: added `preferences` object store
const ACTIVITY_STORE = "activity";
const PREFERENCES_STORE = "preferences";

// Cached promise — resolved after the first successful open.
// Subsequent calls return the same promise, so only one IDBOpenDBRequest
// is ever created per page lifecycle.
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // v1: activity store (unchanged)
      if (!db.objectStoreNames.contains(ACTIVITY_STORE)) {
        db.createObjectStore(ACTIVITY_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      // v2: preferences store — keyed by preference key string, no
      // autoIncrement. put() is used (not add()) so writes are upserts.
      if (!db.objectStoreNames.contains(PREFERENCES_STORE)) {
        db.createObjectStore(PREFERENCES_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      _dbPromise = null; // Allow retry on failure
      reject(request.error);
    };
  });
  return _dbPromise;
}

// ─── Activity ────────────────────────────────────────────────────────────────

export async function addActivity(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIVITY_STORE, "readwrite");
    const store = tx.objectStore(ACTIVITY_STORE);
    const request = store.add(record);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllActivity() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIVITY_STORE, "readonly");
    const store = tx.objectStore(ACTIVITY_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteActivity(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIVITY_STORE, "readwrite");
    const store = tx.objectStore(ACTIVITY_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearActivity() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIVITY_STORE, "readwrite");
    const store = tx.objectStore(ACTIVITY_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ─── Preferences ─────────────────────────────────────────────────────────────

// Each record: { key: string, value: <any JSON-safe value> }
// put() is an upsert — safe to call whether or not the key exists yet.

export async function getPreference(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PREFERENCES_STORE, "readonly");
    const store = tx.objectStore(PREFERENCES_STORE);
    const request = store.get(key);

    // A missing key is not an error — resolve with undefined so callers
    // can fall back to their default value cleanly.
    request.onsuccess = () =>
      resolve(request.result ? request.result.value : undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function setPreference(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PREFERENCES_STORE, "readwrite");
    const store = tx.objectStore(PREFERENCES_STORE);
    const request = store.put({ key, value });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deletePreference(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PREFERENCES_STORE, "readwrite");
    const store = tx.objectStore(PREFERENCES_STORE);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearPreferences() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PREFERENCES_STORE, "readwrite");
    const store = tx.objectStore(PREFERENCES_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
