import { useState, useRef, useCallback, useEffect } from "react";
import Waveform from "../Waveform";
import SegmentList from "../SegmentList";
import PlaylistEditor from "../PlaylistEditor";
import DraftModal from "../DraftModal";
import { useAudioAnalyzer } from "../useAudioAnalyzer";
import { usePreviewPlayer } from "../usePreviewPlayer";
import { useDrafts } from "../useDrafts";
import { encodeWav, downloadWav } from "../exportWav";
import "../App.css";

/**
 * SimpleEditView — rhythm-based phrase editor.
 * Props:
 *   onNavigate(route: string) — future routing hook
 */
export default function SimpleEditView({ onNavigate }) {
  const [audioUrl,     setAudioUrl]     = useState(null);
  const [audioBuffer,  setAudioBuffer]  = useState(null);
  const [duration,     setDuration]     = useState(0);
  const [bpm,          setBpm]          = useState(128);
  const [offset,       setOffset]       = useState(0);
  const [dragOver,     setDragOver]     = useState(false);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [playlist,     setPlaylist]     = useState([]);
  const [splitFlash,   setSplitFlash]   = useState(false);
  const [draftOpen,    setDraftOpen]    = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [exporting,    setExporting]    = useState(false);

  const waveformRef  = useRef(null);
  const isPlayingRef = useRef(false);
  const fileBlobRef  = useRef(null);
  const fileNameRef  = useRef("");

  const {
    segments, initAudio, splitAt, deleteSegment,
    loadSegments, bpmSplit, updateLabel, updateSegmentBounds,
  } = useAudioAnalyzer();

  const { play, stop, playing: previewPlaying, activeIndex } = usePreviewPlayer();
  const { drafts, save: saveDraft, load: loadDraft, remove: removeDraft } = useDrafts();

  // ── Playback state ──────────────────────────────────────
  const handlePlayStateChange = useCallback((state) => {
    isPlayingRef.current = state;
    setIsPlaying(state);
  }, []);

  // ── Split ───────────────────────────────────────────────
  const handleSplit = useCallback(() => {
    const time = waveformRef.current?.getCurrentTime() ?? 0;
    splitAt(time);
    setSplitFlash(true);
    setTimeout(() => setSplitFlash(false), 180);
  }, [splitAt]);

  // Space = split if playing, play/pause if stopped
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!audioUrl) return;
        isPlayingRef.current ? handleSplit() : waveformRef.current?.playPause();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [audioUrl, handleSplit]);

  // ── File loading ────────────────────────────────────────
  const loadFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("audio/")) return;
    stop();
    fileBlobRef.current = file;
    fileNameRef.current = file.name ?? "";
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setPlaylist([]);
    setOffset(0);
    const ctx     = new AudioContext();
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    setAudioBuffer(decoded);
    setDuration(decoded.duration);
    initAudio(decoded.duration);
  }, [initAudio, stop]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer.files[0]);
  }, [loadFile]);

  // ── BPM split ───────────────────────────────────────────
  const handleBpmSplit = () => {
    if (!duration) return;
    setPlaylist([]);
    bpmSplit(bpm, duration, offset);
  };

  // ── Draft save ──────────────────────────────────────────
  const handleSaveDraft = useCallback(async (name) => {
    await saveDraft(name, {
      fileName: fileNameRef.current, bpm, offset, duration,
      segments, playlist, audioBlob: fileBlobRef.current,
    });
  }, [saveDraft, bpm, offset, duration, segments, playlist]);

  // ── Draft load ──────────────────────────────────────────
  const handleLoadDraft = useCallback(async (id) => {
    setLoadingDraft(true);
    try {
      const draft = await loadDraft(id);
      if (!draft) return;
      stop();
      setBpm(draft.bpm ?? 128);
      setOffset(draft.offset ?? 0);
      if (draft.audioBlob) {
        fileBlobRef.current = draft.audioBlob;
        fileNameRef.current = draft.fileName ?? "";
        setAudioUrl(URL.createObjectURL(draft.audioBlob));
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(await draft.audioBlob.arrayBuffer());
        setAudioBuffer(decoded);
        setDuration(decoded.duration);
      }
      loadSegments(draft.segments ?? []);
      setPlaylist(draft.playlist ?? []);
      setDraftOpen(false);
    } finally {
      setLoadingDraft(false);
    }
  }, [loadDraft, loadSegments, stop]);

  // ── WAV export ──────────────────────────────────────────
  const handleExport = useCallback(async () => {
    // Guard: must have decoded audio and at least one playlist item
    if (!audioBuffer) {
      console.error("[export] audioBuffer is null — file not decoded yet");
      return;
    }
    if (!playlist.length) {
      console.error("[export] playlist is empty");
      return;
    }

    console.log("[export] starting", {
      sampleRate:  audioBuffer.sampleRate,
      channels:    audioBuffer.numberOfChannels,
      duration:    audioBuffer.duration.toFixed(2),
      playlistLen: playlist.length,
    });

    setExporting(true);
    // Yield to React so the spinner renders before the synchronous encode blocks
    await new Promise((r) => setTimeout(r, 80));

    try {
      const segMap = Object.fromEntries(segments.map((s) => [s.id, s]));
      const items  = playlist.map((id) => segMap[id]).filter(Boolean);

      if (items.length === 0) {
        throw new Error("プレイリストに有効なフレーズがありません");
      }
      console.log("[export] items:", items.length, items);

      const encoded = encodeWav(audioBuffer, items);
      console.log("[export] encode complete");

      const base = fileNameRef.current.replace(/\.[^.]+$/, "") || "edited";
      downloadWav(encoded, `${base}_edited.wav`);
      console.log("[export] downloadWav called");
    } catch (err) {
      console.error("[export] FAILED:", err);
      // Show a visible error so the user knows what went wrong
      alert(`書き出しに失敗しました。\n\n${err.message}`);
    } finally {
      setExporting(false);
    }
  }, [audioBuffer, playlist, segments]);

  // ── Preview playback ────────────────────────────────────
  const handlePlayFrom = (items, fromIndex) => play(audioBuffer, items, fromIndex);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon">♪</div>
          <div>
            <h1>リズム編集ツール</h1>
            <p className="subtitle">再生しながらスペースキーでフレーズを分割</p>
          </div>
        </div>
        <div className="header-actions">
          {audioUrl && (
            <>
              <button className="btn-draft" onClick={() => setDraftOpen(true)}>ドラフト</button>
              <label className="btn-ghost">
                別の曲を開く
                <input type="file" accept="audio/*" onChange={(e) => loadFile(e.target.files[0])} hidden />
              </label>
            </>
          )}
          {!audioUrl && drafts.length > 0 && (
            <button className="btn-draft" onClick={() => setDraftOpen(true)}>ドラフトを開く</button>
          )}
        </div>
      </header>

      {draftOpen && (
        <DraftModal
          drafts={drafts}
          currentFileName={fileNameRef.current}
          onSave={handleSaveDraft}
          onLoad={handleLoadDraft}
          onDelete={removeDraft}
          onClose={() => setDraftOpen(false)}
        />
      )}

      {loadingDraft && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>ドラフトを読み込み中…</p>
        </div>
      )}

      {!audioUrl ? (
        <div
          className={`drop-zone ${dragOver ? "drag-over" : ""}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          <div className="dz-icon">♪</div>
          <p className="dz-title">音声ファイルをドロップ</p>
          <p className="hint">MP3 · WAV · FLAC · OGG</p>
          <label className="btn-primary mt">
            ファイルを選択
            <input type="file" accept="audio/*" onChange={(e) => loadFile(e.target.files[0])} hidden />
          </label>
        </div>
      ) : (
        <div className="editor">
          <div className="waveform-panel">
            <Waveform
              ref={waveformRef}
              audioUrl={audioUrl}
              segments={segments}
              onRegionUpdate={updateSegmentBounds}
              onPlayStateChange={handlePlayStateChange}
            />
          </div>

          <div className={`split-bar ${isPlaying ? "is-playing" : ""} ${splitFlash ? "flash" : ""}`}>
            <div className="split-bar-left">
              <div className="hint-block">
                <span className="hint-title">分割操作</span>
                <span className="hint-body">再生中に押す</span>
              </div>
              <button className={`btn-split ${isPlaying ? "can-split" : ""}`} onClick={handleSplit}>
                <span className="split-icon">✂</span>
                ここで分割
                <kbd>Space</kbd>
              </button>
            </div>
            <div className="split-bar-right">
              <div className="bpm-group">
                <label className="ctrl-label">BPM補助</label>
                <input
                  className="bpm-input"
                  type="number"
                  value={bpm}
                  min={40}
                  max={300}
                  onChange={(e) => setBpm(Number(e.target.value))}
                />
                <button className="btn-bpm" onClick={handleBpmSplit}>グリッド分割</button>
              </div>
              <button className="btn-draft-inline" onClick={() => setDraftOpen(true)}>
                保存 / 読込
              </button>
            </div>
          </div>

          {segments.length > 0 && (
            <div className="bottom-panels">
              <SegmentList
                segments={segments}
                onLabelChange={updateLabel}
                onAddToPlaylist={(id) => setPlaylist((p) => [...p, id])}
                onDelete={deleteSegment}
              />
              <PlaylistEditor
                playlist={playlist}
                segments={segments}
                onReorder={setPlaylist}
                onRemove={(i) => setPlaylist((p) => p.filter((_, idx) => idx !== i))}
                onClear={() => setPlaylist([])}
                onPlay={handlePlayFrom}
                onStop={stop}
                onExport={handleExport}
                playing={previewPlaying}
                activeIndex={activeIndex}
                exporting={exporting}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
