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

// ── Base64 <-> Blob ───────────────────────────────────────
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataURL) {
  const comma  = dataURL.indexOf(",");
  const header = dataURL.slice(0, comma);
  const b64    = dataURL.slice(comma + 1);
  const type   = header.replace(/^data:/, "").replace(/;base64$/, "");
  const raw    = atob(b64);
  const buf    = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return new Blob([buf], { type });
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

  // Export all drafts (metadata + audio blobs) as a JSON string
  const exportAll = useCallback(async () => {
    const list = readList();
    const entries = await Promise.all(
      list.map(async (meta) => {
        const blob = await idbGet(meta.id);
        return { ...meta, _audioDataURL: blob ? await blobToDataURL(blob) : null };
      })
    );
    return JSON.stringify({ version: 1, exportedAt: Date.now(), drafts: entries }, null, 2);
  }, []);

  // Import drafts from a JSON string — upsert by id (same id = overwrite, new id = add)
  const importAll = useCallback(async (jsonText) => {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error("JSONの解析に失敗しました。ファイルが壊れている可能性があります。");
    }
    if (parsed?.version !== 1 || !Array.isArray(parsed.drafts)) {
      throw new Error("フォーマットが無効です。このアプリで書き出したJSONを選択してください。");
    }

    const currentList = readList();
    const byId = Object.fromEntries(currentList.map((d) => [d.id, d]));

    let count = 0;
    for (const entry of parsed.drafts) {
      if (!entry?.id || !entry?.name) continue;
      const { _audioDataURL, ...meta } = entry;
      if (_audioDataURL) {
        try {
          await idbPut(meta.id, dataURLToBlob(_audioDataURL));
        } catch (e) {
          console.warn("[import] audio restore failed:", meta.id, e);
        }
      }
      byId[meta.id] = meta;
      count++;
    }

    const updated = Object.values(byId).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    writeList(updated);
    setDrafts(updated);
    return count;
  }, []);

  return { drafts, save, load, remove, exportAll, importAll };
}
