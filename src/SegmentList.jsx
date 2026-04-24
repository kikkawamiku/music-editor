import { LABELS, getLabelById } from "./labels";

function fmt(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function SegmentList({ segments, onLabelChange, onAddToPlaylist, onDelete }) {
  if (segments.length === 0) return null;

  return (
    <div className="segment-list">
      <h2 className="panel-title">
        フレーズ一覧
        <span className="badge">{segments.length}</span>
      </h2>
      <div className="segment-cards">
        {segments.map((s, idx) => {
          const active = getLabelById(s.label);
          return (
            <div
              key={s.id}
              className="segment-card"
              style={{ "--accent": s.label ? active.color : "#334155" }}
            >
              <div className="sc-header">
                <div className="sc-meta">
                  <span className="sc-num">#{idx + 1}</span>
                  <span className="sc-time">
                    {fmt(s.start)}<span className="t-arrow">→</span>{fmt(s.end)}
                  </span>
                  {s.label && (
                    <span
                      className="sc-tag"
                      style={{ color: active.color, borderColor: active.color + "55", background: active.color + "18" }}
                    >
                      {active.name}
                    </span>
                  )}
                </div>
                <div className="sc-actions">
                  <button className="sc-add"    onClick={() => onAddToPlaylist(s.id)} title="プレイリストに追加">＋</button>
                  <button
                    className="sc-delete"
                    onClick={() => onDelete(s.id)}
                    disabled={segments.length <= 1}
                    title="このフレーズを削除（前と結合）"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="chip-row">
                {LABELS.map((l) => (
                  <button
                    key={l.id}
                    className={`chip ${s.label === l.id ? "chip-on" : ""}`}
                    style={{ "--c": l.color }}
                    onClick={() => onLabelChange(s.id, s.label === l.id ? "" : l.id)}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
