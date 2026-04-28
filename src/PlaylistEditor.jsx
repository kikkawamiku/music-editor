import { useCallback, useEffect, useRef, useState } from "react";
import { getLabelById } from "./labels";

function fmt(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function totalDur(segs) {
  return segs.reduce((s, seg) => s + Math.max(0, seg.end - seg.start), 0);
}

export default function PlaylistEditor({
  playlist, segments, onReorder, onRemove, onClear,
  onPlay, onStop, onExport, playing, activeIndex, exporting,
}) {
  const [dragFrom,    setDragFrom]    = useState(null);
  const [dragOver,    setDragOver]    = useState(null);
  const [scrollToIdx, setScrollToIdx] = useState(null);
  const listRef = useRef(null);

  const segMap = Object.fromEntries(segments.map((s) => [s.id, s]));
  const items  = playlist.map((id) => segMap[id]).filter(Boolean);

  // Scroll to bottom when a new item is appended
  useEffect(() => {
    if (listRef.current && playlist.length > 0) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [playlist.length]);

  // Scroll moved item into view after ↑↓ reorder
  useEffect(() => {
    if (scrollToIdx === null || !listRef.current) return;
    listRef.current.children[scrollToIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setScrollToIdx(null);
  }, [scrollToIdx]);

  // Desktop drag-and-drop reorder
  const commitDrop = (toIdx) => {
    if (dragFrom === null || dragFrom === toIdx) return;
    const next = [...playlist];
    const [moved] = next.splice(dragFrom, 1);
    next.splice(toIdx, 0, moved);
    onReorder(next);
    setDragFrom(null);
    setDragOver(null);
  };

  // Mobile ↑↓ tap reorder
  const moveItem = useCallback((fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= playlist.length) return;
    const next = [...playlist];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onReorder(next);
    setScrollToIdx(toIdx);
  }, [playlist, onReorder]);

  return (
    <div className="playlist-editor">
      <h2 className="panel-title">
        プレビュープレイリスト
        <span className="badge">{items.length}</span>
        {items.length > 0 && (
          <span className="pl-total-dur">{fmt(totalDur(items))}</span>
        )}
      </h2>

      {items.length === 0 ? (
        <div className="pl-empty">
          <div className="pl-empty-icon">♫</div>
          <p>フレーズ一覧の <strong>＋</strong> で追加</p>
          <p className="hint hint-body-pc">ドラッグで順番を変更できます</p>
          <p className="hint hint-body-mobile">↑↓ で順番を変更できます</p>
        </div>
      ) : (
        <ul className="pl-items" ref={listRef}>
          {items.map((seg, i) => {
            const label    = getLabelById(seg.label);
            const isActive = playing && activeIndex === i;
            const segIdx   = segments.findIndex((s) => s.id === seg.id);
            return (
              <li
                key={`${seg.id}-${i}`}
                className={`pl-item ${isActive ? "pl-active" : ""} ${dragOver === i ? "pl-drag-over" : ""}`}
                style={{ "--lc": label.color }}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                onDrop={() => commitDrop(i)}
                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
              >
                <span className="pl-drag">⠿</span>
                <span className="pl-num">{i + 1}</span>
                <span className="pl-dot" />
                <span className="pl-info">
                  <span className="pl-name">{label.name || "—"}</span>
                  <span className="pl-sub">
                    #{segIdx + 1} · {fmt(seg.start)}–{fmt(seg.end)}
                  </span>
                </span>
                {isActive && <span className="pl-playing-dot" />}

                {/* ↑↓ buttons — visible on mobile only (CSS-controlled) */}
                <div className="pl-move-group" aria-label="順番を変更">
                  <button
                    className="pl-move-btn"
                    onClick={() => moveItem(i, i - 1)}
                    disabled={i === 0}
                    aria-label="上に移動"
                  >↑</button>
                  <button
                    className="pl-move-btn"
                    onClick={() => moveItem(i, i + 1)}
                    disabled={i === items.length - 1}
                    aria-label="下に移動"
                  >↓</button>
                </div>

                <button className="pl-play-from" onClick={() => onPlay(items, i)} title="ここから再生">▶</button>
                <button className="pl-remove" onClick={() => onRemove(i)}>×</button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pl-footer">
        {playing ? (
          <button className="btn-stop" onClick={onStop}>■ 停止</button>
        ) : (
          <button className="btn-preview" onClick={() => onPlay(items, 0)} disabled={items.length === 0}>
            ▶ 最初から再生
          </button>
        )}
        {items.length > 0 && (
          <button className="btn-clear" onClick={onClear}>クリア</button>
        )}
      </div>

      {items.length > 0 && (
        <button
          className={`btn-export ${exporting ? "exporting" : ""}`}
          onClick={onExport}
          disabled={exporting}
        >
          {exporting ? (
            <><span className="export-spinner" /> 書き出し中…</>
          ) : (
            <>⬇ 完成音源をダウンロード (.wav)</>
          )}
        </button>
      )}
    </div>
  );
}
