import { useState, useCallback } from "react";

const DB_NAME = "music-editor";
const STORE   = "audio";
const LS_KEY  = "music-editor-drafts";

// ── IndexedDB (audio blob) ────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE);
    req.onsuccess  = (e) => resolve(e.target.result);
    req.onerror    = (e) => reject(e.target.error);
  });
}

async function idbPut(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = (e) => resolve(e.target.result ?? null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ── localStorage (metadata) ───────────────────────────────
function readList() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); }
  catch { return []; }
}

function writeList(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

// ── Hook ─────────────────────────────────────────────────
export function useDrafts() {
  const [drafts, setDrafts] = useState(readList);

  // Save or overwrite (same name → overwrite)
  const save = useCallback(async (name, { fileName, bpm, offset, duration, segments, playlist, audioBlob }) => {
    const list   = readList();
    const exists = list.find((d) => d.name === name);
    const id     = exists?.id ?? Date.now().toString();

    const meta = {
      id, name,
      fileName: fileName ?? "",
      bpm, offset: offset ?? 0, duration: duration ?? 0,
      segmentCount: segments.length,
      segments,
      playlist,
      createdAt: exists?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };

    if (audioBlob) await idbPut(id, audioBlob);

    const updated = exists
      ? list.map((d) => (d.id === id ? meta : d))
      : [...list, meta];

    writeList(updated);
    setDrafts(updated);
    return id;
  }, []);

  const load = useCallback(async (id) => {
    const meta = readList().find((d) => d.id === id);
    if (!meta) return null;
    const blob = await idbGet(id);
    return { ...meta, audioBlob: blob };
  }, []);

  const remove = useCallback(async (id) => {
    await idbDelete(id);
    const updated = readList().filter((d) => d.id !== id);
    writeList(updated);
    setDrafts(updated);
  }, []);

  return { drafts, save, load, remove };
}
