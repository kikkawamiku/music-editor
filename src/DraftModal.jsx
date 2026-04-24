import { useState } from "react";

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("ja-JP", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDur(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function DraftModal({ drafts, currentFileName, onSave, onLoad, onDelete, onClose }) {
  const [name, setName]       = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null); // delete confirm

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSave(trimmed);
    setName("");
  };

  const handleLoad = async (id) => {
    setLoadingId(id);
    await onLoad(id);
    setLoadingId(null);
  };

  const handleDelete = async (id) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    await onDelete(id);
    setConfirmId(null);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Header */}
        <div className="modal-head">
          <h2 className="modal-title">ドラフト管理</h2>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>

        {/* Save row */}
        <div className="modal-save-section">
          <p className="modal-section-label">現在の作業を保存</p>
          {currentFileName && (
            <p className="modal-file-hint">🎵 {currentFileName}</p>
          )}
          <div className="modal-save-row">
            <input
              className="draft-name-input"
              type="text"
              placeholder="ドラフト名（例: ショート版A）"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <button
              className="btn-save-draft"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              保存
            </button>
          </div>
        </div>

        {/* Draft list */}
        <div className="modal-list-section">
          <p className="modal-section-label">保存済みドラフト</p>

          {drafts.length === 0 ? (
            <div className="draft-empty">
              <p>まだ保存されたドラフトはありません</p>
            </div>
          ) : (
            <ul className="draft-list">
              {[...drafts].reverse().map((d) => (
                <li key={d.id} className="draft-item">
                  <div className="draft-info">
                    <span className="draft-name">{d.name}</span>
                    <span className="draft-meta">
                      🎵 {d.fileName || "—"} &nbsp;·&nbsp;
                      {d.segmentCount}フレーズ &nbsp;·&nbsp;
                      {fmtDur(d.duration)} &nbsp;·&nbsp;
                      {fmtDate(d.updatedAt)}
                    </span>
                  </div>
                  <div className="draft-btns">
                    <button
                      className="btn-load"
                      onClick={() => handleLoad(d.id)}
                      disabled={loadingId === d.id}
                    >
                      {loadingId === d.id ? "読込中…" : "読み込む"}
                    </button>
                    <button
                      className={`btn-del ${confirmId === d.id ? "confirm" : ""}`}
                      onClick={() => handleDelete(d.id)}
                      onBlur={() => setConfirmId(null)}
                      title={confirmId === d.id ? "もう一度クリックで削除" : "削除"}
                    >
                      {confirmId === d.id ? "確認?" : "削除"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
