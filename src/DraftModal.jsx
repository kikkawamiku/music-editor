import { useEffect, useRef, useState } from "react";

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

export default function DraftModal({
  drafts, currentFileName,
  onSave, onLoad, onDelete, onClose,
  onExport, onImport,
}) {
  const [name,        setName]        = useState("");
  const [loadingId,   setLoadingId]   = useState(null);
  const [confirmId,   setConfirmId]   = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [importResult, setImportResult] = useState(null); // { count } | { error }
  const resultTimerRef = useRef(null);

  // Auto-clear import result after 6s
  useEffect(() => {
    if (!importResult) return;
    clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => setImportResult(null), 6000);
    return () => clearTimeout(resultTimerRef.current);
  }, [importResult]);

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

  const handleExport = async () => {
    setTransferring(true);
    try {
      await onExport();
    } finally {
      setTransferring(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setTransferring(true);
    setImportResult(null);
    try {
      const text  = await file.text();
      const count = await onImport(text);
      setImportResult({ count });
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setTransferring(false);
    }
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

        {/* Backup / Transfer section */}
        <div className="modal-transfer-section">
          <p className="modal-section-label">バックアップ / 端末間転送</p>
          <div className="transfer-row">
            {/* Export */}
            <button
              className="btn-transfer"
              onClick={handleExport}
              disabled={transferring || drafts.length === 0}
              title="全ドラフトをJSONファイルで書き出し"
            >
              {transferring ? "処理中…" : "📤 JSONで書き出し"}
            </button>

            {/* Import — iOS-safe file-label overlay pattern */}
            <label
              className={`btn-transfer file-label ${transferring ? "btn-transfer--disabled" : ""}`}
              title="JSONファイルからドラフトを読み込み"
            >
              📥 JSONを読み込み
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                disabled={transferring}
              />
            </label>
          </div>

          {/* Result feedback */}
          {importResult && (
            <p className={`transfer-result ${importResult.error ? "transfer-result--error" : "transfer-result--success"}`}>
              {importResult.error
                ? `⚠ ${importResult.error}`
                : `✓ ${importResult.count}件のドラフトを読み込みました`}
            </p>
          )}

          <p className="transfer-hint">
            PCで書き出したJSONをAirDrop・メール等でスマホに送ることで編集を引き継げます。同じIDのドラフトは上書きされます。
          </p>
        </div>
      </div>
    </div>
  );
}
